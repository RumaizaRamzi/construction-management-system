<?php

namespace Tests\Feature;

use App\Console\Commands\ClearDemoDataCommand;
use App\Models\Customer;
use App\Models\Product;
use App\Models\User;
use App\Services\SettingService;
use Database\Seeders\DemoDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClearDemoDataCommandTest extends TestCase
{
    use RefreshDatabase;

    private const PROMPT = 'Permanently delete these records? Make sure you have a database backup.';

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DemoDataSeeder::class);
        $this->admin = User::query()->where('email', 'admin@buildtrack.local')->firstOrFail();

        // Extra records in tables the demo seeder does not fill (sale payments, return items, logs).
        Sanctum::actingAs($this->admin);
        $sale = $this->postJson('/api/sales', [
            'customer_id' => Customer::query()->value('id'),
            'sale_date' => now()->toDateString(),
            'sale_status' => 'Completed',
            'paid_amount' => 100,
            'items' => [['product_id' => Product::query()->value('id'), 'quantity' => 1, 'unit_price' => 1000]],
        ])->assertCreated()->json('data');
        $this->postJson("/api/sales/{$sale['id']}/payments", ['amount' => 100])->assertCreated();

        $rental = $this->postJson('/api/rentals', [
            'customer_id' => Customer::query()->value('id'),
            'start_date' => now()->toDateString(),
            'expected_return_date' => now()->addDays(2)->toDateString(),
            'status' => 'Active',
            'items' => [['product_id' => Product::query()->where('available_quantity', '>', 1)->value('id'), 'quantity' => 1, 'rental_rate' => 500]],
        ])->assertCreated()->json('data');
        $this->postJson("/api/rentals/{$rental['id']}/return", [
            'return_date' => now()->toDateString(),
            'condition' => 'Good',
            'items' => [['rental_item_id' => $rental['items'][0]['id'], 'returned_quantity' => 1]],
        ])->assertOk();

        Artisan::call('notifications:generate');
        app(SettingService::class)->update(['tax_rate' => 8, 'invoice_prefix' => 'INV-']);
    }

    /** @return array<string, int> */
    private function businessCounts(): array
    {
        return collect(array_keys(ClearDemoDataCommand::BUSINESS_TABLES))
            ->mapWithKeys(fn ($t) => [$t => DB::table($t)->count()])
            ->all();
    }

    /** @return array<string, int> */
    private function preservedCounts(): array
    {
        return collect(['users', 'roles', 'permissions', 'role_permissions', 'settings'])
            ->mapWithKeys(fn ($t) => [$t => DB::table($t)->count()])
            ->all();
    }

    public function test_it_refuses_to_run_in_production(): void
    {
        $before = $this->businessCounts();
        $this->app['env'] = 'production';

        $this->artisan('buildtrack:clear-demo-data', ['--confirm' => true])
            ->expectsOutputToContain('Refusing to run')
            ->assertFailed();

        $this->assertSame($before, $this->businessCounts());
    }

    public function test_it_requires_explicit_confirmation(): void
    {
        $before = $this->businessCounts();

        $this->artisan('buildtrack:clear-demo-data')
            ->expectsConfirmation(self::PROMPT, 'no')
            ->expectsOutputToContain('Cancelled. Nothing was deleted.')
            ->assertFailed();

        $this->assertSame($before, $this->businessCounts());
    }

    public function test_dry_run_only_reports_counts(): void
    {
        $before = $this->businessCounts();

        $this->artisan('buildtrack:clear-demo-data', ['--dry-run' => true, '--confirm' => true])
            ->expectsOutputToContain('Dry run only. Nothing was deleted.')
            ->assertSuccessful();

        $this->assertSame($before, $this->businessCounts());
    }

    public function test_confirmed_run_removes_business_data_and_preserves_system_data(): void
    {
        $before = $this->businessCounts();
        foreach (['products', 'customers', 'suppliers', 'sales', 'sale_payments', 'rentals', 'rental_return_items', 'bookings', 'income', 'expenses', 'notifications', 'stock_movements', 'activity_logs'] as $table) {
            $this->assertGreaterThan(0, $before[$table], "Fixture should contain {$table} records");
        }
        $preserved = $this->preservedCounts();
        $adminHash = $this->admin->password;
        $adminName = $this->admin->name;
        $settingsBefore = DB::table('settings')->orderBy('key')->pluck('value', 'key')->all();

        $this->artisan('buildtrack:clear-demo-data', ['--confirm' => true])->assertSuccessful();

        // Business data gone (the only remaining log rows are the cleanup's own audit trail).
        foreach ($this->businessCounts() as $table => $count) {
            if (in_array($table, ['activity_logs', 'audit_logs'], true)) {
                continue;
            }
            $this->assertSame(0, $count, "{$table} should be empty");
        }
        $this->assertSame(1, DB::table('activity_logs')->count());
        $this->assertDatabaseHas('activity_logs', ['action' => 'cleared', 'module' => 'system']);

        // Users, roles, permissions and settings untouched.
        $this->assertSame($preserved, $this->preservedCounts());
        $admin = $this->admin->fresh();
        $this->assertSame($adminHash, $admin->password);
        $this->assertSame($adminName, $admin->name);
        $this->assertNotNull($admin->role_id);
        $this->assertSame($settingsBefore, DB::table('settings')->orderBy('key')->pluck('value', 'key')->all());

        // Schema intact.
        foreach ([...array_keys(ClearDemoDataCommand::BUSINESS_TABLES), ...ClearDemoDataCommand::PRESERVED_TABLES] as $table) {
            $this->assertTrue(Schema::hasTable($table), "{$table} table should still exist");
        }
        $this->assertTrue(Schema::hasColumns('products', ['serial_number', 'name', 'quantity', 'available_quantity', 'minimum_stock']));
        $this->assertTrue(Schema::hasColumns('sale_payments', ['sale_id', 'amount', 'payment_date']));
    }

    public function test_interactive_yes_also_clears_data(): void
    {
        $this->artisan('buildtrack:clear-demo-data')
            ->expectsConfirmation(self::PROMPT, 'yes')
            ->assertSuccessful();

        $this->assertSame(0, Product::query()->count());
        $this->assertSame(0, Customer::query()->count());
    }

    public function test_application_logs_in_and_shows_empty_state_after_cleanup(): void
    {
        $this->artisan('buildtrack:clear-demo-data', ['--confirm' => true])->assertSuccessful();
        $this->app['auth']->forgetGuards();

        $token = $this->postJson('/api/auth/login', ['email' => 'admin@buildtrack.local', 'password' => 'password'])
            ->assertOk()
            ->json('data.token');
        $this->assertNotEmpty($token);
        $auth = ['Authorization' => "Bearer {$token}"];

        $this->getJson('/api/auth/me', $auth)->assertOk()->assertJsonPath('data.email', 'admin@buildtrack.local');

        foreach (['/api/products', '/api/customers', '/api/suppliers', '/api/sales', '/api/rentals', '/api/bookings', '/api/income', '/api/expenses'] as $url) {
            $data = $this->getJson($url, $auth)->assertOk()->json('data');
            $rows = $data['data'] ?? $data;
            $this->assertCount(0, $rows, "{$url} should return no records");
        }

        $dashboard = $this->getJson('/api/reports/dashboard', $auth)->assertOk()->json('data');
        $this->assertEquals(0, $dashboard['summary']['total_products']);
        $this->assertEquals(0, $dashboard['summary']['total_sales']);
        $this->assertEquals(0, $dashboard['summary']['total_rental_income']);
        $this->assertEquals(0, $dashboard['summary']['total_income']);
        $this->assertSame([], $dashboard['recent_sales']);
        $this->assertSame([], $dashboard['recent_rentals']);
        $this->assertSame([], $dashboard['low_stock']);
        // Every chart point is zero, so the UI renders its "No data recorded" empty state.
        foreach (['sales_vs_rental', 'monthly_revenue', 'income_vs_expenses', 'product_usage', 'rental_activity'] as $chart) {
            foreach ($dashboard['charts'][$chart] as $row) {
                foreach ($row as $key => $value) {
                    if (is_numeric($value) && ! in_array($key, ['month', 'day', 'label', 'name'], true)) {
                        $this->assertEquals(0, $value, "{$chart}.{$key} should be zero");
                    }
                }
            }
        }

        Artisan::call('notifications:generate');
        $this->assertSame(0, DB::table('notifications')->count());

        // Company settings stay as they were (no invented data added).
        $settings = $this->getJson('/api/settings', $auth)->assertOk()->json('data');
        $this->assertSame('', $settings['company_name']);
        $this->assertEquals(8, $settings['tax_rate']);
        $this->assertSame('INV-', $settings['invoice_prefix']);
    }
}
