<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Notification;
use App\Models\Product;
use App\Models\Role;
use App\Models\Sale;
use App\Models\User;
use App\Services\SettingService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BusinessRulesTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        $this->admin = User::query()->where('email', 'admin@buildtrack.local')->firstOrFail();
        Sanctum::actingAs($this->admin);
        $this->customer = Customer::query()->create(['customer_code' => 'CUS-T1', 'name' => 'Test Customer']);
    }

    private function product(string $serialNumber, int $qty, float $price = 1000, int $minimum = 0): Product
    {
        return Product::query()->create([
            'serial_number' => $serialNumber,
            'name' => 'Test '.$serialNumber,
            'quantity' => $qty,
            'available_quantity' => $qty,
            'rented_quantity' => 0,
            'sale_price' => $price,
            'rental_price' => $price,
            'minimum_stock' => $minimum,
            'status' => 'Available',
        ]);
    }

    private function actAs(string $roleSlug): User
    {
        $role = Role::query()->where('slug', $roleSlug)->firstOrFail();
        $user = User::query()->create([
            'name' => ucfirst($roleSlug).' Tester',
            'email' => $roleSlug.'@test.local',
            'password' => 'password',
            'status' => 'Active',
        ]);
        $user->role_id = $role->id;
        $user->role = $role->name;
        $user->save();
        Sanctum::actingAs($user);

        return $user;
    }

    private function createSale(Product $product, int $qty, array $extra = []): array
    {
        return $this->postJson('/api/sales', array_merge([
            'customer_id' => $this->customer->id,
            'sale_date' => now()->toDateString(),
            'sale_status' => 'Completed',
            'items' => [['product_id' => $product->id, 'quantity' => $qty, 'unit_price' => 1000]],
        ], $extra))->assertCreated()->json('data');
    }

    private function createRental(array $items, array $extra = []): array
    {
        return $this->postJson('/api/rentals', array_merge([
            'customer_id' => $this->customer->id,
            'start_date' => now()->toDateString(),
            'expected_return_date' => now()->addDays(3)->toDateString(),
            'status' => 'Active',
            'items' => $items,
        ], $extra))->assertCreated()->json('data');
    }

    public function test_invoice_number_uses_configured_prefix(): void
    {
        $product = $this->product('P1', 10);
        app(SettingService::class)->update(['invoice_prefix' => 'BT-']);

        $year = now()->year;
        $this->assertSame("BT-{$year}-001", $this->createSale($product, 1)['invoice_number']);
        $this->assertSame("BT-{$year}-002", $this->createSale($product, 1)['invoice_number']);
    }

    public function test_settings_tax_rate_applies_to_new_sales_but_not_retroactively(): void
    {
        $product = $this->product('P1', 10);
        app(SettingService::class)->update(['tax_rate' => 10]);

        $sale = $this->createSale($product, 2);
        $this->assertEquals(200.0, $sale['tax']);
        $this->assertEquals(2200.0, $sale['total_amount']);

        // Settings change must not re-tax the existing sale when it is edited.
        app(SettingService::class)->update(['tax_rate' => 0]);
        $updated = $this->putJson("/api/sales/{$sale['id']}", [
            'items' => [['product_id' => $product->id, 'quantity' => 3, 'unit_price' => 1000]],
        ])->assertOk()->json('data');
        $this->assertEquals(300.0, $updated['tax']);
        $this->assertEquals(3300.0, $updated['total_amount']);

        // Explicit rate from the form wins; totals shown match the DB row.
        $explicit = $this->createSale($product, 1, ['tax_rate' => 5]);
        $row = Sale::query()->find($explicit['id']);
        $this->assertEquals(50.0, (float) $row->tax);
        $this->assertEquals((float) $row->total_amount, $explicit['total_amount']);
    }

    public function test_partial_and_multiple_sale_payments_keep_totals_consistent(): void
    {
        $product = $this->product('P1', 10);
        $sale = $this->createSale($product, 1, ['paid_amount' => 300, 'payment_method' => 'Cash']);
        $this->assertSame('Partial', $sale['payment_status']);
        $this->assertCount(1, $sale['payments']);

        $afterSecond = $this->postJson("/api/sales/{$sale['id']}/payments", [
            'amount' => 200, 'payment_method' => 'Bank Transfer', 'reference' => 'TRX-1',
        ])->assertCreated()->json('data');
        $this->assertEquals(500.0, $afterSecond['paid_amount']);
        $this->assertEquals(500.0, $afterSecond['balance']);
        $this->assertSame('Partial', $afterSecond['payment_status']);
        $this->assertCount(2, $afterSecond['payments']);
        $this->assertSame('TRX-1', $afterSecond['payments'][1]['reference']);

        $this->postJson("/api/sales/{$sale['id']}/payments", ['amount' => 600])->assertStatus(422);

        $final = $this->postJson("/api/sales/{$sale['id']}/payments", ['amount' => 500])
            ->assertCreated()->json('data');
        $this->assertEquals(1000.0, $final['paid_amount']);
        $this->assertEquals(0.0, $final['balance']);
        $this->assertSame('Paid', $final['payment_status']);
        $this->assertCount(3, $final['payments']);
        $this->assertEquals(1000.0, array_sum(array_column($final['payments'], 'amount')));
        $this->assertEquals(0.0, $final['unrecorded_paid_amount']);
    }

    public function test_multi_product_return_keeps_damaged_and_missing_out_of_available_stock(): void
    {
        $mixer = $this->product('MIX', 10);
        $drill = $this->product('DRL', 6);
        $grinder = $this->product('GRD', 5);

        $rental = $this->createRental([
            ['product_id' => $mixer->id, 'quantity' => 4, 'rental_rate' => 1000],
            ['product_id' => $drill->id, 'quantity' => 3, 'rental_rate' => 500],
            ['product_id' => $grinder->id, 'quantity' => 2, 'rental_rate' => 300],
        ]);
        $itemId = fn (Product $p) => collect($rental['items'])->firstWhere('product_id', $p->id)['id'];

        $this->postJson("/api/rentals/{$rental['id']}/return", [
            'return_date' => now()->toDateString(),
            'condition' => 'Good',
            'items' => [
                ['rental_item_id' => $itemId($mixer), 'returned_quantity' => 2, 'damaged_quantity' => 1, 'missing_quantity' => 1],
                ['rental_item_id' => $itemId($drill), 'returned_quantity' => 3],
                ['rental_item_id' => $itemId($grinder), 'damaged_quantity' => 2],
            ],
        ])->assertOk();

        $stock = fn (Product $p) => [(int) $p->fresh()->quantity, (int) $p->fresh()->available_quantity, (int) $p->fresh()->rented_quantity];
        // Mixer: 6 on shelf + 2 returned = 8; 1 damaged held; 1 missing written off.
        $this->assertSame([9, 8, 0], $stock($mixer));
        $this->assertSame([6, 6, 0], $stock($drill));
        // Grinder: both damaged → neither becomes available.
        $this->assertSame([5, 3, 0], $stock($grinder));

        foreach ([$mixer, $drill, $grinder] as $p) {
            $fresh = $p->fresh();
            $this->assertLessThanOrEqual((int) $fresh->quantity - (int) $fresh->rented_quantity, (int) $fresh->available_quantity);
        }

        $this->assertDatabaseHas('rental_return_items', ['product_id' => $mixer->id, 'returned_quantity' => 2, 'damaged_quantity' => 1, 'missing_quantity' => 1]);
        $this->assertDatabaseHas('rental_return_items', ['product_id' => $grinder->id, 'returned_quantity' => 0, 'damaged_quantity' => 2, 'missing_quantity' => 0]);
    }

    public function test_cancelled_rentals_are_excluded_from_rental_income(): void
    {
        $product = $this->product('GEN', 10);
        $kept = $this->createRental([['product_id' => $product->id, 'quantity' => 1, 'rental_rate' => 1000]]);
        $cancelled = $this->createRental([['product_id' => $product->id, 'quantity' => 2, 'rental_rate' => 5000]]);

        $this->putJson("/api/rentals/{$cancelled['id']}", ['status' => 'Cancelled'])->assertOk();

        $range = ['from' => now()->startOfYear()->toDateString(), 'to' => now()->endOfYear()->toDateString()];
        $dashboard = $this->getJson('/api/reports/dashboard?'.http_build_query($range))->assertOk()->json('data.summary');
        $this->assertEquals((float) $kept['total_amount'], $dashboard['total_rental_income']);

        $report = $this->getJson('/api/reports/rentals?'.http_build_query($range))->assertOk()->json('data');
        $this->assertEquals((float) $kept['total_amount'], $report['summary']['total_rental_income']);
        $this->assertSame(2, $report['summary']['total_rentals']);
        $this->assertSame(1, $report['summary']['cancelled_rentals']);
    }

    public function test_dismissed_notifications_are_not_recreated_by_the_generator(): void
    {
        $this->product('LOW', 1, 1000, 5);

        Artisan::call('notifications:generate');
        $notification = Notification::query()->where('type', 'Low Stock')->firstOrFail();

        $this->postJson("/api/notifications/{$notification->id}/dismiss")->assertOk();

        Artisan::call('notifications:generate');
        Artisan::call('notifications:generate');

        $this->assertSame(1, Notification::query()->where('type', 'Low Stock')->count());
        $this->assertSame(Notification::STATUS_DISMISSED, $notification->fresh()->status);
    }

    public function test_search_respects_module_permissions(): void
    {
        $this->actAs('staff');

        $this->getJson('/api/search?q=test&type=income')->assertForbidden();
        $this->getJson('/api/search?q=test&type=expenses')->assertForbidden();
        $this->getJson('/api/search?q=test&type=products')->assertOk();

        $types = collect($this->getJson('/api/search?q=test')->assertOk()->json('data.results'))->pluck('type')->unique();
        $this->assertNotContains('Income', $types);
        $this->assertNotContains('Expense', $types);
    }

    public function test_settings_read_is_limited_for_non_managers(): void
    {
        $full = $this->getJson('/api/settings')->assertOk()->json('data');
        $this->assertArrayHasKey('sms_notifications', $full);
        $this->assertArrayHasKey('missing_client_data', $full);

        $this->actAs('staff');
        $limited = $this->getJson('/api/settings')->assertOk()->json('data');
        $this->assertArrayHasKey('company_name', $limited);
        $this->assertArrayHasKey('tax_rate', $limited);
        $this->assertArrayNotHasKey('sms_notifications', $limited);
        $this->assertSame(['company_name', 'address', 'phone', 'email'], $limited['missing_client_data']);
        $this->putJson('/api/settings', ['tax_rate' => 5])->assertForbidden();
        $this->postJson('/api/settings/logo', [])->assertForbidden();
    }

    public function test_holiday_overrides_are_saved_normalized_and_readable_by_all_users(): void
    {
        $this->assertSame([], $this->getJson('/api/settings')->json('data.holiday_overrides'));

        $saved = $this->putJson('/api/settings', [
            'holiday_overrides' => [
                ['action' => 'add', 'date' => '2026-06-30', 'name' => 'Poson Full Moon Poya Day', 'kind' => 'poya'],
                ['action' => 'remove', 'date' => '2026-06-29', 'name' => 'Poson Full Moon Poya Day', 'kind' => 'poya'],
                ['action' => 'add', 'date' => '2026-03-02', 'name' => '  Special Bank Holiday  '],
            ],
        ])->assertOk()->json('data.holiday_overrides');

        $this->assertSame([
            ['action' => 'add', 'date' => '2026-03-02', 'name' => 'Special Bank Holiday', 'kind' => 'public'],
            ['action' => 'remove', 'date' => '2026-06-29', 'name' => 'Poson Full Moon Poya Day', 'kind' => 'poya'],
            ['action' => 'add', 'date' => '2026-06-30', 'name' => 'Poson Full Moon Poya Day', 'kind' => 'poya'],
        ], $saved);

        $this->putJson('/api/settings', ['holiday_overrides' => [['action' => 'move', 'date' => '2026-13-01', 'name' => '']]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['holiday_overrides.0.action', 'holiday_overrides.0.date', 'holiday_overrides.0.name']);

        $this->putJson('/api/settings', ['tax_rate' => 4])->assertOk();
        $this->assertCount(3, $this->getJson('/api/settings')->json('data.holiday_overrides'));

        $this->actAs('staff');
        $this->assertCount(3, $this->getJson('/api/settings')->assertOk()->json('data.holiday_overrides'));
        $this->putJson('/api/settings', ['holiday_overrides' => []])->assertForbidden();
    }

    public function test_financial_reports_and_exports_follow_permissions(): void
    {
        $this->actAs('staff');
        $this->getJson('/api/reports/financial')->assertForbidden();
        $this->postJson('/api/reports/export', ['report' => 'sales-report', 'format' => 'csv'])->assertForbidden();
        $dashboard = $this->getJson('/api/reports/dashboard')->assertOk()->json('data');
        $this->assertNull($dashboard['summary']['total_income']);
        $this->assertNull($dashboard['summary']['total_expenses']);
        $this->assertNull($dashboard['summary']['net_cash_flow']);
        $this->assertSame([], $dashboard['charts']['income_vs_expenses']);
        $this->getJson('/api/reports/sales')->assertOk();

        $this->actAs('accountant');
        $this->getJson('/api/reports/financial')->assertOk();
        $this->postJson('/api/reports/export', ['report' => 'financial-report', 'format' => 'excel'])->assertOk();
        $this->assertNotNull($this->getJson('/api/reports/dashboard')->json('data.summary.total_income'));
        $this->assertDatabaseHas('activity_logs', ['module' => 'reports', 'action' => 'exported']);
    }

    public function test_admin_and_manager_keep_full_report_access(): void
    {
        $this->getJson('/api/reports/financial')->assertOk();
        $this->postJson('/api/reports/export', ['report' => 'rental-report', 'format' => 'csv'])->assertOk();

        $this->actAs('manager');
        $this->getJson('/api/reports/financial')->assertOk();
        $this->postJson('/api/reports/export', ['report' => 'rental-report', 'format' => 'csv'])->assertOk();
        $this->getJson('/api/search?q=test&type=income')->assertOk();
        $this->assertArrayHasKey('sms_notifications', $this->getJson('/api/settings')->json('data'));
    }
}
