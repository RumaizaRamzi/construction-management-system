<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Role;
use App\Models\Staff;
use App\Models\StaffRole;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminAreaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function makeUser(string $roleSlug, array $attrs = []): User
    {
        $role = Role::query()->where('slug', $roleSlug)->firstOrFail();
        $user = User::query()->create(array_merge([
            'name' => ucfirst($roleSlug).' User',
            'email' => $roleSlug.uniqid().'@test.local',
            'password' => 'password123',
            'status' => 'Active',
        ], $attrs));
        $user->role_id = $role->id;
        $user->role = $role->name;
        $user->save();

        return $user;
    }

    /** The permissions seeder creates admin@buildtrack.local; make $admin the only active Admin. */
    private function makeOnlyActiveAdmin(User $admin): void
    {
        User::query()->whereKeyNot($admin->id)
            ->whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))
            ->update(['status' => 'Inactive']);
    }

    public function test_non_admins_get_403_on_every_admin_endpoint(): void
    {
        foreach (['manager', 'accountant', 'staff'] as $slug) {
            Sanctum::actingAs($this->makeUser($slug));

            foreach (['/api/admin/users', '/api/admin/users/options', '/api/admin/roles', '/api/admin/permissions',
                '/api/admin/activity-logs', '/api/admin/branches'] as $uri) {
                $this->getJson($uri)->assertForbidden();
            }
            $this->postJson('/api/admin/users', [])->assertForbidden();
            $this->postJson('/api/admin/roles', ['name' => 'X'])->assertForbidden();
            $this->postJson('/api/admin/branches', ['name' => 'X'])->assertForbidden();
        }
    }

    public function test_guests_get_401_on_admin_endpoints(): void
    {
        $this->getJson('/api/admin/users')->assertUnauthorized();
    }

    public function test_admin_can_create_user_with_generated_password_and_forced_change(): void
    {
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);
        $staffRole = Role::query()->where('slug', 'staff')->firstOrFail();

        $response = $this->postJson('/api/admin/users', [
            'name' => 'New Cashier',
            'email' => 'Cashier@Test.local',
            'role_id' => $staffRole->id,
        ])->assertCreated();

        $generated = $response->json('data.generated_password');
        $this->assertIsString($generated);
        $this->assertGreaterThanOrEqual(8, strlen($generated));
        $response->assertJsonPath('data.user.email', 'cashier@test.local')
            ->assertJsonPath('data.user.must_change_password', true);

        $user = User::query()->where('email', 'cashier@test.local')->firstOrFail();
        $this->assertTrue(Hash::check($generated, $user->password));
        $this->assertNotSame($generated, $user->password);

        foreach (ActivityLog::query()->get() as $log) {
            $this->assertStringNotContainsString($generated, (string) $log->description);
        }

        $this->postJson('/api/admin/users', [
            'name' => 'Dup', 'email' => 'CASHIER@test.local', 'role_id' => $staffRole->id, 'password' => 'secret123',
        ])->assertStatus(422)->assertJsonPath('errors.email.0', 'A user with this email address already exists.');

        $this->postJson('/api/admin/users', [
            'name' => 'Short', 'email' => 'short@test.local', 'role_id' => $staffRole->id, 'password' => 'abc',
        ])->assertStatus(422)->assertJsonValidationErrors('password');
    }

    public function test_forced_password_change_blocks_api_until_changed(): void
    {
        $user = $this->makeUser('staff', ['password' => 'temporary1']);
        $user->must_change_password = true;
        $user->save();
        Sanctum::actingAs($user);

        $this->getJson('/api/products')->assertForbidden()->assertJsonPath('code', 'password_change_required');
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('data.must_change_password', true);

        $this->putJson('/api/auth/profile', [
            'current_password' => 'temporary1', 'password' => 'brandnew123', 'password_confirmation' => 'brandnew123',
        ])->assertOk()->assertJsonPath('data.must_change_password', false);

        $this->getJson('/api/products')->assertOk();
    }

    public function test_admin_can_link_user_to_staff_and_staff_deactivation_disables_login(): void
    {
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);
        $role = StaffRole::query()->firstOrFail();
        $staff = Staff::query()->create([
            'staff_code' => 'STF-9001', 'full_name' => 'Linked Driver', 'nic' => '199012345678',
            'phone' => '0771234567', 'role_id' => $role->id, 'status' => 'Active',
        ]);

        $userId = $this->postJson('/api/admin/users', [
            'staff_id' => $staff->id,
            'email' => 'driver@test.local',
            'role_id' => Role::query()->where('slug', 'staff')->value('id'),
            'password' => 'driverpass1',
            'must_change_password' => false,
        ])->assertCreated()
            ->assertJsonPath('data.user.name', 'Linked Driver')
            ->assertJsonPath('data.user.staff.id', $staff->id)
            ->json('data.user.id');

        $this->postJson('/api/admin/users', [
            'staff_id' => $staff->id, 'email' => 'other@test.local',
            'role_id' => Role::query()->where('slug', 'staff')->value('id'), 'password' => 'otherpass1',
        ])->assertStatus(422)->assertJsonValidationErrors('staff_id');

        $this->patchJson("/api/staff/{$staff->id}", ['status' => 'Inactive'])->assertOk();
        $this->assertSame('Inactive', User::query()->findOrFail($userId)->status);
    }

    public function test_admin_can_create_edit_and_delete_custom_role(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));

        $roleId = $this->postJson('/api/admin/roles', [
            'name' => 'Site Clerk',
            'description' => 'Records site stock',
            'permissions' => ['products.view', 'products.create'],
        ])->assertCreated()
            ->assertJsonPath('data.slug', 'site-clerk')
            ->assertJsonPath('data.locked', false)
            ->json('data.id');

        $this->assertEqualsCanonicalizing(
            ['products.view', 'products.create'],
            Role::query()->findOrFail($roleId)->permissions()->pluck('slug')->all()
        );

        $this->postJson('/api/admin/roles', ['name' => 'site clerk'])
            ->assertStatus(422)->assertJsonValidationErrors('name');

        $this->putJson("/api/admin/roles/{$roleId}", ['permissions' => ['products.view', 'sales.view']])->assertOk();
        $this->assertTrue(ActivityLog::query()->where('description', 'like', 'Permissions for role Site Clerk changed%')->exists());

        $this->makeUser('site-clerk');
        $this->deleteJson("/api/admin/roles/{$roleId}")->assertStatus(422);

        User::query()->where('role_id', $roleId)->delete();
        $this->deleteJson("/api/admin/roles/{$roleId}")->assertOk();
        $this->assertDatabaseMissing('roles', ['id' => $roleId]);
    }

    public function test_admin_role_is_locked(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $adminRole = Role::query()->where('slug', 'admin')->firstOrFail();

        $this->putJson("/api/admin/roles/{$adminRole->id}", ['permissions' => []])->assertStatus(422);
        $this->deleteJson("/api/admin/roles/{$adminRole->id}")->assertStatus(422);
        $this->assertDatabaseHas('roles', ['id' => $adminRole->id]);
    }

    public function test_last_admin_cannot_be_removed_disabled_or_demoted(): void
    {
        $admin = $this->makeUser('admin');
        $inactiveAdmin = $this->makeUser('admin');
        $this->makeOnlyActiveAdmin($admin);
        $this->assertSame('Inactive', $inactiveAdmin->refresh()->status);
        Sanctum::actingAs($admin);
        $managerRoleId = Role::query()->where('slug', 'manager')->value('id');

        $this->deleteJson("/api/admin/users/{$admin->id}")->assertStatus(422);
        $this->patchJson("/api/admin/users/{$admin->id}/status", ['status' => 'Inactive'])->assertStatus(422);
        $this->putJson("/api/admin/users/{$admin->id}", ['role_id' => $managerRoleId])
            ->assertStatus(422)->assertJsonValidationErrors('role_id');

        $admin->refresh();
        $this->assertSame('Active', $admin->status);
        $this->assertTrue($admin->isAdmin());
        $this->assertSame(1, app(\App\Services\AdminUserService::class)->activeAdminCount());
    }

    public function test_admin_can_manage_other_admins_when_another_admin_remains(): void
    {
        $admin = $this->makeUser('admin');
        $second = $this->makeUser('admin');
        Sanctum::actingAs($second);

        $this->patchJson("/api/admin/users/{$admin->id}/status", ['status' => 'Inactive'])->assertOk();
        $this->assertSame('Inactive', $admin->refresh()->status);
        $this->deleteJson("/api/admin/users/{$admin->id}")->assertOk();
        $this->assertDatabaseMissing('users', ['id' => $admin->id]);
    }

    public function test_deactivating_staff_never_disables_the_last_admin_login(): void
    {
        $admin = $this->makeUser('admin');
        $this->makeOnlyActiveAdmin($admin);
        $staff = Staff::query()->create([
            'staff_code' => 'STF-9002', 'full_name' => 'Owner', 'nic' => '198012345678', 'phone' => '0770000000',
            'role_id' => StaffRole::query()->value('id'), 'status' => 'Active', 'user_id' => $admin->id,
        ]);
        Sanctum::actingAs($this->makeUser('manager'));

        $this->patchJson("/api/staff/{$staff->id}", ['status' => 'Inactive'])->assertOk();
        $this->assertSame('Active', $admin->refresh()->status);
    }

    public function test_activity_logs_hide_sensitive_values(): void
    {
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);
        $target = $this->makeUser('staff');

        $this->postJson("/api/admin/users/{$target->id}/reset-password", ['password' => 'resetpass99'])
            ->assertOk()->assertJsonPath('data.generated_password', null);

        $rows = $this->getJson('/api/admin/activity-logs?module=users')->assertOk()->json('data.data');
        $this->assertNotEmpty($rows);
        $this->assertStringNotContainsString('resetpass99', json_encode($rows));
        $this->assertTrue(collect($rows)->contains(fn ($r) => $r['action'] === 'password_reset'));
    }
}
