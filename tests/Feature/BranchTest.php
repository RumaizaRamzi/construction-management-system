<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BranchTest extends TestCase
{
    use RefreshDatabase;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        Sanctum::actingAs(User::query()->where('email', 'admin@buildtrack.local')->firstOrFail());
        $this->customer = Customer::query()->create(['customer_code' => 'CUS-B1', 'name' => 'Branch Customer']);
    }

    private function createBranch(string $name = 'Main Branch'): int
    {
        return $this->postJson('/api/branches', ['name' => $name])
            ->assertCreated()
            ->assertJsonPath('data.status', 'Active')
            ->json('data.id');
    }

    private function createProduct(array $overrides = []): int
    {
        return $this->postJson('/api/products', array_merge([
            'serial_number' => 'BR-'.uniqid(),
            'name' => 'Branch Mixer',
            'quantity' => 5,
            'rental_price' => 500,
        ], $overrides))->assertCreated()->json('data.id');
    }

    public function test_admin_can_create_and_list_branches_and_names_are_unique(): void
    {
        $this->createBranch('Colombo');

        $this->postJson('/api/branches', ['name' => 'Colombo'])->assertStatus(422);
        $this->postJson('/api/branches', [])->assertStatus(422);

        $this->getJson('/api/branches')->assertOk()->assertJsonPath('data.0.name', 'Colombo');
    }

    public function test_records_save_without_a_branch(): void
    {
        $productId = $this->createProduct();
        $this->getJson("/api/products/{$productId}")->assertOk()->assertJsonPath('data.branch_id', null);

        $this->postJson('/api/rentals', [
            'customer_id' => $this->customer->id,
            'start_date' => now()->toDateString(),
            'status' => 'Active',
            'items' => [['product_id' => $productId, 'quantity' => 1, 'rental_rate' => 500]],
        ])->assertCreated()->assertJsonPath('data.branch_id', null);

        $this->postJson('/api/expenses', ['amount' => 100, 'category' => 'Fuel'])
            ->assertCreated()->assertJsonPath('data.branch_id', null);
        $this->postJson('/api/income', ['amount' => 100, 'source' => 'Other'])
            ->assertCreated()->assertJsonPath('data.branch_id', null);
    }

    public function test_branch_can_be_set_changed_and_cleared_on_records(): void
    {
        $a = $this->createBranch('Branch A');
        $b = $this->createBranch('Branch B');

        $productId = $this->createProduct(['branch_id' => $a]);
        $this->getJson("/api/products/{$productId}")->assertJsonPath('data.branch_id', $a);
        $this->putJson("/api/products/{$productId}", ['branch_id' => $b])->assertOk()->assertJsonPath('data.branch_id', $b);
        $this->putJson("/api/products/{$productId}", ['branch_id' => null])->assertOk()->assertJsonPath('data.branch_id', null);

        $rental = $this->postJson('/api/rentals', [
            'customer_id' => $this->customer->id,
            'branch_id' => $a,
            'start_date' => now()->toDateString(),
            'status' => 'Active',
            'items' => [['product_id' => $productId, 'quantity' => 1, 'rental_rate' => 500]],
        ])->assertCreated()->assertJsonPath('data.branch_id', $a)->json('data');
        $this->putJson("/api/rentals/{$rental['id']}", ['branch_id' => null])->assertOk()->assertJsonPath('data.branch_id', null);

        $booking = $this->postJson('/api/bookings', [
            'customer_id' => $this->customer->id,
            'branch_id' => $b,
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(12)->toDateString(),
            'items' => [['product_id' => $productId, 'quantity' => 1, 'rental_rate' => 500]],
        ])->assertCreated()->assertJsonPath('data.branch_id', $b)->json('data');
        $this->putJson("/api/bookings/{$booking['id']}", ['branch_id' => $a])->assertOk()->assertJsonPath('data.branch_id', $a);

        $expense = $this->postJson('/api/expenses', ['amount' => 100, 'category' => 'Fuel', 'branch_id' => $a])
            ->assertCreated()->assertJsonPath('data.branch_id', $a)->json('data');
        $this->putJson("/api/expenses/{$expense['id']}", ['branch_id' => null])->assertOk()->assertJsonPath('data.branch_id', null);

        $income = $this->postJson('/api/income', ['amount' => 100, 'source' => 'Other', 'branch_id' => $b])
            ->assertCreated()->assertJsonPath('data.branch_id', $b)->json('data');
        $this->putJson("/api/income/{$income['id']}", ['branch_id' => $a])->assertOk()->assertJsonPath('data.branch_id', $a);

        $staffRole = Role::query()->where('name', 'Staff')->firstOrFail();
        $user = $this->postJson('/api/users', [
            'name' => 'Branch User',
            'email' => 'branch.user@example.test',
            'password' => 'Secret#Pass123',
            'password_confirmation' => 'Secret#Pass123',
            'role_id' => $staffRole->id,
            'branch_id' => $a,
        ])->assertCreated()->assertJsonPath('data.branch_id', $a)->json('data');
        $this->putJson("/api/users/{$user['id']}", ['branch_id' => null])->assertOk()->assertJsonPath('data.branch_id', null);

        $this->postJson('/api/expenses', ['amount' => 100, 'branch_id' => 99999])->assertStatus(422);
    }

    public function test_branch_in_use_cannot_be_deleted_but_unused_branch_can(): void
    {
        $used = $this->createBranch('Used');
        $unused = $this->createBranch('Unused');
        $this->createProduct(['branch_id' => $used]);

        $this->deleteJson("/api/branches/{$used}")->assertStatus(422)->assertJsonValidationErrors('branch');
        $this->putJson("/api/branches/{$used}", ['status' => 'Inactive'])->assertOk()->assertJsonPath('data.status', 'Inactive');
        $this->deleteJson("/api/branches/{$unused}")->assertOk();
    }

    public function test_non_admin_can_list_but_not_manage_branches(): void
    {
        $branchId = $this->createBranch();

        foreach (['Manager', 'Staff'] as $roleName) {
            $role = Role::query()->where('name', $roleName)->firstOrFail();
            Sanctum::actingAs(User::factory()->create(['role_id' => $role->id, 'role' => $roleName]));

            $this->getJson('/api/branches')->assertOk();
            $this->postJson('/api/branches', ['name' => "By {$roleName}"])->assertForbidden();
            $this->putJson("/api/branches/{$branchId}", ['name' => 'Renamed'])->assertForbidden();
            $this->deleteJson("/api/branches/{$branchId}")->assertForbidden();
        }
    }
}
