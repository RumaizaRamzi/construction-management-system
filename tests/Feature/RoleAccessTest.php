<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RoleAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function actAs(string $roleSlug): User
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

        return $user;
    }

    public function test_manager_has_operations_but_not_user_administration(): void
    {
        $this->actAs('manager');

        foreach (['/api/products', '/api/sales', '/api/rentals', '/api/income', '/api/expenses',
            '/api/reports/sales', '/api/reports/financial', '/api/activity-logs', '/api/audit-logs', '/api/settings'] as $uri) {
            $this->getJson($uri)->assertOk();
        }

        $this->getJson('/api/users')->assertForbidden();
        $this->postJson('/api/users', [])->assertForbidden();
        $this->putJson('/api/settings', ['company_name' => ''])->assertStatus(200);
    }

    public function test_accountant_has_financial_access_only(): void
    {
        $this->actAs('accountant');

        foreach (['/api/sales', '/api/rentals', '/api/income', '/api/expenses',
            '/api/reports/financial', '/api/activity-logs', '/api/settings'] as $uri) {
            $this->getJson($uri)->assertOk();
        }

        $this->getJson('/api/audit-logs')->assertForbidden();
        $this->getJson('/api/users')->assertForbidden();
        $this->getJson('/api/products')->assertForbidden();
        $this->postJson('/api/products', [])->assertForbidden();
        $this->postJson('/api/sales', [])->assertForbidden();
        $this->postJson('/api/rentals', [])->assertForbidden();
        $this->putJson('/api/settings', ['company_name' => 'X'])->assertForbidden();
    }

    public function test_logs_are_read_only_for_every_role(): void
    {
        $this->actAs('manager');

        $this->postJson('/api/activity-logs', [])->assertStatus(405);
        $this->putJson('/api/audit-logs/1', [])->assertStatus(405);
        $this->deleteJson('/api/audit-logs/1')->assertStatus(405);
        $this->deleteJson('/api/activity-logs/1')->assertNotFound();
    }
}
