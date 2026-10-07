<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VehicleModuleTest extends TestCase
{
    use RefreshDatabase;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        Sanctum::actingAs(User::query()->where('email', 'admin@buildtrack.local')->firstOrFail());
        $this->customer = Customer::query()->create(['customer_code' => 'CUS-V1', 'name' => 'Vehicle Customer']);
    }

    private function createVehicle(array $overrides = []): array
    {
        return $this->postJson('/api/vehicles', array_merge([
            'name' => 'Test Excavator',
            'category' => 'Excavator',
            'registration_number' => 'reg-'.uniqid(),
            'daily_rate' => 1000,
            'weekly_rate' => 6000,
            'monthly_rate' => 20000,
        ], $overrides))->assertCreated()->json('data');
    }

    private function rent(int $vehicleId, array $overrides = [])
    {
        return $this->postJson('/api/vehicle-rentals', array_merge([
            'vehicle_id' => $vehicleId,
            'customer_id' => $this->customer->id,
            'start_date' => '2026-09-01',
            'expected_return_date' => '2026-09-05',
        ], $overrides));
    }

    private function vehicleStatus(int $id): string
    {
        return $this->getJson("/api/vehicles/{$id}")->assertOk()->json('data.status');
    }

    public function test_vehicle_is_created_with_code_and_registration_is_unique(): void
    {
        $vehicle = $this->createVehicle(['registration_number' => 'wp cab-1234', 'manufacture_year' => 2020]);

        $this->assertSame('VEH-0001', $vehicle['vehicle_code']);
        $this->assertSame('WP CAB-1234', $vehicle['registration_number']);
        $this->assertSame('Available', $vehicle['status']);
        $this->assertNull($vehicle['branch_id']);

        $this->postJson('/api/vehicles', ['name' => 'Dup', 'category' => 'Crane', 'registration_number' => 'WP CAB-1234'])
            ->assertStatus(422)->assertJsonValidationErrors('registration_number');
        $this->postJson('/api/vehicles', [])->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'category', 'registration_number']);
        $this->postJson('/api/vehicles', ['name' => 'X', 'category' => 'Crane', 'registration_number' => 'R1', 'status' => 'Rented'])
            ->assertStatus(422)->assertJsonValidationErrors('status');

        $this->getJson('/api/vehicles')->assertOk()
            ->assertJsonPath('data.data.0.id', $vehicle['id'])
            ->assertJsonPath('data.statuses', ['Available', 'Rented', 'Under Maintenance', 'Out of Service']);
    }

    public function test_renting_marks_vehicle_rented_and_blocks_double_rental(): void
    {
        $vehicle = $this->createVehicle();

        $rental = $this->rent($vehicle['id'], ['paid_amount' => 1000])->assertCreated()->json('data');
        $this->assertSame('Active', $rental['status']);
        $this->assertSame(4, $rental['rental_days']);
        $this->assertEquals(4000, $rental['total_amount']);
        $this->assertEquals(1000, $rental['rental_rate']);
        $this->assertEquals(3000, $rental['balance']);
        $this->assertSame('Partial', $rental['payment_status']);
        $this->assertSame('Rented', $this->vehicleStatus($vehicle['id']));

        $this->rent($vehicle['id'])->assertStatus(422)->assertJsonValidationErrors('vehicle_id');
    }

    public function test_unavailable_vehicles_cannot_be_rented(): void
    {
        $outOfService = $this->createVehicle(['status' => 'Out of Service']);
        $underMaintenance = $this->createVehicle(['status' => 'Under Maintenance']);

        $this->rent($outOfService['id'])->assertStatus(422)->assertJsonValidationErrors('vehicle_id');
        $this->rent($underMaintenance['id'])->assertStatus(422)->assertJsonValidationErrors('vehicle_id');
    }

    public function test_returning_vehicle_completes_rental_and_makes_vehicle_available(): void
    {
        $vehicle = $this->createVehicle();
        $rental = $this->rent($vehicle['id'])->json('data');

        $this->putJson("/api/vehicle-rentals/{$rental['id']}", ['status' => 'Completed', 'actual_return_date' => '2026-09-08'])
            ->assertOk()
            ->assertJsonPath('message', 'Vehicle returned and rental completed.')
            ->assertJsonPath('data.status', 'Completed')
            ->assertJsonPath('data.rental_days', 7)
            ->assertJsonPath('data.total_amount', 7000);
        $this->assertSame('Available', $this->vehicleStatus($vehicle['id']));

        $details = $this->getJson("/api/vehicles/{$vehicle['id']}")->assertOk()->json('data');
        $this->assertNull($details['current_rental']);
        $this->assertSame(1, $details['stats']['times_rented']);
        $this->assertCount(1, $details['rentals']);

        $this->rent($vehicle['id'])->assertCreated();
    }

    public function test_setting_actual_return_date_on_active_rental_completes_it(): void
    {
        $vehicle = $this->createVehicle();
        $rental = $this->rent($vehicle['id'])->json('data');

        $this->putJson("/api/vehicle-rentals/{$rental['id']}", ['actual_return_date' => '2026-09-03'])
            ->assertOk()->assertJsonPath('data.status', 'Completed');
        $this->assertSame('Available', $this->vehicleStatus($vehicle['id']));

        $this->putJson("/api/vehicle-rentals/{$rental['id']}", ['actual_return_date' => '2026-08-01'])
            ->assertStatus(422)->assertJsonValidationErrors('actual_return_date');
    }

    public function test_weekly_and_monthly_rates_bill_whole_periods_and_overpayment_is_rejected(): void
    {
        $weekly = $this->createVehicle();
        $rental = $this->rent($weekly['id'], ['rate_type' => 'Weekly', 'expected_return_date' => '2026-09-10'])
            ->assertCreated()->json('data');
        $this->assertSame(9, $rental['rental_days']);
        $this->assertSame(2, $rental['billed_units']);
        $this->assertEquals(12000, $rental['total_amount']);

        $monthly = $this->createVehicle();
        $rental = $this->rent($monthly['id'], ['rate_type' => 'Monthly', 'expected_return_date' => '2026-10-11', 'paid_amount' => 40000])
            ->assertCreated()->json('data');
        $this->assertSame(2, $rental['billed_units']);
        $this->assertSame('Paid', $rental['payment_status']);

        $other = $this->createVehicle();
        $this->rent($other['id'], ['paid_amount' => 999999])->assertStatus(422)->assertJsonValidationErrors('paid_amount');
        $this->assertSame('Available', $this->vehicleStatus($other['id']));
    }

    public function test_maintenance_in_progress_blocks_rental_and_completion_releases_vehicle(): void
    {
        $vehicle = $this->createVehicle();

        $record = $this->postJson('/api/vehicle-maintenance', [
            'vehicle_id' => $vehicle['id'],
            'maintenance_date' => '2026-09-10',
            'maintenance_type' => 'Repair',
            'parts_cost' => 1500.5,
            'labour_cost' => 500,
            'meter_reading' => 1200,
            'meter_unit' => 'hours',
            'status' => 'In Progress',
        ])->assertCreated()->json('data');
        $this->assertEquals(2000.5, $record['total_cost']);
        $this->assertSame('Under Maintenance', $this->vehicleStatus($vehicle['id']));

        $this->rent($vehicle['id'])->assertStatus(422)->assertJsonValidationErrors('vehicle_id');
        $this->putJson("/api/vehicles/{$vehicle['id']}", ['status' => 'Available'])
            ->assertStatus(422)->assertJsonValidationErrors('status');

        $this->putJson("/api/vehicle-maintenance/{$record['id']}", ['status' => 'Completed'])->assertOk();
        $this->assertSame('Available', $this->vehicleStatus($vehicle['id']));

        $details = $this->getJson("/api/vehicles/{$vehicle['id']}")->json('data');
        $this->assertEquals(2000.5, $details['stats']['total_maintenance_cost']);
        $this->assertCount(1, $details['maintenance']);

        $this->postJson('/api/vehicle-maintenance', [
            'vehicle_id' => $vehicle['id'],
            'maintenance_date' => '2026-09-10',
            'maintenance_type' => 'Inspection',
            'next_maintenance_date' => '2026-09-01',
        ])->assertStatus(422)->assertJsonValidationErrors('next_maintenance_date');
    }

    public function test_manual_under_maintenance_is_kept_when_scheduled_maintenance_is_added(): void
    {
        $vehicle = $this->createVehicle();
        $this->putJson("/api/vehicles/{$vehicle['id']}", ['status' => 'Under Maintenance'])->assertOk();

        $this->postJson('/api/vehicle-maintenance', [
            'vehicle_id' => $vehicle['id'],
            'maintenance_date' => '2026-09-20',
            'maintenance_type' => 'Routine Service',
        ])->assertCreated()->assertJsonPath('data.status', 'Scheduled');

        $this->assertSame('Under Maintenance', $this->vehicleStatus($vehicle['id']));
    }

    public function test_rented_vehicle_cannot_start_maintenance_or_change_status(): void
    {
        $vehicle = $this->createVehicle();
        $this->rent($vehicle['id'])->assertCreated();

        $this->postJson('/api/vehicle-maintenance', [
            'vehicle_id' => $vehicle['id'],
            'maintenance_date' => '2026-09-10',
            'maintenance_type' => 'Repair',
            'status' => 'In Progress',
        ])->assertStatus(422)->assertJsonValidationErrors('status');

        $this->putJson("/api/vehicles/{$vehicle['id']}", ['status' => 'Out of Service'])
            ->assertStatus(422)->assertJsonValidationErrors('status');
        $this->assertSame('Rented', $this->vehicleStatus($vehicle['id']));
    }

    public function test_vehicle_with_history_cannot_be_deleted_but_new_vehicle_can(): void
    {
        $used = $this->createVehicle();
        $this->rent($used['id'])->assertCreated();
        $unused = $this->createVehicle();

        $this->deleteJson("/api/vehicles/{$used['id']}")->assertStatus(422)->assertJsonValidationErrors('vehicle');
        $this->deleteJson("/api/vehicles/{$unused['id']}")->assertOk();
    }

    public function test_customer_with_vehicle_rentals_is_protected(): void
    {
        $vehicle = $this->createVehicle();
        $this->rent($vehicle['id'])->assertCreated();

        $this->assertTrue($this->customer->fresh()->hasRelatedTransactions());
    }

    public function test_photo_and_receipt_uploads_are_private(): void
    {
        Storage::fake('local');
        $vehicle = $this->createVehicle();

        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
        $this->post("/api/vehicles/{$vehicle['id']}/photo", ['photo' => UploadedFile::fake()->createWithContent('v.png', $png)], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.has_photo', true)->assertJsonMissingPath('data.photo_path');
        $this->get("/api/vehicles/{$vehicle['id']}/photo")->assertOk();

        $record = $this->postJson('/api/vehicle-maintenance', [
            'vehicle_id' => $vehicle['id'],
            'maintenance_date' => '2026-09-10',
            'maintenance_type' => 'Oil Change',
        ])->json('data');
        $this->post("/api/vehicle-maintenance/{$record['id']}/receipt", ['receipt' => UploadedFile::fake()->create('bill.pdf', 20, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.has_receipt', true);
        $this->getJson("/api/vehicles/{$vehicle['id']}")->assertJsonPath('data.documents.0.name', 'bill.pdf');

        $this->post("/api/vehicle-maintenance/{$record['id']}/receipt", ['receipt' => UploadedFile::fake()->create('x.exe', 5)], ['Accept' => 'application/json'])
            ->assertStatus(422);
    }

    public function test_staff_can_view_and_rent_but_not_manage_vehicles(): void
    {
        $vehicle = $this->createVehicle();

        $staff = Role::query()->where('name', 'Staff')->firstOrFail();
        Sanctum::actingAs(User::factory()->create(['role_id' => $staff->id, 'role' => 'Staff', 'status' => 'Active']));
        $this->getJson('/api/vehicles')->assertOk();
        $this->postJson('/api/vehicles', ['name' => 'X', 'category' => 'Crane', 'registration_number' => 'S1'])->assertForbidden();
        $this->deleteJson("/api/vehicles/{$vehicle['id']}")->assertForbidden();
        $this->postJson('/api/vehicle-maintenance', ['vehicle_id' => $vehicle['id'], 'maintenance_date' => '2026-09-10', 'maintenance_type' => 'Repair'])
            ->assertForbidden();
        $this->rent($vehicle['id'])->assertCreated();
    }

    public function test_accountant_is_view_only(): void
    {
        $vehicle = $this->createVehicle();

        $accountant = Role::query()->where('name', 'Accountant')->firstOrFail();
        Sanctum::actingAs(User::factory()->create(['role_id' => $accountant->id, 'role' => 'Accountant', 'status' => 'Active']));
        $this->getJson("/api/vehicles/{$vehicle['id']}")->assertOk();
        $this->getJson('/api/vehicle-rentals')->assertOk();
        $this->rent($vehicle['id'])->assertForbidden();
        $this->putJson("/api/vehicles/{$vehicle['id']}", ['name' => 'Renamed'])->assertForbidden();
    }
}
