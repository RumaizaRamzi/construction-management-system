<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Role;
use App\Models\StockMovement;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductTransferToSaleTest extends TestCase
{
    use RefreshDatabase;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        Sanctum::actingAs(User::query()->where('email', 'admin@buildtrack.local')->firstOrFail());
        $this->customer = Customer::query()->create(['customer_code' => 'CUS-T1', 'name' => 'Test Customer']);
    }

    private function rentProduct(array $overrides = []): Product
    {
        $id = $this->postJson('/api/products', array_merge([
            'serial_number' => 'RNT-1',
            'name' => 'Test Mixer',
            'quantity' => 4,
            'purchase_price' => 800,
            'sale_price' => 0,
            'rental_price' => 500,
            'listing_type' => 'rent',
        ], $overrides))->assertCreated()->json('data.id');

        return Product::query()->findOrFail($id);
    }

    private function rent(Product $product, int $qty, string $status = 'Active'): array
    {
        return $this->postJson('/api/rentals', [
            'customer_id' => $this->customer->id,
            'start_date' => now()->toDateString(),
            'expected_return_date' => now()->addDays(3)->toDateString(),
            'status' => $status,
            'items' => [['product_id' => $product->id, 'quantity' => $qty, 'rental_rate' => 500]],
        ])->assertCreated()->json('data');
    }

    public function test_existing_and_default_products_stay_available_for_sale_and_rent(): void
    {
        $id = $this->postJson('/api/products', [
            'serial_number' => 'BOTH-1',
            'name' => 'Legacy Drill',
            'quantity' => 5,
            'sale_price' => 1000,
            'rental_price' => 200,
        ])->assertCreated()->assertJsonPath('data.listing_type', 'both')->json('data.id');
        $product = Product::query()->findOrFail($id);

        $this->postJson('/api/sales', [
            'customer_id' => $this->customer->id,
            'sale_date' => now()->toDateString(),
            'sale_status' => 'Completed',
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'unit_price' => 1000]],
        ])->assertCreated();
        $this->rent($product, 1);
    }

    public function test_transfer_moves_the_same_record_to_sales_inventory_and_keeps_history(): void
    {
        $product = $this->rentProduct();
        $rental = $this->rent($product, 2);
        $this->postJson("/api/rentals/{$rental['id']}/return", [
            'return_date' => now()->toDateString(),
            'condition' => 'Good',
            'items' => [['rental_item_id' => $rental['items'][0]['id'], 'returned_quantity' => 2]],
        ])->assertOk();

        $movementsBefore = StockMovement::query()->where('product_id', $product->id)->count();
        $productCount = Product::query()->count();

        $data = $this->postJson("/api/products/{$product->id}/transfer-to-sale", ['sale_price' => 2500])
            ->assertOk()
            ->assertJsonPath('data.id', $product->id)
            ->assertJsonPath('data.listing_type', 'sale')
            ->json('data');

        $this->assertSame(2500.0, (float) $data['sale_price']);
        $this->assertSame(4, $data['quantity']);
        $this->assertSame(4, $data['available_quantity']);
        $this->assertSame('RNT-1', $data['serial_number']);
        $this->assertSame(500.0, (float) $data['rental_price']);
        $this->assertSame($productCount, Product::query()->count());

        $movements = StockMovement::query()->where('product_id', $product->id)->orderBy('id')->get();
        $this->assertCount($movementsBefore + 1, $movements);
        $this->assertSame('TRANSFER_TO_SALE', $movements->last()->movement_type);
        $this->assertSame(0, (int) $movements->last()->quantity);
        $this->getJson("/api/rentals/{$rental['id']}")->assertOk()->assertJsonPath('data.id', $rental['id']);

        $this->assertTrue(ActivityLog::query()->where('action', 'transferred_to_sale')->where('subject_id', $product->id)->exists());
        $audit = AuditLog::query()->where('action', 'transferred_to_sale')->where('auditable_id', $product->id)->firstOrFail();
        $this->assertSame('rent', $audit->old_values['listing_type']);
        $this->assertSame('sale', $audit->new_values['listing_type']);
    }

    public function test_transferred_product_can_be_sold_but_not_rented_or_booked(): void
    {
        $product = $this->rentProduct(['sale_price' => 1500]);

        $this->postJson('/api/sales', [
            'customer_id' => $this->customer->id,
            'sale_date' => now()->toDateString(),
            'sale_status' => 'Completed',
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'unit_price' => 1500]],
        ])->assertStatus(422);

        $this->postJson("/api/products/{$product->id}/transfer-to-sale")->assertOk();

        $this->postJson('/api/sales', [
            'customer_id' => $this->customer->id,
            'sale_date' => now()->toDateString(),
            'sale_status' => 'Completed',
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'unit_price' => 1500]],
        ])->assertCreated();
        $this->assertSame(3, (int) $product->fresh()->available_quantity);

        $this->postJson('/api/rentals', [
            'customer_id' => $this->customer->id,
            'start_date' => now()->toDateString(),
            'expected_return_date' => now()->addDays(3)->toDateString(),
            'status' => 'Active',
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'rental_rate' => 500]],
        ])->assertStatus(422);

        $this->postJson('/api/bookings', [
            'customer_id' => $this->customer->id,
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(7)->toDateString(),
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'rental_rate' => 500]],
        ])->assertStatus(422);

        $this->postJson("/api/products/{$product->id}/transfer-to-sale")
            ->assertStatus(422)
            ->assertJsonPath('errors.product.0', 'Test Mixer is already listed for sale.');
    }

    public function test_transfer_is_blocked_while_units_are_rented_or_booked(): void
    {
        $product = $this->rentProduct(['sale_price' => 1500]);
        $rental = $this->rent($product, 1);

        $this->postJson("/api/products/{$product->id}/transfer-to-sale")
            ->assertStatus(422)
            ->assertJsonValidationErrors('product');
        $this->assertSame('rent', $product->fresh()->listing_type);

        $this->postJson("/api/rentals/{$rental['id']}/return", [
            'return_date' => now()->toDateString(),
            'condition' => 'Good',
            'items' => [['rental_item_id' => $rental['items'][0]['id'], 'returned_quantity' => 1]],
        ])->assertOk();

        $this->postJson('/api/bookings', [
            'customer_id' => $this->customer->id,
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(7)->toDateString(),
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'rental_rate' => 500]],
        ])->assertCreated();

        $this->postJson("/api/products/{$product->id}/transfer-to-sale")
            ->assertStatus(422)
            ->assertJsonValidationErrors('product');
        $this->assertSame('rent', $product->fresh()->listing_type);
    }

    public function test_transfer_requires_a_positive_sale_price(): void
    {
        $product = $this->rentProduct(['sale_price' => 0]);

        $this->postJson("/api/products/{$product->id}/transfer-to-sale")
            ->assertStatus(422)
            ->assertJsonValidationErrors('sale_price');
        $this->postJson("/api/products/{$product->id}/transfer-to-sale", ['sale_price' => -5])
            ->assertStatus(422)
            ->assertJsonValidationErrors('sale_price');
        $this->assertSame('rent', $product->fresh()->listing_type);
    }

    public function test_listing_type_cannot_be_changed_through_the_regular_update(): void
    {
        $product = $this->rentProduct(['sale_price' => 1500]);

        $this->putJson("/api/products/{$product->id}", ['listing_type' => 'sale', 'name' => 'Renamed'])->assertOk();

        $this->assertSame('rent', $product->fresh()->listing_type);
        $this->assertSame('Renamed', $product->fresh()->name);
    }

    public function test_transfer_requires_products_update_permission(): void
    {
        $product = $this->rentProduct(['sale_price' => 1500]);

        $role = Role::query()->create(['name' => 'Viewer', 'slug' => 'viewer-test', 'description' => 'Test role']);
        $user = User::query()->create([
            'name' => 'Viewer',
            'email' => 'viewer@example.test',
            'password' => 'password',
            'status' => 'Active',
        ]);
        $user->role_id = $role->id;
        $user->role = $role->name;
        $user->save();
        Sanctum::actingAs($user);

        $this->postJson("/api/products/{$product->id}/transfer-to-sale")->assertForbidden();
        $this->assertSame('rent', $product->fresh()->listing_type);
    }
}
