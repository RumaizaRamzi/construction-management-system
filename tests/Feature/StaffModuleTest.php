<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Branch;
use App\Models\Role;
use App\Models\Staff;
use App\Models\StaffAssignment;
use App\Models\StaffRole;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\StaffSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StaffModuleTest extends TestCase
{
    use RefreshDatabase;

    private StaffRole $driver;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        Sanctum::actingAs(User::query()->where('email', 'admin@buildtrack.local')->firstOrFail());
        $this->driver = StaffRole::query()->where('name', 'Driver')->firstOrFail();
    }

    private function createStaff(array $overrides = []): array
    {
        return $this->postJson('/api/staff', array_merge([
            'full_name' => 'Kasun Test',
            'nic' => '199012345678',
            'phone' => '077 123 4567',
            'address' => '1 Main Street',
            'role_id' => $this->driver->id,
            'joined_date' => '2025-01-15',
        ], $overrides))->assertCreated()->json('data');
    }

    public function test_default_roles_are_seeded_by_the_migration(): void
    {
        $this->assertEqualsCanonicalizing(
            ['Manager', 'Cashier', 'Driver', 'Operator', 'Storekeeper', 'Site Supervisor'],
            StaffRole::query()->pluck('name')->all()
        );
    }

    public function test_staff_is_created_with_auto_code_and_validated(): void
    {
        $first = $this->createStaff(['nic' => '881234567v']);
        $second = $this->createStaff(['nic' => '199112345678']);

        $this->assertSame('STF-0001', $first['staff_code']);
        $this->assertSame('STF-0002', $second['staff_code']);
        $this->assertSame('881234567V', $first['nic']);
        $this->assertSame('Active', $first['status']);
        $this->assertSame('Driver', $first['role_name']);

        $this->postJson('/api/staff', [])->assertStatus(422)
            ->assertJsonValidationErrors(['full_name', 'nic', 'phone', 'address', 'role_id', 'joined_date']);
        $this->postJson('/api/staff', ['nic' => '12345', 'phone' => 'abc'])->assertStatus(422)
            ->assertJsonValidationErrors(['nic', 'phone']);
    }

    public function test_duplicate_nic_and_staff_code_give_friendly_errors_even_after_removal(): void
    {
        $member = $this->createStaff();

        $this->postJson('/api/staff', ['nic' => '199012345678', 'staff_code' => 'stf-0001'])
            ->assertStatus(422)
            ->assertJsonPath('errors.nic.0', 'A staff member with this NIC number already exists.')
            ->assertJsonPath('errors.staff_code.0', 'This staff code is already in use. Leave it blank to generate one automatically.');

        $this->deleteJson("/api/staff/{$member['id']}")->assertOk();
        $this->assertSoftDeleted('staff', ['id' => $member['id']]);
        $this->postJson('/api/staff', ['nic' => '199012345678'])->assertStatus(422)->assertJsonValidationErrors('nic');
        $this->assertSame('STF-0002', $this->createStaff(['nic' => '199212345678'])['staff_code']);
    }

    public function test_list_supports_search_filters_and_pagination(): void
    {
        $branch = Branch::query()->create(['name' => 'Kandy Yard']);
        $operator = StaffRole::query()->where('name', 'Operator')->firstOrFail();
        $this->createStaff(['full_name' => 'Alpha Driver', 'phone' => '0711111111']);
        $this->createStaff(['full_name' => 'Beta Operator', 'nic' => '199312345678', 'role_id' => $operator->id, 'branch_id' => $branch->id]);
        $inactive = $this->createStaff(['full_name' => 'Gamma Former', 'nic' => '199412345678']);
        $this->patchJson("/api/staff/{$inactive['id']}", ['status' => 'Inactive'])->assertOk();

        $this->getJson('/api/staff?search=0711111111')->assertOk()->assertJsonPath('data.total', 1)->assertJsonPath('data.data.0.full_name', 'Alpha Driver');
        $this->getJson('/api/staff?search=STF-0002')->assertJsonPath('data.data.0.full_name', 'Beta Operator');
        $this->getJson('/api/staff?search=199312345678')->assertJsonPath('data.total', 1);
        $this->getJson("/api/staff?role_id={$operator->id}")->assertJsonPath('data.total', 1);
        $this->getJson("/api/staff?branch_id={$branch->id}")->assertJsonPath('data.data.0.branch_name', 'Kandy Yard');
        $this->getJson('/api/staff?status=Inactive')->assertJsonPath('data.total', 1);
        $this->getJson('/api/staff?per_page=2')->assertJsonPath('data.last_page', 2);

        $this->getJson('/api/staff/summary')->assertOk()
            ->assertJsonPath('data.total', 3)->assertJsonPath('data.active', 2)->assertJsonPath('data.inactive', 1);
    }

    public function test_bulk_attendance_upserts_and_monthly_summary_counts(): void
    {
        $a = $this->createStaff();
        $b = $this->createStaff(['nic' => '199512345678', 'full_name' => 'Second']);
        $date = now()->toDateString();

        $this->postJson('/api/attendance/bulk', ['date' => $date, 'records' => [
            ['staff_id' => $a['id'], 'status' => 'present', 'check_in' => '08:00', 'check_out' => '17:00'],
            ['staff_id' => $b['id'], 'status' => 'leave', 'check_in' => '08:00'],
        ]])->assertOk();
        $this->postJson('/api/attendance/bulk', ['date' => $date, 'records' => [
            ['staff_id' => $a['id'], 'status' => 'late', 'check_in' => '09:10'],
        ]])->assertOk();

        $this->assertDatabaseCount('attendances', 2);
        $rows = collect($this->getJson("/api/attendance?date={$date}")->assertOk()->json('data.rows'))->keyBy('staff_id');
        $this->assertSame('late', $rows[$a['id']]['attendance']['status']);
        $this->assertNull($rows[$b['id']]['attendance']['check_in']);

        $summary = collect($this->getJson('/api/attendance/summary?month='.now()->format('Y-m'))->json('data.rows'))->keyBy('staff_id');
        $this->assertSame(1, $summary[$a['id']]['late']);
        $this->assertSame(1, $summary[$b['id']]['leave']);
        $this->assertSame('leave', $summary[$b['id']]['days'][$date]);
        $this->getJson('/api/staff/summary')->assertJsonPath('data.on_leave_today', 1);

        $this->postJson('/api/attendance', ['date' => $date, 'staff_id' => $a['id'], 'status' => 'present', 'check_in' => '10:00', 'check_out' => '09:00'])
            ->assertStatus(422)->assertJsonValidationErrors('records.0.check_out');
        $this->postJson('/api/attendance', ['date' => now()->addDay()->toDateString(), 'staff_id' => $a['id'], 'status' => 'present'])
            ->assertStatus(422)->assertJsonValidationErrors('date');
        $this->postJson('/api/attendance/bulk', ['date' => $date, 'records' => [
            ['staff_id' => $a['id'], 'status' => 'present'], ['staff_id' => $a['id'], 'status' => 'absent'],
        ]])->assertStatus(422);
    }

    public function test_deactivating_keeps_history_and_blocks_new_attendance_and_assignments(): void
    {
        $member = $this->createStaff();
        $date = now()->toDateString();
        $this->postJson('/api/attendance', ['date' => $date, 'staff_id' => $member['id'], 'status' => 'present'])->assertOk();

        $this->patchJson("/api/staff/{$member['id']}", ['status' => 'Inactive'])->assertOk()
            ->assertJsonPath('message', 'Staff member deactivated. Their history is kept.');

        $this->assertDatabaseHas('attendances', ['staff_id' => $member['id']]);
        $this->getJson("/api/staff/{$member['id']}")->assertOk()->assertJsonPath('data.attendance_summary.present', 1);
        $this->postJson('/api/attendance', ['date' => now()->subDay()->toDateString(), 'staff_id' => $member['id'], 'status' => 'present'])
            ->assertStatus(422);
        $vehicle = $this->postJson('/api/vehicles', ['name' => 'Truck', 'category' => 'Truck', 'registration_number' => 'WP 9'])->json('data');
        $this->postJson("/api/staff/{$member['id']}/assignments", ['vehicle_id' => $vehicle['id'], 'assigned_from' => $date])
            ->assertStatus(422)->assertJsonValidationErrors('staff');
    }

    public function test_assignments_link_vehicles_and_are_listed_by_staff(): void
    {
        $member = $this->createStaff();
        $vehicle = $this->postJson('/api/vehicles', ['name' => 'Truck', 'category' => 'Truck', 'registration_number' => 'WP 1'])->json('data');

        $this->postJson("/api/staff/{$member['id']}/assignments", ['assigned_from' => '2026-09-01'])
            ->assertStatus(422)->assertJsonValidationErrors(['vehicle_id', 'rental_id']);
        $this->postJson("/api/staff/{$member['id']}/assignments", ['vehicle_id' => $vehicle['id'], 'assigned_from' => '2026-09-10', 'assigned_to' => '2026-09-01'])
            ->assertStatus(422)->assertJsonValidationErrors('assigned_to');

        $created = $this->postJson("/api/staff/{$member['id']}/assignments", ['vehicle_id' => $vehicle['id'], 'assigned_from' => '2026-09-01'])
            ->assertCreated()->assertJsonPath('data.vehicle_registration', 'WP 1')->json('data');
        $this->getJson("/api/staff/{$member['id']}/assignments")->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/staff/{$member['id']}")->assertJsonPath('data.assignments.0.id', $created['id']);

        $this->deleteJson("/api/staff-assignments/{$created['id']}")->assertOk();
        $this->assertDatabaseCount('staff_assignments', 0);
    }

    public function test_role_crud_blocks_deleting_a_role_in_use(): void
    {
        $role = $this->postJson('/api/staff-roles', ['name' => 'Welder', 'description' => 'Welding work'])->assertCreated()->json('data');
        $this->postJson('/api/staff-roles', ['name' => 'welder'])->assertStatus(422)->assertJsonPath('errors.name.0', 'A role with this name already exists.');
        $this->putJson("/api/staff-roles/{$role['id']}", ['name' => 'Senior Welder'])->assertOk()->assertJsonPath('data.name', 'Senior Welder');

        $member = $this->createStaff(['role_id' => $role['id']]);
        $this->deleteJson("/api/staff-roles/{$role['id']}")->assertStatus(422);
        $this->deleteJson("/api/staff/{$member['id']}")->assertOk();
        $this->deleteJson("/api/staff-roles/{$role['id']}")->assertStatus(422);

        $unused = $this->postJson('/api/staff-roles', ['name' => 'Cleaner'])->json('data');
        $this->deleteJson("/api/staff-roles/{$unused['id']}")->assertOk();
    }

    public function test_photo_upload_is_private_and_limited_to_two_megabytes(): void
    {
        Storage::fake('local');
        $member = $this->createStaff();
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');

        $this->post("/api/staff/{$member['id']}/photo", ['photo' => UploadedFile::fake()->createWithContent('p.png', $png)], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.has_photo', true)->assertJsonMissingPath('data.photo');
        $this->get("/api/staff/{$member['id']}/photo")->assertOk();

        $this->post("/api/staff/{$member['id']}/photo", ['photo' => UploadedFile::fake()->create('big.png', 2100, 'image/png')], ['Accept' => 'application/json'])
            ->assertStatus(422);
        $this->post("/api/staff/{$member['id']}/photo", ['photo' => UploadedFile::fake()->create('doc.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertStatus(422);
    }

    public function test_staff_seeder_is_idempotent(): void
    {
        $this->postJson('/api/vehicles', ['name' => 'Truck', 'category' => 'Truck', 'registration_number' => 'WP S1'])->assertCreated();

        $this->seed(StaffSeeder::class);
        $counts = [Staff::withTrashed()->count(), Attendance::query()->count(), StaffAssignment::query()->count()];
        $this->seed(StaffSeeder::class);

        $this->assertSame(8, $counts[0]);
        $this->assertSame(3, $counts[2]);
        $this->assertGreaterThan(0, $counts[1]);
        $this->assertSame($counts, [Staff::withTrashed()->count(), Attendance::query()->count(), StaffAssignment::query()->count()]);
    }

    public function test_permissions_follow_roles(): void
    {
        $member = $this->createStaff();

        $staffRole = Role::query()->where('name', 'Staff')->firstOrFail();
        Sanctum::actingAs(User::factory()->create(['role_id' => $staffRole->id, 'role' => 'Staff', 'status' => 'Active']));
        $this->getJson('/api/staff')->assertForbidden();
        $this->postJson('/api/attendance/bulk', ['date' => now()->toDateString(), 'records' => []])->assertForbidden();

        $accountant = Role::query()->where('name', 'Accountant')->firstOrFail();
        Sanctum::actingAs(User::factory()->create(['role_id' => $accountant->id, 'role' => 'Accountant', 'status' => 'Active']));
        $this->getJson("/api/staff/{$member['id']}")->assertOk();
        $this->getJson('/api/attendance')->assertOk();
        $this->patchJson("/api/staff/{$member['id']}", ['status' => 'Inactive'])->assertForbidden();
        $this->postJson('/api/staff-roles', ['name' => 'X'])->assertForbidden();
    }
}
