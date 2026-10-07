<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\Vehicle;
use App\Models\VehicleMaintenance;
use App\Models\VehicleRental;
use App\Services\VehicleRentalService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Demo data for the Vehicles module. Safe to run repeatedly: every record is keyed on a
 * unique DEMO code / registration number and updated in place instead of duplicated.
 * Remove it with `php artisan buildtrack:clear-demo-data` (vehicle tables) when no longer needed.
 */
class VehicleSeeder extends Seeder
{
    /** Vehicles have no category table; the category is a text column on each vehicle. */
    private const CATEGORIES = ['Excavator', 'Truck', 'Loader', 'Concrete Mixer', 'Bulldozer'];

    /** registration => [code, name, category, brand, model, year, purchase date, cost LKR, daily, weekly, monthly, status] */
    private const VEHICLES = [
        'WP CAB-4521' => ['VEH-DEMO-01', 'Hitachi ZX200 Excavator', 'Excavator', 'Hitachi', 'ZX200', 2019, '2019-06-14', 38500000, 85000, 520000, 1950000, Vehicle::STATUS_RENTED],
        'WP CAD-7810' => ['VEH-DEMO-02', 'Komatsu PC210 Excavator', 'Excavator', 'Komatsu', 'PC210-10M0', 2021, '2021-03-02', 44750000, 92000, 560000, 2100000, Vehicle::STATUS_AVAILABLE],
        'WP LK-3345' => ['VEH-DEMO-03', 'Tata Signa 2823.K Tipper', 'Truck', 'Tata', 'Signa 2823.K', 2022, '2022-08-19', 21800000, 45000, 280000, 1050000, Vehicle::STATUS_RENTED],
        'WP LJ-9087' => ['VEH-DEMO-04', 'Ashok Leyland 2518 Tipper', 'Truck', 'Ashok Leyland', '2518', 2018, '2018-11-05', 14200000, 38000, 235000, 880000, Vehicle::STATUS_AVAILABLE],
        'SP LM-1276' => ['VEH-DEMO-05', 'JCB 3DX Backhoe Loader', 'Loader', 'JCB', '3DX Super', 2020, '2020-01-22', 19600000, 42000, 260000, 980000, Vehicle::STATUS_RENTED],
        'CP LN-5530' => ['VEH-DEMO-06', 'Caterpillar 950 GC Wheel Loader', 'Loader', 'Caterpillar', '950 GC', 2023, '2023-05-10', 52400000, 98000, 600000, 2250000, Vehicle::STATUS_MAINTENANCE],
        'WP LP-6612' => ['VEH-DEMO-07', 'Ashok Leyland Concrete Mixer', 'Concrete Mixer', 'Ashok Leyland', '2820 Transit Mixer', 2021, '2021-09-28', 18900000, 40000, 245000, 920000, Vehicle::STATUS_AVAILABLE],
        'NW LQ-2208' => ['VEH-DEMO-08', 'Schwing Stetter Concrete Mixer', 'Concrete Mixer', 'Schwing Stetter', 'AM 8 C', 2017, '2017-04-17', 12600000, 35000, 215000, 800000, Vehicle::STATUS_OUT_OF_SERVICE],
        'WP CAF-3091' => ['VEH-DEMO-09', 'Caterpillar D6 Bulldozer', 'Bulldozer', 'Caterpillar', 'D6', 2024, '2024-02-08', 68900000, 120000, 740000, 2800000, Vehicle::STATUS_MAINTENANCE],
        'SG LR-4467' => ['VEH-DEMO-10', 'Komatsu D65EX Bulldozer', 'Bulldozer', 'Komatsu', 'D65EX-18', 2019, '2019-10-30', 47300000, 105000, 640000, 2400000, Vehicle::STATUS_AVAILABLE],
    ];

    /** Demo customers for the sample rentals, so no real customer history is touched. */
    private const CUSTOMERS = [
        'DEMO-VCUST-01' => ['Demo Customer - Road Works', '+94 77 000 0101'],
        'DEMO-VCUST-02' => ['Demo Customer - Building Site', '+94 77 000 0102'],
        'DEMO-VCUST-03' => ['Demo Customer - Land Clearing', '+94 77 000 0103'],
    ];

    public function run(): void
    {
        Model::withoutEvents(function () {
            DB::transaction(function () {
                $branch = $this->branch();
                $vehicles = $this->vehicles($branch);
                $customers = $this->customers();
                $this->rentals($vehicles, $customers);
                $this->maintenance($vehicles);
            });
        });

        $this->command?->info('Vehicle demo data ready: '.count(self::VEHICLES).' vehicles, 4 rentals, 3 maintenance records.');
    }

    private function branch(): Branch
    {
        return Branch::query()->orderBy('id')->first()
            ?? Branch::query()->firstOrCreate(['name' => 'Head Office'], ['code' => 'HO', 'status' => 'Active']);
    }

    /** @return array<string, Vehicle> keyed by vehicle code */
    private function vehicles(Branch $branch): array
    {
        $vehicles = [];
        foreach (self::VEHICLES as $registration => [$code, $name, $category, $brand, $model, $year, $purchased, $cost, $daily, $weekly, $monthly, $status]) {
            $vehicles[$code] = Vehicle::query()->updateOrCreate(
                ['registration_number' => $registration],
                [
                    'vehicle_code' => $code,
                    'name' => $name,
                    'category' => in_array($category, self::CATEGORIES, true) ? $category : self::CATEGORIES[0],
                    'brand' => $brand,
                    'model' => $model,
                    'manufacture_year' => $year,
                    'purchase_date' => $purchased,
                    'purchase_cost' => $cost,
                    'daily_rate' => $daily,
                    'weekly_rate' => $weekly,
                    'monthly_rate' => $monthly,
                    'branch_id' => $branch->id,
                    'description' => 'Demo vehicle (sample data).',
                    'status' => $status,
                ]
            );
        }

        return $vehicles;
    }

    /** @return array<string, Customer> keyed by customer code */
    private function customers(): array
    {
        $customers = [];
        foreach (self::CUSTOMERS as $code => [$name, $phone]) {
            $customers[$code] = Customer::query()->firstOrCreate(
                ['customer_code' => $code],
                ['name' => $name, 'phone' => $phone, 'status' => 'Active']
            );
        }

        return $customers;
    }

    private function rentals(array $vehicles, array $customers): void
    {
        $calculator = app(VehicleRentalService::class);
        $today = Carbon::today();

        // [number, vehicle, customer, start offset, expected return offset, actual return offset|null, rate type, deposit, paid, status]
        $rows = [
            ['VR-DEMO-0001', 'VEH-DEMO-01', 'DEMO-VCUST-01', -6, 8, null, 'Daily', 150000, 250000, VehicleRental::STATUS_ACTIVE],
            ['VR-DEMO-0002', 'VEH-DEMO-03', 'DEMO-VCUST-02', -10, 18, null, 'Weekly', 100000, 280000, VehicleRental::STATUS_ACTIVE],
            ['VR-DEMO-0003', 'VEH-DEMO-05', 'DEMO-VCUST-03', -3, 4, null, 'Daily', 75000, 0, VehicleRental::STATUS_ACTIVE],
            ['VR-DEMO-0004', 'VEH-DEMO-04', 'DEMO-VCUST-01', -30, -20, -21, 'Daily', 80000, null, VehicleRental::STATUS_COMPLETED],
        ];

        foreach ($rows as [$number, $vehicleCode, $customerCode, $startOffset, $expectedOffset, $actualOffset, $rateType, $deposit, $paid, $status]) {
            $vehicle = $vehicles[$vehicleCode];
            $rate = (float) match ($rateType) {
                'Weekly' => $vehicle->weekly_rate,
                'Monthly' => $vehicle->monthly_rate,
                default => $vehicle->daily_rate,
            };
            $start = $today->copy()->addDays($startOffset)->toDateString();
            $expected = $today->copy()->addDays($expectedOffset)->toDateString();
            $actual = $actualOffset !== null ? $today->copy()->addDays($actualOffset)->toDateString() : null;
            $calc = $calculator->calculate($start, $expected, $actual, $rateType, $rate);
            $paidAmount = min($paid ?? $calc['total_amount'], $calc['total_amount']);

            VehicleRental::query()->updateOrCreate(
                ['rental_number' => $number],
                [
                    'vehicle_id' => $vehicle->id,
                    'customer_id' => $customers[$customerCode]->id,
                    'start_date' => $start,
                    'expected_return_date' => $expected,
                    'actual_return_date' => $actual,
                    'rate_type' => $rateType,
                    'rental_rate' => $rate,
                    'rental_days' => $calc['rental_days'],
                    'billed_units' => $calc['billed_units'],
                    'total_amount' => $calc['total_amount'],
                    'security_deposit' => $deposit,
                    'paid_amount' => $paidAmount,
                    'balance' => round($calc['total_amount'] - $paidAmount, 2),
                    'payment_status' => match (true) {
                        $paidAmount >= $calc['total_amount'] => 'Paid',
                        $paidAmount > 0 => 'Partial',
                        default => 'Pending',
                    },
                    'status' => $status,
                    'notes' => 'Demo rental (sample data).',
                ]
            );
        }
    }

    private function maintenance(array $vehicles): void
    {
        $today = Carbon::today();

        // [number, vehicle, date offset, type, description, parts, labour, next service offset, meter, unit, provider, status]
        $rows = [
            ['VM-DEMO-0001', 'VEH-DEMO-06', -2, 'Repair', 'Hydraulic pump leak - replacing seals and hoses.', 185000, 45000, 90, 6420, 'hours', 'Demo Service Centre', VehicleMaintenance::STATUS_IN_PROGRESS],
            ['VM-DEMO-0002', 'VEH-DEMO-09', -1, 'Routine Service', '500-hour service: engine oil, filters and track tension check.', 96000, 28000, 120, 1510, 'hours', 'Demo Service Centre', VehicleMaintenance::STATUS_IN_PROGRESS],
            ['VM-DEMO-0003', 'VEH-DEMO-08', 5, 'Inspection', 'Drum bearing noise - awaiting inspection before returning to service.', 0, 15000, null, 148200, 'km', 'Demo Workshop', VehicleMaintenance::STATUS_SCHEDULED],
        ];

        foreach ($rows as [$number, $vehicleCode, $dateOffset, $type, $description, $parts, $labour, $nextOffset, $meter, $unit, $provider, $status]) {
            VehicleMaintenance::query()->updateOrCreate(
                ['maintenance_number' => $number],
                [
                    'vehicle_id' => $vehicles[$vehicleCode]->id,
                    'maintenance_date' => $today->copy()->addDays($dateOffset)->toDateString(),
                    'maintenance_type' => $type,
                    'description' => $description,
                    'parts_cost' => $parts,
                    'labour_cost' => $labour,
                    'total_cost' => $parts + $labour,
                    'next_maintenance_date' => $nextOffset !== null ? $today->copy()->addDays($nextOffset)->toDateString() : null,
                    'meter_reading' => $meter,
                    'meter_unit' => $unit,
                    'service_provider' => $provider,
                    'status' => $status,
                    'notes' => 'Demo maintenance record (sample data).',
                ]
            );
        }
    }
}
