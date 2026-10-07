<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Product;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RentalOptionalReturnDateTest extends TestCase
{
    use RefreshDatabase;

    private Customer $customer;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        Sanctum::actingAs(User::query()->where('email', 'admin@buildtrack.local')->firstOrFail());
        $this->customer = Customer::query()->create(['customer_code' => 'CUS-T1', 'name' => 'Test Customer']);
        $id = $this->postJson('/api/products', [
            'serial_number' => 'OPEN-1',
            'name' => 'Test Mixer',
            'quantity' => 2,
            'rental_price' => 500,
        ])->assertCreated()->json('data.id');
        $this->product = Product::query()->findOrFail($id);
    }

    private function rentalPayload(array $overrides = []): array
    {
        return array_merge([
            'customer_id' => $this->customer->id,
            'start_date' => now()->toDateString(),
            'status' => 'Active',
            'items' => [['product_id' => $this->product->id, 'quantity' => 1, 'rental_rate' => 500]],
        ], $overrides);
    }

    public function test_rental_can_be_created_without_an_expected_return_date(): void
    {
        $data = $this->postJson('/api/rentals', $this->rentalPayload(['expected_return_date' => null]))
            ->assertCreated()
            ->assertJsonPath('data.expected_return_date', null)
            ->json('data');

        $this->assertSame(500.0, (float) $data['total_amount']);
        $this->assertSame('Pending', $data['payment_status']);
        $this->assertSame(1, (int) $this->product->fresh()->available_quantity);

        $this->postJson('/api/rentals', $this->rentalPayload())->assertCreated();
    }

    public function test_open_ended_rental_keeps_blocking_its_units_for_future_dates(): void
    {
        $this->postJson('/api/rentals', $this->rentalPayload(['items' => [
            ['product_id' => $this->product->id, 'quantity' => 2, 'rental_rate' => 500],
        ]]))->assertCreated();

        $this->postJson('/api/bookings', [
            'customer_id' => $this->customer->id,
            'start_date' => now()->addDays(30)->toDateString(),
            'end_date' => now()->addDays(32)->toDateString(),
            'items' => [['product_id' => $this->product->id, 'quantity' => 1, 'rental_rate' => 500]],
        ])->assertStatus(422);
    }

    public function test_return_date_can_be_cleared_and_set_again_on_update(): void
    {
        $rental = $this->postJson('/api/rentals', $this->rentalPayload([
            'expected_return_date' => now()->addDays(3)->toDateString(),
        ]))->assertCreated()->json('data');
        $this->assertSame(1500.0, (float) $rental['total_amount']);

        $this->putJson("/api/rentals/{$rental['id']}", $this->rentalPayload(['expected_return_date' => null]))
            ->assertOk()
            ->assertJsonPath('data.expected_return_date', null);

        $this->putJson("/api/rentals/{$rental['id']}", ['notes' => 'Still out'])
            ->assertOk()
            ->assertJsonPath('data.expected_return_date', null);

        $date = now()->addDays(2)->toDateString();
        $this->putJson("/api/rentals/{$rental['id']}", $this->rentalPayload(['expected_return_date' => $date]))
            ->assertOk()
            ->assertJsonPath('data.expected_return_date', $date);
    }

    public function test_return_date_before_start_date_is_still_rejected(): void
    {
        $this->postJson('/api/rentals', $this->rentalPayload([
            'expected_return_date' => now()->subDay()->toDateString(),
        ]))->assertStatus(422)->assertJsonValidationErrors('expected_return_date');
    }

    public function test_open_ended_rental_is_billed_to_the_actual_return_date_without_late_fee(): void
    {
        $rental = $this->postJson('/api/rentals', $this->rentalPayload([
            'start_date' => now()->subDays(4)->toDateString(),
        ]))->assertCreated()->json('data');

        $data = $this->postJson("/api/rentals/{$rental['id']}/return", [
            'return_date' => now()->toDateString(),
            'condition' => 'Good',
            'items' => [['rental_item_id' => $rental['items'][0]['id'], 'returned_quantity' => 1]],
        ])->assertOk()->json('data');

        $this->assertSame(2000.0, (float) $data['subtotal']);
        $this->assertSame(0.0, (float) $data['late_fee']);
        $this->assertSame(2000.0, (float) $data['total_amount']);
        $this->assertSame('Returned', $data['status']);
        $this->assertSame(2, (int) $this->product->fresh()->available_quantity);
    }
}
