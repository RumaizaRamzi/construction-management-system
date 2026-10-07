<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductSerialNumberTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        Sanctum::actingAs(User::query()->where('email', 'admin@buildtrack.local')->firstOrFail());
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'serial_number' => 'sn-100',
            'name' => 'Serial Test Drill',
            'quantity' => 3,
            'sale_price' => 1000,
            'rental_price' => 500,
            'purchase_price' => 800,
            'status' => 'Available',
        ], $overrides);
    }

    public function test_products_table_uses_serial_number_column(): void
    {
        $this->assertTrue(Schema::hasColumn('products', 'serial_number'));
        $this->assertFalse(Schema::hasColumn('products', 'sku'));
    }

    public function test_serial_number_is_required_and_unique(): void
    {
        $this->postJson('/api/products', $this->payload(['serial_number' => null]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('serial_number');

        $this->postJson('/api/products', $this->payload())->assertCreated();

        $this->postJson('/api/products', $this->payload(['serial_number' => 'SN-100', 'name' => 'Other']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('serial_number');
    }

    public function test_product_responses_expose_serial_number_only(): void
    {
        $created = $this->postJson('/api/products', $this->payload())->assertCreated()->json('data');

        $this->assertSame('SN-100', $created['serial_number']);
        $this->assertArrayNotHasKey('sku', $created);

        $updated = $this->putJson("/api/products/{$created['id']}", ['serial_number' => 'SN-200'])
            ->assertOk()
            ->json('data');
        $this->assertSame('SN-200', $updated['serial_number']);

        $found = $this->getJson('/api/products?search=SN-200')->assertOk()->json('data');
        $rows = $found['data'] ?? $found;
        $this->assertSame([$created['id']], array_column($rows, 'id'));
    }
}
