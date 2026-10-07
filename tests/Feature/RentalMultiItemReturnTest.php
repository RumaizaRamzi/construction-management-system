<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Rental;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RentalMultiItemReturnTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Customer $customer;

    private Product $drill;

    private Product $scaffold;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        $this->admin = User::query()->where('email', 'admin@buildtrack.local')->firstOrFail();
        Sanctum::actingAs($this->admin);

        $this->customer = Customer::query()->create(['customer_code' => 'CUS-T1', 'name' => 'Test Customer']);
        $this->drill = $this->product('DRL-1', 'Test Drill', 10);
        $this->scaffold = $this->product('SCF-1', 'Test Scaffold', 6);
    }

    private function product(string $serialNumber, string $name, int $qty): Product
    {
        return Product::query()->create([
            'serial_number' => $serialNumber,
            'name' => $name,
            'quantity' => $qty,
            'available_quantity' => $qty,
            'rented_quantity' => 0,
            'rental_price' => 1000,
            'status' => 'Available',
        ]);
    }

    private function createRental(int $drillQty, int $scaffoldQty): array
    {
        $response = $this->postJson('/api/rentals', [
            'customer_id' => $this->customer->id,
            'start_date' => now()->subDay()->toDateString(),
            'expected_return_date' => now()->addDays(5)->toDateString(),
            'status' => 'Active',
            'items' => [
                ['product_id' => $this->drill->id, 'quantity' => $drillQty, 'rental_rate' => 1000],
                ['product_id' => $this->scaffold->id, 'quantity' => $scaffoldQty, 'rental_rate' => 500],
            ],
        ])->assertCreated();

        return $response->json('data');
    }

    private function itemId(array $rental, int $productId): int
    {
        return collect($rental['items'])->firstWhere('product_id', $productId)['id'];
    }

    private function assertStock(Product $product, int $quantity, int $available, int $rented): void
    {
        $product->refresh();
        $this->assertSame(
            [$quantity, $available, $rented],
            [(int) $product->quantity, (int) $product->available_quantity, (int) $product->rented_quantity],
            "{$product->name} quantity/available/rented"
        );
    }

    public function test_explicit_item_return_only_touches_each_items_own_product(): void
    {
        $rental = $this->createRental(3, 2);
        $this->assertStock($this->drill, 10, 7, 3);
        $this->assertStock($this->scaffold, 6, 4, 2);

        $this->postJson("/api/rentals/{$rental['id']}/return", [
            'return_date' => now()->toDateString(),
            'condition' => 'Good',
            'items' => [
                ['rental_item_id' => $this->itemId($rental, $this->drill->id), 'returned_quantity' => 2, 'damaged_quantity' => 1],
                ['rental_item_id' => $this->itemId($rental, $this->scaffold->id), 'returned_quantity' => 1, 'missing_quantity' => 1],
            ],
        ])->assertOk();

        // Drill: 2 back on the shelf, 1 damaged (not available, still owned).
        $this->assertStock($this->drill, 10, 9, 0);
        // Scaffold: 1 back on the shelf, 1 missing (written off).
        $this->assertStock($this->scaffold, 5, 5, 0);

        $this->assertSame('Returned', Rental::query()->find($rental['id'])->status);
        $this->assertDatabaseHas('rental_return_items', [
            'rental_item_id' => $this->itemId($rental, $this->drill->id),
            'product_id' => $this->drill->id,
            'returned_quantity' => 2, 'damaged_quantity' => 1, 'missing_quantity' => 0,
        ]);
        $this->assertDatabaseHas('rental_return_items', [
            'rental_item_id' => $this->itemId($rental, $this->scaffold->id),
            'product_id' => $this->scaffold->id,
            'returned_quantity' => 1, 'damaged_quantity' => 0, 'missing_quantity' => 1,
        ]);
    }

    public function test_aggregate_partial_returns_are_allocated_per_item_without_overflow(): void
    {
        $rental = $this->createRental(2, 3);
        $this->assertStock($this->drill, 10, 8, 2);
        $this->assertStock($this->scaffold, 6, 3, 3);

        // First partial return: 3 units → drill gets its 2, scaffold 1.
        $this->postJson("/api/rentals/{$rental['id']}/return", [
            'returned_quantity' => 3, 'damaged_quantity' => 0, 'missing_quantity' => 0, 'condition' => 'Good',
        ])->assertOk();

        $this->assertStock($this->drill, 10, 10, 0);
        $this->assertStock($this->scaffold, 6, 4, 2);
        $this->assertNotSame('Returned', Rental::query()->find($rental['id'])->status);

        // Second return: remaining 2 scaffold units, 1 returned + 1 missing.
        $response = $this->postJson("/api/rentals/{$rental['id']}/return", [
            'returned_quantity' => 1, 'damaged_quantity' => 0, 'missing_quantity' => 1, 'condition' => 'Good',
        ])->assertOk();

        $this->assertStock($this->drill, 10, 10, 0);
        $this->assertStock($this->scaffold, 5, 5, 0);
        $this->assertSame('Returned', Rental::query()->find($rental['id'])->status);
        $this->assertCount(2, $response->json('data.returns'));
        $this->assertSame('Test Scaffold', $response->json('data.returns.1.items.0.product_name'));

        // Nothing is left out on rent.
        $this->postJson("/api/rentals/{$rental['id']}/return", ['returned_quantity' => 1])->assertStatus(422);
    }

    public function test_return_exceeding_an_items_outstanding_quantity_is_rejected_without_changes(): void
    {
        $rental = $this->createRental(3, 2);

        $this->postJson("/api/rentals/{$rental['id']}/return", [
            'items' => [
                ['rental_item_id' => $this->itemId($rental, $this->scaffold->id), 'returned_quantity' => 3],
            ],
        ])->assertStatus(422)->assertJsonPath('errors', fn ($errors) => isset($errors['items.0']));

        $this->assertStock($this->drill, 10, 7, 3);
        $this->assertStock($this->scaffold, 6, 4, 2);
        $this->assertDatabaseCount('rental_returns', 0);
    }

    public function test_return_is_recorded_in_activity_and_audit_logs(): void
    {
        $rental = $this->createRental(1, 1);
        $this->postJson("/api/rentals/{$rental['id']}/return", ['returned_quantity' => 2, 'condition' => 'Good'])->assertOk();

        $this->assertTrue(ActivityLog::query()->where('module', 'rentals')->where('action', 'created')->exists());
        $this->assertTrue(AuditLog::query()->where('auditable_type', 'RentalReturn')->exists());

        $this->getJson('/api/activity-logs?module=rentals')
            ->assertOk()
            ->assertJsonStructure(['data' => ['data' => [['id', 'user_name', 'action', 'module', 'description', 'created_at']], 'meta', 'modules']]);
        $this->getJson('/api/audit-logs')->assertOk()->assertJsonStructure(['data' => ['data', 'meta', 'types']]);
    }

    public function test_audit_log_never_stores_passwords_or_tokens(): void
    {
        $user = User::factory()->create();
        $user->password = 'new-secret-password';
        $user->remember_token = 'token-value';
        $user->name = 'Renamed User';
        $user->save();

        foreach (AuditLog::query()->where('auditable_type', 'User')->get() as $log) {
            $blob = json_encode([$log->old_values, $log->new_values]);
            $this->assertStringNotContainsString('password', $blob);
            $this->assertStringNotContainsString('remember_token', $blob);
            $this->assertStringNotContainsString('token-value', $blob);
        }
    }

    public function test_settings_persist_and_are_validated(): void
    {
        $this->putJson('/api/settings', ['email' => 'not-an-email'])->assertStatus(422);

        $this->putJson('/api/settings', ['company_name' => 'Acme Hire', 'late_fee_per_day' => 1500])
            ->assertOk()
            ->assertJsonPath('data.company_name', 'Acme Hire');
        $this->getJson('/api/settings')->assertJsonPath('data.late_fee_per_day', 1500);
        $this->assertDatabaseHas('settings', ['key' => 'company_name']);

        $logged = ActivityLog::query()->where('module', 'settings')->count();
        $this->putJson('/api/settings', ['company_name' => 'Acme Hire', 'late_fee_per_day' => 1500, 'tax_rate' => 0, 'rental_deposit_percent' => 20])
            ->assertOk();
        $this->assertSame($logged, ActivityLog::query()->where('module', 'settings')->count(), 'Saving unchanged values must not log a change');
    }

    public function test_logo_upload_rejects_non_images(): void
    {
        Storage::fake('public');

        $this->post('/api/settings/logo', ['logo' => UploadedFile::fake()->create('logo.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertStatus(422);
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
        $this->post('/api/settings/logo', ['logo' => UploadedFile::fake()->createWithContent('logo.png', $png)], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.logo_url', fn ($url) => is_string($url) && str_contains($url, '/storage/settings/'));

        $this->deleteJson('/api/settings/logo')->assertOk()->assertJsonPath('data.logo_url', null);
    }

    public function test_staff_cannot_view_logs_or_change_settings(): void
    {
        $staffRole = Role::query()->where('name', 'Staff')->firstOrFail();
        $staff = User::factory()->create(['role_id' => $staffRole->id, 'role' => 'Staff']);
        Sanctum::actingAs($staff);

        $this->getJson('/api/activity-logs')->assertForbidden();
        $this->getJson('/api/audit-logs')->assertForbidden();
        $this->putJson('/api/settings', ['company_name' => 'Hijack'])->assertForbidden();
        $this->getJson('/api/settings')->assertOk();
    }
}
