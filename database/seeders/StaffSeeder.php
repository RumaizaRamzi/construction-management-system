<?php

namespace Database\Seeders;

use App\Models\Attendance;
use App\Models\Branch;
use App\Models\Staff;
use App\Models\StaffAssignment;
use App\Models\StaffRole;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Demo data for the Staff module. Safe to run repeatedly: staff are keyed on a DEMO staff code,
 * attendance on (staff, date) and assignments on their DEMO note, so nothing is duplicated.
 */
class StaffSeeder extends Seeder
{
    private const ROLES = [
        'Manager' => 'Oversees operations and staff.',
        'Cashier' => 'Handles payments and billing.',
        'Driver' => 'Drives company vehicles.',
        'Operator' => 'Operates machinery and equipment.',
        'Storekeeper' => 'Manages stock and the store.',
        'Site Supervisor' => 'Supervises work on site.',
    ];

    /** code => [full name, NIC, phone, address, role, joined, status] */
    private const STAFF = [
        'STF-DEMO-01' => ['Nuwan Perera', '198512345671', '+94 77 100 0001', '12 Temple Road, Maharagama', 'Manager', '2019-02-01', Staff::STATUS_ACTIVE],
        'STF-DEMO-02' => ['Dilani Fernando', '927654321V', '+94 71 100 0002', '45 Galle Road, Moratuwa', 'Cashier', '2021-06-15', Staff::STATUS_ACTIVE],
        'STF-DEMO-03' => ['Kasun Jayasinghe', '199023456782', '+94 76 100 0003', '8 Lake Drive, Kurunegala', 'Driver', '2020-09-01', Staff::STATUS_ACTIVE],
        'STF-DEMO-04' => ['Ruwan Silva', '881234567V', '+94 77 100 0004', '3 Station Road, Gampaha', 'Driver', '2018-04-10', Staff::STATUS_ACTIVE],
        'STF-DEMO-05' => ['Mahesh Bandara', '199134567893', '+94 70 100 0005', '101 Kandy Road, Kadawatha', 'Operator', '2022-01-05', Staff::STATUS_ACTIVE],
        'STF-DEMO-06' => ['Tharindu Wickramasinghe', '199545678904', '+94 75 100 0006', '27 Hill Street, Kandy', 'Operator', '2023-03-20', Staff::STATUS_ACTIVE],
        'STF-DEMO-07' => ['Sanjeewa Rathnayake', '851122334V', '+94 72 100 0007', '9 Main Street, Negombo', 'Storekeeper', '2017-11-01', Staff::STATUS_ACTIVE],
        'STF-DEMO-08' => ['Chaminda Herath', '198256789015', '+94 77 100 0008', '56 Park Avenue, Kalutara', 'Site Supervisor', '2019-08-12', Staff::STATUS_INACTIVE],
    ];

    /** Repeating daily pattern so every run produces the same attendance. */
    private const PATTERN = ['present', 'present', 'late', 'present', 'present', 'present', 'half_day', 'present', 'absent', 'present', 'present', 'leave'];

    public function run(): void
    {
        Model::withoutEvents(function () {
            DB::transaction(function () {
                $roles = $this->roles();
                $staff = $this->staff($roles, $this->branches());
                $days = $this->attendance($staff);
                $assigned = $this->assignments($staff);

                $this->command?->info(sprintf(
                    'Staff demo data ready: %d staff, %d attendance records, %d assignments.',
                    count($staff), $days, $assigned
                ));
            });
        });
    }

    /** @return array<string, StaffRole> */
    private function roles(): array
    {
        $roles = [];
        foreach (self::ROLES as $name => $description) {
            $roles[$name] = StaffRole::query()->firstOrCreate(['name' => $name], ['description' => $description]);
        }

        return $roles;
    }

    /** @return list<int> existing branch ids; a Head Office is created only if there are none. */
    private function branches(): array
    {
        $ids = Branch::query()->where('status', '!=', 'Inactive')->orderBy('id')->pluck('id')->all();
        if (! $ids) {
            $ids = [Branch::query()->firstOrCreate(['name' => 'Head Office'], ['code' => 'HO', 'status' => 'Active'])->id];
        }

        return $ids;
    }

    /** @return array<string, Staff> */
    private function staff(array $roles, array $branchIds): array
    {
        $staff = [];
        $i = 0;
        foreach (self::STAFF as $code => [$name, $nic, $phone, $address, $role, $joined, $status]) {
            $staff[$code] = Staff::query()->updateOrCreate(
                ['staff_code' => $code],
                [
                    'full_name' => $name,
                    'nic' => $nic,
                    'phone' => $phone,
                    'address' => $address,
                    'role_id' => $roles[$role]->id,
                    'branch_id' => $branchIds[$i % count($branchIds)],
                    'joined_date' => $joined,
                    'status' => $status,
                    'notes' => 'Demo staff member (sample data).',
                ]
            );
            $i++;
        }

        return $staff;
    }

    private function attendance(array $staff): int
    {
        $today = Carbon::today();
        $count = 0;
        $offset = 0;
        foreach ($staff as $member) {
            for ($d = 13; $d >= 0; $d--) {
                $date = $today->copy()->subDays($d);
                if ($date->isSunday()) {
                    continue;
                }
                if (! $member->isActive() && $d < 7) {
                    continue;
                }
                $status = self::PATTERN[($date->dayOfYear + $offset) % count(self::PATTERN)];
                $working = ! in_array($status, Attendance::NOT_WORKING, true);
                $attendance = Attendance::query()->where('staff_id', $member->id)->whereDate('date', $date)->first()
                    ?? new Attendance(['staff_id' => $member->id, 'date' => $date->toDateString()]);
                $attendance->fill([
                    'status' => $status,
                    'check_in' => $working ? ($status === 'late' ? '08:45' : '08:00') : null,
                    'check_out' => $working ? ($status === 'half_day' ? '12:30' : '17:00') : null,
                    'notes' => null,
                ])->save();
                $count++;
            }
            $offset += 5;
        }

        return $count;
    }

    private function assignments(array $staff): int
    {
        $vehicles = Vehicle::query()->orderBy('id')->limit(3)->get();
        if ($vehicles->isEmpty()) {
            $this->command?->warn('No vehicles found, so no staff assignments were created.');

            return 0;
        }

        $today = Carbon::today();
        $plan = [
            ['STF-DEMO-03', -20, null],
            ['STF-DEMO-05', -10, 15],
            ['STF-DEMO-04', -45, -15],
        ];
        $created = 0;
        foreach ($plan as $index => [$code, $fromOffset, $toOffset]) {
            $vehicle = $vehicles[$index % $vehicles->count()];
            StaffAssignment::query()->updateOrCreate(
                ['staff_id' => $staff[$code]->id, 'notes' => 'Demo assignment '.($index + 1).' (sample data).'],
                [
                    'vehicle_id' => $vehicle->id,
                    'rental_id' => null,
                    'assigned_from' => $today->copy()->addDays($fromOffset)->toDateString(),
                    'assigned_to' => $toOffset !== null ? $today->copy()->addDays($toOffset)->toDateString() : null,
                ]
            );
            $created++;
        }

        return $created;
    }
}
