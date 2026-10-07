<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Role;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PurchaseModuleTest extends TestCase
{
    use RefreshDatabase;

    private Supplier $supplier;

    private Category $category;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        Sanctum::actingAs(User::query()->where('email', 'admin@buildtrack.local')->firstOrFail());
        $this->supplier = Supplier::query()->create(['supplier_code' => 'SUP-T1', 'name' => 'Test Supplier', 'status' => 'Active']);
        $this->category = Category::query()->create(['name' => 'Test Tools']);
        $this->customer = Customer::query()->create(['customer_code' => 'CUS-P1', 'name' => 'Purchase Customer']);
    }

    private function existingProduct(array $overrides = []): Product
    {
        $id = $this->postJson('/api/products', array_merge([
            'serial_number' => 'EX-'.uniqid(),
            'name' => 'Existing Mixer',
            'quantity' => 5,
            'sale_price' => 1500,
            'rental_price' => 300,
            'purchase_price' => 900,
        ], $overrides))->assertCreated()->json('data.id');

        return Product::query()->findOrFail($id);
    }

    private function purchase(array $items, array $overrides = [])
    {
        return $this->postJson('/api/purchases', array_merge([
            'supplier_id' => $this->supplier->id,
            'purchase_date' => now()->toDateString(),
            'bill_number' => 'BILL-77',
            'payment_type' => 'Credit',
            'paid_amount' => 0,
            'items' => $items,
        ], $overrides));
    }

    private function newItem(array $overrides = []): array
    {
        return array_merge([
            'mode' => 'new',
            'name' => 'Brand New Drill',
            'serial_number' => 'nd-'.uniqid(),
            'category_id' => $this->category->id,
            'quantity' => 4,
            'unit_cost' => 250,
        ], $overrides);
    }

    public function test_new_product_without_listing_is_created_unlisted_with_stock_and_history(): void
    {
        $purchase = $this->purchase([$this->newItem(['serial_number' => 'nd-100'])])->assertCreated()->json('data');

        $this->assertSame('Completed', $purchase['status']);
        $this->assertEquals(1000, $purchase['total_amount']);
        $this->assertEquals(1000, $purchase['balance']);
        $this->assertSame('Unpaid', $purchase['payment_status']);
        $this->assertTrue($purchase['items'][0]['is_new_product']);

        $product = Product::query()->where('serial_number', 'ND-100')->firstOrFail();
        $this->assertSame(Product::LISTING_NONE, $product->listing_type);
        $this->assertSame(4, (int) $product->quantity);
        $this->assertSame(4, (int) $product->available_quantity);
        $this->assertEquals(250, (float) $product->purchase_price);
        $this->assertSame($this->supplier->id, $product->supplier_id);
        $this->assertNull($product->sale_price);

        $movement = StockMovement::query()->where('product_id', $product->id)->sole();
        $this->assertSame('PURCHASE', $movement->movement_type);
        $this->assertSame(4, (int) $movement->quantity);
        $this->assertStringContainsString('Test Supplier', $movement->reason);
        $this->assertStringContainsString('BILL-77', $movement->reason);

        $history = $this->getJson("/api/products/{$product->id}/stock-history")->assertOk()->json('data.movements.data.0');
        $this->assertSame($purchase['purchase_number'], $history['reference_number']);

        $this->assertTrue(ActivityLog::query()->where('module', 'purchases')->where('action', 'created')->exists());
        $this->assertTrue(AuditLog::query()->where('auditable_type', 'Purchase')->where('action', 'created')->exists());
    }

    public function test_listing_choice_sets_listing_type_and_prices(): void
    {
        $this->purchase([
            $this->newItem(['serial_number' => 'nd-sale', 'listing_type' => 'sale', 'sale_price' => 400]),
            $this->newItem(['serial_number' => 'nd-rent', 'listing_type' => 'rent', 'rental_price' => 60]),
            $this->newItem(['serial_number' => 'nd-both', 'listing_type' => 'both', 'sale_price' => 500, 'rental_price' => 70]),
        ])->assertCreated();

        $sale = Product::query()->where('serial_number', 'ND-SALE')->firstOrFail();
        $this->assertSame('sale', $sale->listing_type);
        $this->assertEquals(400, (float) $sale->sale_price);
        $this->assertSame('rent', Product::query()->where('serial_number', 'ND-RENT')->value('listing_type'));
        $this->assertSame('both', Product::query()->where('serial_number', 'ND-BOTH')->value('listing_type'));

        $this->purchase([$this->newItem(['serial_number' => 'nd-sale-noprice', 'listing_type' => 'sale'])])->assertCreated();
        $this->purchase([$this->newItem(['serial_number' => 'nd-rent-noprice', 'listing_type' => 'rent'])])->assertCreated();
        $this->assertNull(Product::query()->where('serial_number', 'ND-SALE-NOPRICE')->value('sale_price'));
        $this->assertNull(Product::query()->where('serial_number', 'ND-RENT-NOPRICE')->value('rental_price'));
    }

    public function test_existing_product_restock_keeps_listing_and_updates_cost(): void
    {
        $product = $this->existingProduct();

        $this->purchase([['mode' => 'existing', 'product_id' => $product->id, 'quantity' => 3, 'unit_cost' => 950]], [
            'payment_type' => 'Paid',
            'paid_amount' => null,
        ])->assertCreated()->assertJsonPath('data.payment_status', 'Paid')->assertJsonPath('data.balance', 0);

        $product->refresh();
        $this->assertSame(8, (int) $product->quantity);
        $this->assertSame(8, (int) $product->available_quantity);
        $this->assertEquals(950, (float) $product->purchase_price);
        $this->assertSame('both', $product->listing_type);

        $this->purchase([['mode' => 'existing', 'product_id' => $product->id, 'quantity' => 1, 'unit_cost' => 950, 'listing_type' => 'rent']])
            ->assertCreated();
        $this->assertSame('rent', $product->fresh()->listing_type);
    }

    public function test_validation_rules(): void
    {
        $product = $this->existingProduct(['serial_number' => 'TAKEN-1']);

        $this->purchase([$this->newItem(['serial_number' => 'TAKEN-1'])])
            ->assertStatus(422)->assertJsonValidationErrors('items.0.serial_number');
        $this->purchase([$this->newItem(['serial_number' => 'DUP-1']), $this->newItem(['serial_number' => 'DUP-1'])])
            ->assertStatus(422)->assertJsonValidationErrors('items.0.serial_number');
        $this->purchase([])->assertStatus(422)->assertJsonValidationErrors('items');
        $this->purchase([$this->newItem()], ['supplier_id' => null])->assertStatus(422)->assertJsonValidationErrors('supplier_id');
        $this->purchase([$this->newItem(['category_id' => null])])->assertStatus(422)->assertJsonValidationErrors('items.0.category_id');
        $this->purchase([$this->newItem(['quantity' => 0])])->assertStatus(422)->assertJsonValidationErrors('items.0.quantity');
        $this->purchase([$this->newItem()], ['paid_amount' => 999999])->assertStatus(422)->assertJsonValidationErrors('paid_amount');
        $this->purchase([
            ['mode' => 'existing', 'product_id' => $product->id, 'quantity' => 1, 'unit_cost' => 1],
            ['mode' => 'existing', 'product_id' => $product->id, 'quantity' => 1, 'unit_cost' => 1],
        ])->assertStatus(422)->assertJsonValidationErrors('items.1.product_id');

        $this->assertSame(0, Product::query()->where('serial_number', 'DUP-1')->count());
        $this->assertSame(5, (int) $product->fresh()->quantity);
    }

    public function test_unlisted_products_cannot_be_sold_rented_or_booked(): void
    {
        $this->purchase([$this->newItem(['serial_number' => 'nd-hidden'])])->assertCreated();
        $product = Product::query()->where('serial_number', 'ND-HIDDEN')->firstOrFail();

        $this->postJson('/api/sales', [
            'customer_id' => $this->customer->id,
            'sale_date' => now()->toDateString(),
            'sale_status' => 'Completed',
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'unit_price' => 100]],
        ])->assertStatus(422)->assertJsonValidationErrors('items');

        $this->postJson('/api/rentals', [
            'customer_id' => $this->customer->id,
            'start_date' => now()->toDateString(),
            'status' => 'Active',
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'rental_rate' => 50]],
        ])->assertStatus(422)->assertJsonValidationErrors('items');

        $this->postJson('/api/bookings', [
            'customer_id' => $this->customer->id,
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(6)->toDateString(),
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'rental_rate' => 50]],
        ])->assertStatus(422)->assertJsonValidationErrors('items');

        $this->assertSame(4, (int) $product->fresh()->available_quantity);
    }

    public function test_cancel_reverses_stock_when_units_are_unused(): void
    {
        $product = $this->existingProduct();
        $purchase = $this->purchase([['mode' => 'existing', 'product_id' => $product->id, 'quantity' => 3, 'unit_cost' => 950]])
            ->assertCreated()->json('data');

        $this->postJson("/api/purchases/{$purchase['id']}/cancel", ['reason' => 'Wrong bill'])
            ->assertOk()->assertJsonPath('data.status', 'Cancelled');

        $this->assertSame(5, (int) $product->fresh()->quantity);
        $this->assertSame(5, (int) $product->fresh()->available_quantity);
        $this->assertTrue(StockMovement::query()->where('product_id', $product->id)->where('movement_type', 'PURCHASE_CANCEL')->where('quantity', -3)->exists());
        $this->assertTrue(ActivityLog::query()->where('module', 'purchases')->where('action', 'cancelled')->exists());
        $this->assertTrue(AuditLog::query()->where('auditable_type', 'Purchase')->where('action', 'cancelled')->exists());

        $this->postJson("/api/purchases/{$purchase['id']}/cancel")->assertStatus(422);
        $this->putJson("/api/purchases/{$purchase['id']}", [
            'supplier_id' => $this->supplier->id,
            'purchase_date' => now()->toDateString(),
            'payment_type' => 'Credit',
            'items' => [['mode' => 'existing', 'product_id' => $product->id, 'quantity' => 1, 'unit_cost' => 1]],
        ])->assertStatus(422);
    }

    public function test_cancel_is_blocked_when_units_are_sold_or_booked(): void
    {
        $this->purchase([$this->newItem(['serial_number' => 'nd-sold', 'listing_type' => 'both', 'sale_price' => 400, 'rental_price' => 50, 'quantity' => 2])])->assertCreated();
        $product = Product::query()->where('serial_number', 'ND-SOLD')->firstOrFail();
        $purchaseId = $product->purchaseItems()->value('purchase_id');

        $this->postJson('/api/sales', [
            'customer_id' => $this->customer->id,
            'sale_date' => now()->toDateString(),
            'sale_status' => 'Completed',
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'unit_price' => 400]],
        ])->assertCreated();

        $blockers = $this->getJson("/api/purchases/{$purchaseId}")->assertOk()->json('data.cancel_blockers');
        $this->assertNotEmpty($blockers);
        $this->postJson("/api/purchases/{$purchaseId}/cancel")
            ->assertStatus(422)->assertJsonValidationErrors('purchase');
        $this->assertSame(1, (int) $product->fresh()->available_quantity);

        $booked = $this->existingProduct(['quantity' => 0]);
        $purchase = $this->purchase([['mode' => 'existing', 'product_id' => $booked->id, 'quantity' => 2, 'unit_cost' => 10]])->json('data');
        $this->postJson('/api/bookings', [
            'customer_id' => $this->customer->id,
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(6)->toDateString(),
            'items' => [['product_id' => $booked->id, 'quantity' => 1, 'rental_rate' => 50]],
        ])->assertCreated();
        $this->postJson("/api/purchases/{$purchase['id']}/cancel")
            ->assertStatus(422)->assertJsonValidationErrors('purchase');
        $this->assertSame('Completed', $this->getJson("/api/purchases/{$purchase['id']}")->json('data.status'));
    }

    public function test_edit_adjusts_stock_by_the_difference_and_is_logged(): void
    {
        $product = $this->existingProduct();
        $purchase = $this->purchase([['mode' => 'existing', 'product_id' => $product->id, 'quantity' => 3, 'unit_cost' => 950]])->json('data');

        $this->putJson("/api/purchases/{$purchase['id']}", [
            'supplier_id' => $this->supplier->id,
            'purchase_date' => now()->toDateString(),
            'bill_number' => 'BILL-78',
            'payment_type' => 'Cheque',
            'paid_amount' => 500,
            'items' => [
                ['mode' => 'existing', 'product_id' => $product->id, 'quantity' => 1, 'unit_cost' => 1000],
                $this->newItem(['serial_number' => 'nd-added', 'quantity' => 2, 'unit_cost' => 100]),
            ],
        ])->assertOk()
            ->assertJsonPath('data.total_amount', 1200)
            ->assertJsonPath('data.payment_status', 'Partial')
            ->assertJsonPath('data.bill_number', 'BILL-78');

        $this->assertSame(6, (int) $product->fresh()->quantity);
        $this->assertEquals(1000, (float) $product->fresh()->purchase_price);
        $this->assertSame(2, (int) Product::query()->where('serial_number', 'ND-ADDED')->value('quantity'));
        $this->assertTrue(StockMovement::query()->where('product_id', $product->id)->where('movement_type', 'PURCHASE_ADJUST')->where('quantity', -2)->exists());
        $this->assertTrue(ActivityLog::query()->where('module', 'purchases')->where('action', 'updated')->exists());
    }

    public function test_supplier_details_show_purchases_and_outstanding(): void
    {
        $this->purchase([$this->newItem(['quantity' => 2, 'unit_cost' => 500])], ['paid_amount' => 300])->assertCreated();
        $cancelled = $this->purchase([$this->newItem(['quantity' => 1, 'unit_cost' => 100])])->json('data');
        $this->postJson("/api/purchases/{$cancelled['id']}/cancel")->assertOk();

        $data = $this->getJson("/api/suppliers/{$this->supplier->id}")->assertOk()->json('data');
        $this->assertCount(2, $data['purchases']);
        $this->assertEquals(700, $data['purchase_totals']['outstanding']);
        $this->assertSame(1, $data['purchase_totals']['count']);

        $this->getJson('/api/purchases?supplier_id='.$this->supplier->id.'&payment_status=Partial')
            ->assertOk()->assertJsonPath('data.total', 1);
    }

    public function test_permissions_staff_read_only(): void
    {
        $purchase = $this->purchase([$this->newItem()])->json('data');

        $staff = Role::query()->where('name', 'Staff')->firstOrFail();
        Sanctum::actingAs(User::factory()->create(['role_id' => $staff->id, 'role' => 'Staff', 'status' => 'Active']));
        $this->getJson('/api/purchases')->assertOk();
        $this->getJson("/api/purchases/{$purchase['id']}")->assertOk();
        $this->purchase([$this->newItem()])->assertForbidden();
        $this->putJson("/api/purchases/{$purchase['id']}", [])->assertForbidden();
        $this->postJson("/api/purchases/{$purchase['id']}/cancel")->assertForbidden();

        $accountant = Role::query()->where('name', 'Accountant')->firstOrFail();
        Sanctum::actingAs(User::factory()->create(['role_id' => $accountant->id, 'role' => 'Accountant', 'status' => 'Active']));
        $this->getJson('/api/purchases')->assertForbidden();
    }
}
