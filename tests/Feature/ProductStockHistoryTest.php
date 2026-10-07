<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Product;
use App\Models\Role;
use App\Models\StockMovement;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductStockHistoryTest extends TestCase
{
    use RefreshDatabase;

    private Product $drill;

    private Product $mixer;

    private array $sale;

    private array $rental;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        Sanctum::actingAs(User::query()->where('email', 'admin@buildtrack.local')->firstOrFail());
        $customer = Customer::query()->create(['customer_code' => 'CUS-T1', 'name' => 'Test Customer']);

        $this->drill = $this->createProduct('DRL-1', 'Test Drill', 10);
        $this->mixer = $this->createProduct('MIX-1', 'Test Mixer', 5);

        $this->sale = $this->postJson('/api/sales', [
            'customer_id' => $customer->id,
            'sale_date' => now()->toDateString(),
            'sale_status' => 'Completed',
            'items' => [
                ['product_id' => $this->drill->id, 'quantity' => 2, 'unit_price' => 1000],
                ['product_id' => $this->mixer->id, 'quantity' => 1, 'unit_price' => 5000],
            ],
        ])->assertCreated()->json('data');

        $this->rental = $this->postJson('/api/rentals', [
            'customer_id' => $customer->id,
            'start_date' => now()->toDateString(),
            'expected_return_date' => now()->addDays(3)->toDateString(),
            'status' => 'Active',
            'items' => [['product_id' => $this->drill->id, 'quantity' => 4, 'rental_rate' => 500]],
        ])->assertCreated()->json('data');

        $this->postJson("/api/rentals/{$this->rental['id']}/return", [
            'return_date' => now()->toDateString(),
            'condition' => 'Good',
            'items' => [[
                'rental_item_id' => $this->rental['items'][0]['id'],
                'returned_quantity' => 2,
                'damaged_quantity' => 1,
                'missing_quantity' => 1,
            ]],
        ])->assertOk();

        $this->postJson("/api/products/{$this->drill->id}/adjust-stock", ['quantity_delta' => 3, 'reason' => 'Restock delivery'])
            ->assertSuccessful();
    }

    private function createProduct(string $serialNumber, string $name, int $qty): Product
    {
        $this->postJson('/api/products', [
            'serial_number' => $serialNumber,
            'name' => $name,
            'quantity' => $qty,
            'sale_price' => 1000,
            'rental_price' => 500,
            'purchase_price' => 800,
            'minimum_stock' => 1,
            'status' => 'Available',
        ])->assertCreated();

        return Product::query()->where('serial_number', $serialNumber)->firstOrFail();
    }

    private function actAs(string $roleSlug): void
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
    }

    public function test_product_history_contains_only_the_selected_products_movements(): void
    {
        $data = $this->getJson("/api/products/{$this->drill->id}/stock-history?per_page=100")->assertOk()->json('data');
        $rows = $data['movements']['data'];

        $this->assertNotEmpty($rows);
        $this->assertSame([$this->drill->id], array_values(array_unique(array_column($rows, 'product_id'))));
        $this->assertSame(
            StockMovement::query()->where('product_id', $this->drill->id)->count(),
            $data['movements']['total']
        );

        $types = array_column($rows, 'movement_type');
        foreach (['PURCHASE', 'SALE', 'RENTAL_OUT', 'RENTAL_RETURN', 'DAMAGE', 'MISSING', 'RESTOCK'] as $type) {
            $this->assertContains($type, $types, "{$type} movement should be listed");
        }

        $sale = collect($rows)->firstWhere('movement_type', 'SALE');
        $this->assertSame(-2, $sale['quantity']);
        $this->assertSame($this->sale['invoice_number'], $sale['reference_number']);
        $this->assertSame($this->sale['id'], $sale['related_sale']['id']);
        $this->assertNull($sale['related_rental']);

        $rentalOut = collect($rows)->firstWhere('movement_type', 'RENTAL_OUT');
        $this->assertSame(-4, $rentalOut['quantity']);
        $this->assertSame($this->rental['rental_number'], $rentalOut['related_rental']['rental_number']);

        $restock = collect($rows)->firstWhere('movement_type', 'RESTOCK');
        $this->assertSame(3, $restock['quantity']);
        $this->assertNull($restock['reference_number']);
        $this->assertSame('Restock delivery', $restock['notes']);

        foreach ($rows as $row) {
            $this->assertSame($row['new_quantity'], $row['balance']);
            $this->assertArrayHasKey('created_at', $row);
            $this->assertArrayHasKey('user', $row);
        }
    }

    public function test_summary_matches_database_values(): void
    {
        $data = $this->getJson("/api/products/{$this->drill->id}/stock-history")->assertOk()->json('data');
        $drill = $this->drill->fresh();
        $movements = StockMovement::query()->where('product_id', $drill->id)->get();

        $this->assertSame('Test Drill', $data['product']['name']);
        $this->assertSame('DRL-1', $data['product']['serial_number']);
        $this->assertSame((int) $drill->quantity, $data['summary']['current_stock']);
        $this->assertSame((int) $drill->available_quantity, $data['summary']['available_stock']);
        $this->assertSame((int) $movements->where('quantity', '>', 0)->sum('quantity'), $data['summary']['total_in']);
        $this->assertSame((int) abs($movements->where('quantity', '<', 0)->sum('quantity')), $data['summary']['total_out']);
        $this->assertSame($movements->count(), $data['summary']['movements_count']);
        $this->assertNotNull($data['summary']['last_movement_at']);
    }

    public function test_filters_and_pagination(): void
    {
        $sales = $this->getJson("/api/products/{$this->drill->id}/stock-history?movement_type=SALE")->assertOk()->json('data.movements');
        $this->assertSame(['SALE'], array_values(array_unique(array_column($sales['data'], 'movement_type'))));

        $page = $this->getJson("/api/products/{$this->drill->id}/stock-history?per_page=2")->assertOk()->json('data.movements');
        $this->assertCount(2, $page['data']);
        $this->assertGreaterThan(1, $page['last_page']);

        $this->getJson("/api/products/{$this->drill->id}/stock-history?from=not-a-date")->assertStatus(422);
    }

    public function test_summary_endpoint_returns_one_row_per_product(): void
    {
        $rows = collect($this->getJson('/api/stock-movements/summary')->assertOk()->json('data'))->keyBy('product_id');

        $this->assertCount(2, $rows);
        foreach ([$this->drill, $this->mixer] as $product) {
            $expected = StockMovement::query()->where('product_id', $product->id);
            $this->assertSame((clone $expected)->count(), $rows[$product->id]['movements_count']);
            $this->assertSame((int) (clone $expected)->where('quantity', '>', 0)->sum('quantity'), $rows[$product->id]['total_in']);
            $this->assertNotNull($rows[$product->id]['last_movement_at']);
        }
    }

    public function test_reading_history_does_not_change_movement_records(): void
    {
        $before = StockMovement::query()->orderBy('id')->get()->toArray();

        $this->getJson("/api/products/{$this->drill->id}/stock-history")->assertOk();
        $this->getJson('/api/stock-movements/summary')->assertOk();

        $this->assertSame($before, StockMovement::query()->orderBy('id')->get()->toArray());
    }

    public function test_endpoints_respect_authentication_and_permissions(): void
    {
        $this->getJson('/api/products/999999/stock-history')->assertNotFound();

        $this->actAs('staff');
        $this->getJson("/api/products/{$this->drill->id}/stock-history")->assertOk();
        $this->getJson('/api/stock-movements/summary')->assertOk();

        $this->actAs('accountant');
        $this->getJson("/api/products/{$this->drill->id}/stock-history")->assertForbidden();
        $this->getJson('/api/stock-movements/summary')->assertForbidden();

        $this->app['auth']->forgetGuards();
        $this->flushHeaders();
        $this->getJson("/api/products/{$this->drill->id}/stock-history")->assertUnauthorized();
    }
}
