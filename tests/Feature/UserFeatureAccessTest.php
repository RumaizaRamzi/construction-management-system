<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserFeatureAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function makeUser(string $roleSlug): User
    {
        $role = Role::query()->where('slug', $roleSlug)->firstOrFail();
        $user = User::query()->create([
            'name' => ucfirst($roleSlug).' User',
            'email' => $roleSlug.uniqid().'@test.local',
            'password' => 'password123',
            'status' => 'Active',
        ]);
        $user->role_id = $role->id;
        $user->role = $role->name;
        $user->save();

        return $user;
    }

    private function createCashier(array $access): array
    {
        $staffRole = Role::query()->where('slug', 'staff')->value('id');

        return $this->postJson('/api/admin/users', [
            'name' => 'Cashier One',
            'email' => 'cashier'.uniqid().'@test.local',
            'password' => 'password123',
            'must_change_password' => false,
            'role_id' => $staffRole,
            ...$access,
        ])->assertCreated()->json('data.user');
    }

    public function test_selected_features_limit_access_to_exactly_those_features(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $cashier = $this->createCashier(['access_mode' => 'custom', 'permissions' => ['sales.view', 'sales.create', 'customers.view']]);

        $this->assertSame('custom', $cashier['access_mode']);
        $this->assertEqualsCanonicalizing(['sales.view', 'sales.create', 'customers.view'], $cashier['permissions']);
        $this->assertSame(3, $cashier['feature_count']);

        $user = User::query()->find($cashier['id']);
        Sanctum::actingAs($user);
        $this->getJson('/api/sales')->assertOk();
        $this->getJson('/api/customers')->assertOk();
        // the Staff role has these, but custom access replaces the role's features
        $this->getJson('/api/rentals')->assertForbidden();
        $this->getJson('/api/products')->assertForbidden();
        $this->getJson('/api/admin/users')->assertForbidden();

        $this->getJson('/api/auth/me')->assertOk()
            ->assertJsonPath('data.permissions', fn ($p) => count($p) === 3 && in_array('sales.create', $p, true));
    }

    public function test_full_access_grants_every_feature_but_not_the_admin_area(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $cashier = $this->createCashier(['access_mode' => 'full']);

        Sanctum::actingAs(User::query()->find($cashier['id']));
        $this->getJson('/api/income')->assertOk();
        $this->getJson('/api/cheques')->assertOk();
        $this->getJson('/api/audit-logs')->assertOk();
        $this->getJson('/api/admin/users')->assertForbidden();
    }

    public function test_role_default_keeps_existing_behaviour_and_admin_can_change_access(): void
    {
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);
        $cashier = $this->createCashier([]);
        $this->assertSame('role', $cashier['access_mode']);

        $user = User::query()->find($cashier['id']);
        Sanctum::actingAs($user);
        $this->getJson('/api/rentals')->assertOk();
        $this->getJson('/api/income')->assertForbidden();

        Sanctum::actingAs($admin);
        $this->putJson("/api/admin/users/{$user->id}", ['access_mode' => 'custom', 'permissions' => ['income.view']])
            ->assertOk()->assertJsonPath('data.access_mode', 'custom');

        Sanctum::actingAs($user->fresh());
        $this->getJson('/api/income')->assertOk();
        $this->getJson('/api/rentals')->assertForbidden();

        $log = ActivityLog::query()->where('action', 'permissions_changed')->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertStringContainsString('selected features', $log->description);
        $this->assertStringContainsString('income.view', $log->description);

        Sanctum::actingAs($admin);
        $this->putJson("/api/admin/users/{$user->id}", ['access_mode' => 'role'])->assertOk();
        $this->assertSame(0, $user->fresh()->customPermissions()->count());
    }

    public function test_validation_and_only_admins_can_manage_access(): void
    {
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);
        $staffRole = Role::query()->where('slug', 'staff')->value('id');

        $this->postJson('/api/admin/users', [
            'name' => 'X', 'email' => 'x@test.local', 'role_id' => $staffRole, 'access_mode' => 'custom', 'permissions' => [],
        ])->assertStatus(422)->assertJsonValidationErrors(['permissions']);

        $this->postJson('/api/admin/users', [
            'name' => 'X', 'email' => 'x@test.local', 'role_id' => $staffRole, 'access_mode' => 'custom', 'permissions' => ['not.real'],
        ])->assertStatus(422)->assertJsonValidationErrors(['permissions.0']);

        $this->putJson("/api/admin/users/{$admin->id}", ['access_mode' => 'custom', 'permissions' => ['sales.view']])
            ->assertStatus(422);

        $manager = $this->makeUser('manager');
        Sanctum::actingAs($manager);
        $this->putJson("/api/admin/users/{$admin->id}", ['access_mode' => 'full'])->assertForbidden();
    }
}
