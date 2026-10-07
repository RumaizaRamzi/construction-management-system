<?php

namespace Tests\Feature;

use App\Models\Cheque;
use App\Models\Customer;
use App\Models\IncomePayment;
use App\Models\Notification;
use App\Models\Role;
use App\Models\Supplier;
use App\Models\User;
use App\Services\NotificationAlertService;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ChequeModuleTest extends TestCase
{
    use RefreshDatabase;

    private Customer $customer;

    private Supplier $supplier;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->customer = Customer::query()->create(['customer_code' => 'CUS-CQ1', 'name' => 'Perera Builders']);
        $this->supplier = Supplier::query()->create(['supplier_code' => 'SUP-CQ1', 'name' => 'Lanka Cement', 'status' => 'Active']);
    }

    private function actingAsRole(string $slug): User
    {
        $role = Role::query()->where('slug', $slug)->firstOrFail();
        $user = User::query()->create([
            'name' => ucfirst($slug).' User',
            'email' => $slug.uniqid().'@test.local',
            'password' => 'password123',
            'status' => 'Active',
        ]);
        $user->role_id = $role->id;
        $user->role = $role->name;
        $user->save();
        Sanctum::actingAs($user);

        return $user;
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'cheque_number' => '100234',
            'bank' => 'Bank of Ceylon',
            'amount' => 150000,
            'cheque_date' => now()->addDays(10)->toDateString(),
            'type' => 'received',
            'customer_id' => $this->customer->id,
            'notes' => 'Post-dated cheque',
        ], $overrides);
    }

    public function test_crud_with_validation_and_duplicate_protection(): void
    {
        $this->actingAsRole('accountant');

        $this->postJson('/api/cheques', [])->assertStatus(422)
            ->assertJsonValidationErrors(['cheque_number', 'bank', 'amount', 'cheque_date', 'type']);
        $this->postJson('/api/cheques', $this->payload(['amount' => 0]))->assertStatus(422)
            ->assertJsonPath('errors.amount.0', 'The cheque amount must be greater than zero.');

        $id = $this->postJson('/api/cheques', $this->payload())->assertCreated()
            ->assertJsonPath('data.status', 'Pending')
            ->assertJsonPath('data.customer_name', 'Perera Builders')
            ->json('data.id');

        $this->postJson('/api/cheques', $this->payload())->assertStatus(422)
            ->assertJsonPath('errors.cheque_number.0', 'A cheque with this number already exists for this bank.');
        $this->postJson('/api/cheques', $this->payload(['bank' => 'Sampath Bank']))->assertCreated();

        $this->putJson("/api/cheques/{$id}", ['amount' => 175000, 'notes' => 'Revised'])->assertOk()
            ->assertJsonPath('data.amount', 175000);

        $this->getJson('/api/cheques?search=Perera&status=Pending')->assertOk()->assertJsonPath('data.total', 2);
        $this->getJson('/api/cheques?search=Sampath')->assertOk()->assertJsonPath('data.total', 1);
        $this->getJson('/api/cheques/summary')->assertOk()->assertJsonPath('data.pending.count', 2);

        $this->deleteJson("/api/cheques/{$id}")->assertOk();
        $this->assertDatabaseMissing('cheques', ['id' => $id]);
    }

    public function test_status_update_and_bounced_notification(): void
    {
        $this->actingAsRole('accountant');
        $id = $this->postJson('/api/cheques', $this->payload())->json('data.id');

        $this->patchJson("/api/cheques/{$id}/status", ['status' => 'Deposited'])->assertOk()
            ->assertJsonPath('message', 'Cheque marked as Deposited.');
        $this->patchJson("/api/cheques/{$id}/status", ['status' => 'Deposited'])->assertStatus(422);
        $this->patchJson("/api/cheques/{$id}/status", ['status' => 'Lost'])->assertStatus(422);

        $this->patchJson("/api/cheques/{$id}/status", ['status' => 'Bounced', 'note' => 'Insufficient funds'])->assertOk()
            ->assertJsonPath('data.status', 'Bounced');

        $this->assertStringContainsString('Insufficient funds', Cheque::query()->find($id)->notes);
        $this->assertTrue(Notification::query()->where('type', 'Cheque Bounced')->where('related_id', $id)->exists());
    }

    public function test_permissions(): void
    {
        $this->actingAsRole('staff');
        $this->getJson('/api/cheques')->assertOk();
        $this->postJson('/api/cheques', $this->payload())->assertForbidden();

        $id = Cheque::query()->create([...$this->payload(), 'status' => 'Pending'])->id;
        $this->patchJson("/api/cheques/{$id}/status", ['status' => 'Cleared'])->assertForbidden();
        $this->deleteJson("/api/cheques/{$id}")->assertForbidden();
    }

    public function test_cheque_payment_creates_linked_cheque_without_duplicates(): void
    {
        $this->actingAsRole('accountant');

        $incomeId = $this->postJson('/api/income', [
            'amount' => 50000, 'customer_id' => $this->customer->id, 'source' => 'Rental', 'date' => now()->toDateString(),
        ])->assertCreated()->json('data.id');

        // A cheque recorded first is linked, not duplicated, when the payment arrives.
        $preId = $this->postJson('/api/cheques', $this->payload(['cheque_number' => '555001', 'amount' => 20000]))->json('data.id');

        $this->postJson("/api/income/{$incomeId}/payments", [
            'amount' => 20000, 'payment_method' => 'Cheque', 'reference' => '555001', 'payment_date' => now()->toDateString(),
        ])->assertCreated();

        $this->assertSame(1, Cheque::query()->count());
        $pre = Cheque::query()->find($preId);
        $this->assertSame('income_payment', $pre->payment_type);
        $this->assertSame('income', $pre->reference_type);
        $this->assertSame($incomeId, $pre->reference_id);

        // A cheque payment with a new number creates a cheque record linked to it.
        $this->postJson("/api/income/{$incomeId}/payments", [
            'amount' => 10000, 'payment_method' => 'Cheque', 'reference' => '555002',
        ])->assertCreated();
        $auto = Cheque::query()->where('cheque_number', '555002')->firstOrFail();
        $this->assertSame('received', $auto->type);
        $this->assertSame($this->customer->id, $auto->customer_id);
        $this->assertSame(10000.0, (float) $auto->amount);

        // Non-cheque payments do not create cheques.
        $this->postJson("/api/income/{$incomeId}/payments", ['amount' => 5000, 'payment_method' => 'Cash'])->assertCreated();
        $this->assertSame(2, Cheque::query()->count());

        // Deleting the payment keeps the cheque but removes the link.
        $paymentId = IncomePayment::query()->where('reference', '555002')->value('id');
        $this->deleteJson("/api/income/{$incomeId}/payments/{$paymentId}")->assertOk();
        $this->assertNull($auto->fresh()->payment_id);
    }

    public function test_reminders_three_days_one_day_today_and_overdue(): void
    {
        $this->actingAsRole('admin');
        $today = Carbon::parse('2026-10-10');
        $make = fn (string $no, int $days) => Cheque::query()->create([
            ...$this->payload(['cheque_number' => $no, 'cheque_date' => $today->copy()->addDays($days)->toDateString()]),
            'status' => 'Pending',
        ]);
        $in3 = $make('R3', 3);
        $in1 = $make('R1', 1);
        $due = $make('R0', 0);
        $late = $make('RL', -2);
        $make('R9', 9);
        Cheque::query()->create([...$this->payload(['cheque_number' => 'CL', 'cheque_date' => $today->toDateString()]), 'status' => 'Cleared']);

        $service = app(NotificationAlertService::class);
        $service->generate($today);

        $types = Notification::query()->where('related_type', 'cheque')->pluck('type', 'related_id');
        $this->assertSame('Cheque Due in 3 Days', $types[$in3->id]);
        $this->assertSame('Cheque Due Tomorrow', $types[$in1->id]);
        $this->assertSame('Cheque Due Today', $types[$due->id]);
        $this->assertSame('Cheque Overdue', $types[$late->id]);
        $this->assertCount(4, $types);

        // Re-running does not duplicate; the next stage arrives the following days.
        $service->generate($today);
        $this->assertSame(4, Notification::query()->where('related_type', 'cheque')->count());
        $service->generate($today->copy()->addDays(2));
        $this->assertTrue(Notification::query()->where('related_id', $in3->id)->where('type', 'Cheque Due Tomorrow')->exists());
    }

    public function test_report_with_filters(): void
    {
        $this->actingAsRole('accountant');
        $base = ['cheque_date' => now()->addDays(2)->toDateString()];
        Cheque::query()->create([...$this->payload(['cheque_number' => 'A1', 'amount' => 1000] + $base), 'status' => 'Pending']);
        Cheque::query()->create([...$this->payload(['cheque_number' => 'A2', 'amount' => 2000] + $base), 'status' => 'Cleared']);
        Cheque::query()->create([...$this->payload(['cheque_number' => 'A3', 'amount' => 3000, 'type' => 'issued', 'customer_id' => null, 'supplier_id' => $this->supplier->id] + $base), 'status' => 'Bounced']);
        Cheque::query()->create([...$this->payload(['cheque_number' => 'A4', 'amount' => 4000, 'cheque_date' => now()->subDays(5)->toDateString()]), 'status' => 'Pending']);

        $this->getJson('/api/reports/cheques')->assertOk()
            ->assertJsonPath('data.summary.total.count', 4)
            ->assertJsonPath('data.summary.pending.amount', 5000)
            ->assertJsonPath('data.summary.upcoming.count', 1)
            ->assertJsonPath('data.summary.overdue.count', 1)
            ->assertJsonPath('data.summary.bounced.amount', 3000)
            ->assertJsonPath('data.summary.issued.count', 1);

        $this->getJson('/api/reports/cheques?type=issued')->assertOk()
            ->assertJsonPath('data.summary.total.count', 1)
            ->assertJsonPath('data.cheques.0.party_name', 'Lanka Cement');

        $this->getJson('/api/reports/cheques?status=Overdue')->assertOk()->assertJsonPath('data.summary.total.count', 1);
        $this->getJson('/api/reports/cheques?from='.now()->toDateString())->assertOk()->assertJsonPath('data.summary.total.count', 3);
    }
}
