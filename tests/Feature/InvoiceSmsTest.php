<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Customer;
use App\Models\Rental;
use App\Models\Role;
use App\Models\Sale;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InvoiceSmsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function makeUser(string $roleSlug): User
    {
        $role = Role::query()->where('slug', $roleSlug)->firstOrFail();
        $user = User::query()->create([
            'name' => ucfirst($roleSlug).' User',
            'email' => $roleSlug.uniqid().'@test.local',
            'password' => 'password123',
            'status' => 'Active',
        ]);
        $user->role_id = $role->id;
        $user->role = $role->name;
        $user->save();

        return $user;
    }

    private function configureGateway(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $this->putJson('/api/admin/sms-gateway', [
            'sms_service' => 'notifylk',
            'notifylk_user_id' => '12345',
            'notifylk_api_key' => 'SECRET-API-KEY-XYZ',
            'notifylk_sender_id' => 'BuildTrack',
        ])->assertOk();
    }

    private function customer(): Customer
    {
        return Customer::query()->create(['customer_code' => 'C-T1', 'name' => 'Nimal Perera', 'phone' => '0771234567', 'status' => 'Active']);
    }

    private function sale(): Sale
    {
        return Sale::query()->create([
            'invoice_number' => 'INV-T001',
            'customer_id' => $this->customer()->id,
            'sale_date' => '2026-10-03',
            'subtotal' => 15000,
            'discount' => 0,
            'tax' => 0,
            'total_amount' => 15000,
            'paid_amount' => 10000,
            'balance' => 5000,
            'payment_status' => 'Partial',
            'payment_method' => 'Cash',
            'sale_status' => 'Completed',
        ]);
    }

    private function rental(): Rental
    {
        return Rental::query()->create([
            'rental_number' => 'RNT-T001',
            'customer_id' => $this->customer()->id,
            'start_date' => '2026-10-01',
            'expected_return_date' => '2026-10-03',
            'actual_return_date' => '2026-10-04',
            'subtotal' => 8000,
            'discount' => 0,
            'deposit' => 0,
            'late_fee' => 2500,
            'damage_fee' => 0,
            'total_amount' => 10500,
            'paid_amount' => 10500,
            'balance' => 0,
            'payment_status' => 'Paid',
            'payment_method' => 'Cash',
            'status' => 'Returned',
        ]);
    }

    public function test_sale_invoice_preview_and_send(): void
    {
        $this->configureGateway();
        $sale = $this->sale();
        Http::fake(['app.notify.lk/*' => Http::response(['status' => 'success'], 200)]);

        $preview = $this->getJson("/api/sales/{$sale->id}/invoice-sms")->assertOk();
        $preview->assertJsonPath('data.phone', '0771234567')->assertJsonPath('data.configured', true);
        $message = $preview->json('data.message');
        $this->assertStringContainsString('Invoice: INV-T001', $message);
        $this->assertStringContainsString('Total: LKR 15,000.00', $message);
        $this->assertStringContainsString('Balance: LKR 5,000.00', $message);

        $this->postJson("/api/sales/{$sale->id}/invoice-sms", ['phone' => '0771234567'])
            ->assertOk()
            ->assertJsonPath('message', 'Invoice sent to the customer via SMS.');

        Http::assertSent(fn (HttpRequest $r) => $r['to'] === '94771234567' && str_contains($r['message'], 'INV-T001'));
        $log = ActivityLog::query()->where('action', 'sms_sent')->firstOrFail();
        $this->assertStringContainsString('INV-T001', $log->description);
        $this->assertStringNotContainsString('0771234567', $log->description);
        $this->assertStringNotContainsString('SECRET-API-KEY-XYZ', ActivityLog::query()->get()->toJson());
    }

    public function test_rental_invoice_send_uses_edited_message_and_reports_gateway_errors(): void
    {
        $this->configureGateway();
        $rental = $this->rental();

        $message = $this->getJson("/api/rentals/{$rental->id}/invoice-sms")->assertOk()->json('data.message');
        $this->assertStringContainsString('Rental invoice: RNT-T001', $message);
        $this->assertStringContainsString('Late fee: LKR 2,500.00', $message);
        $this->assertStringNotContainsString('Balance', $message);

        Http::fake(['app.notify.lk/*' => Http::sequence()
            ->push(['status' => 'success'], 200)
            ->push(['status' => 'error', 'message' => 'Insufficient balance'], 200)]);
        $this->postJson("/api/rentals/{$rental->id}/invoice-sms", ['phone' => '+94 77 765 4321', 'message' => 'Custom text'])->assertOk();
        Http::assertSent(fn (HttpRequest $r) => $r['to'] === '94777654321' && $r['message'] === 'Custom text');

        $this->postJson("/api/rentals/{$rental->id}/invoice-sms", ['phone' => '0777654321'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'SMS gateway rejected the request (HTTP 200): Insufficient balance');
        $this->assertTrue(ActivityLog::query()->where('action', 'sms_failed')->exists());
    }

    public function test_validation_unconfigured_gateway_and_permissions(): void
    {
        $sale = $this->sale();
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson("/api/sales/{$sale->id}/invoice-sms", ['phone' => 'abc'])->assertStatus(422)->assertJsonValidationErrors('phone');
        $this->postJson("/api/sales/{$sale->id}/invoice-sms", ['phone' => '0771234567'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'The SMS gateway is not configured. Ask an administrator to set it up under Administration > Settings.');
        $this->getJson("/api/sales/{$sale->id}/invoice-sms")->assertOk()->assertJsonPath('data.configured', false);

        $viewer = $this->makeUser('staff');
        $viewer->access_mode = User::ACCESS_CUSTOM;
        $viewer->save();
        $viewer->customPermissions()->sync(\App\Models\Permission::query()->where('slug', 'sales.view')->pluck('id'));
        Sanctum::actingAs($viewer->fresh());
        $this->postJson("/api/sales/{$sale->id}/invoice-sms", ['phone' => '0771234567'])->assertForbidden();
    }
}
