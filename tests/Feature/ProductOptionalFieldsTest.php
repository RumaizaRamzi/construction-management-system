<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductOptionalFieldsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        Sanctum::actingAs(User::query()->where('email', 'admin@buildtrack.local')->firstOrFail());
    }

    public function test_product_can_be_created_without_unit_or_purchase_cost(): void
    {
        $this->postJson('/api/products', [
            'serial_number' => 'OPT-1',
            'name' => 'Optional Mixer',
            'quantity' => 2,
            'rental_price' => 500,
            'unit' => null,
            'purchase_price' => null,
        ])->assertCreated()
            ->assertJsonPath('data.unit', null)
            ->assertJsonPath('data.purchase_price', null);
    }

    public function test_unit_still_defaults_when_not_sent(): void
    {
        $this->postJson('/api/products', [
            'serial_number' => 'OPT-2',
            'name' => 'Default Unit Mixer',
            'quantity' => 1,
        ])->assertCreated()->assertJsonPath('data.unit', 'Unit');
    }

    public function test_unit_and_purchase_cost_can_be_cleared_on_update(): void
    {
        $id = $this->postJson('/api/products', [
            'serial_number' => 'OPT-3',
            'name' => 'Clearable Mixer',
            'quantity' => 1,
            'unit' => 'Set',
            'purchase_price' => 1000,
        ])->assertCreated()->json('data.id');

        $this->putJson("/api/products/{$id}", ['unit' => null, 'purchase_price' => null])
            ->assertOk()
            ->assertJsonPath('data.unit', null)
            ->assertJsonPath('data.purchase_price', null);

        $this->putJson("/api/products/{$id}", ['name' => 'Renamed Mixer'])
            ->assertOk()
            ->assertJsonPath('data.unit', null);
    }
}
