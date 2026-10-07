<?php

namespace App\Services;

use App\Models\Vehicle;
use App\Models\VehicleRental;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VehicleRentalService
{
    public function __construct(private readonly VehicleService $vehicles)
    {
    }

    public function transform(VehicleRental $rental): array
    {
        $rental->loadMissing(['vehicle', 'customer']);

        return [
            'id' => $rental->id,
            'rental_number' => $rental->rental_number,
            'vehicle_id' => $rental->vehicle_id,
            'vehicle_name' => $rental->vehicle?->name,
            'vehicle_registration' => $rental->vehicle?->registration_number,
            'customer_id' => $rental->customer_id,
            'customer_name' => $rental->customer?->name,
            'customer_phone' => $rental->customer?->phone,
            'start_date' => $rental->start_date?->toDateString(),
            'expected_return_date' => $rental->expected_return_date?->toDateString(),
            'actual_return_date' => $rental->actual_return_date?->toDateString(),
            'rate_type' => $rental->rate_type,
            'rental_rate' => (float) $rental->rental_rate,
            'rental_days' => (int) $rental->rental_days,
            'billed_units' => (int) $rental->billed_units,
            'total_amount' => (float) $rental->total_amount,
            'security_deposit' => (float) $rental->security_deposit,
            'paid_amount' => (float) $rental->paid_amount,
            'balance' => (float) $rental->balance,
            'payment_status' => $rental->payment_status,
            'status' => $rental->status,
            'notes' => $rental->notes,
            'created_at' => $rental->created_at?->toIso8601String(),
        ];
    }

    /**
     * Days run from start to the actual return (or expected return); without either the rental
     * is charged one period until it is returned, matching product rentals.
     *
     * @return array{rental_days:int, billed_units:int, total_amount:float}
     */
    public function calculate(string $startDate, ?string $expectedReturn, ?string $actualReturn, string $rateType, float $rate): array
    {
        $end = $actualReturn ?: $expectedReturn;
        $days = $end
            ? max((int) Carbon::parse($startDate)->startOfDay()->diffInDays(Carbon::parse($end)->startOfDay()), 1)
            : 1;

        $units = match ($rateType) {
            'Weekly' => (int) ceil($days / 7),
            'Monthly' => (int) ceil($days / 30),
            default => $days,
        };

        return [
            'rental_days' => $days,
            'billed_units' => max($units, 1),
            'total_amount' => round(max($units, 1) * $rate, 2),
        ];
    }

    public function create(array $data): VehicleRental
    {
        return DB::transaction(function () use ($data) {
            $vehicle = Vehicle::query()->lockForUpdate()->findOrFail($data['vehicle_id']);
            $this->assertRentable($vehicle);

            $rateType = $data['rate_type'] ?? 'Daily';
            $rate = array_key_exists('rental_rate', $data) && $data['rental_rate'] !== null
                ? (float) $data['rental_rate']
                : $this->defaultRate($vehicle, $rateType);

            $rental = new VehicleRental([
                'rental_number' => $this->nextNumber(),
                'vehicle_id' => $vehicle->id,
                'customer_id' => $data['customer_id'],
                'start_date' => $data['start_date'],
                'expected_return_date' => $data['expected_return_date'] ?? null,
                'rate_type' => $rateType,
                'rental_rate' => $rate,
                'security_deposit' => (float) ($data['security_deposit'] ?? 0),
                'paid_amount' => (float) ($data['paid_amount'] ?? 0),
                'status' => VehicleRental::STATUS_ACTIVE,
                'notes' => $data['notes'] ?? null,
            ]);
            $this->recalculate($rental);
            $rental->save();

            $this->vehicles->syncStatus($vehicle);

            return $rental->fresh(['vehicle', 'customer']);
        });
    }

    public function update(VehicleRental $rental, array $data): VehicleRental
    {
        return DB::transaction(function () use ($rental, $data) {
            $rental = VehicleRental::query()->lockForUpdate()->findOrFail($rental->id);
            $wasActive = $rental->status === VehicleRental::STATUS_ACTIVE;

            foreach (['customer_id', 'start_date', 'expected_return_date', 'actual_return_date', 'rate_type', 'rental_rate', 'security_deposit', 'paid_amount', 'notes'] as $field) {
                if (array_key_exists($field, $data)) {
                    $rental->{$field} = $data[$field] ?? (in_array($field, ['rental_rate', 'security_deposit', 'paid_amount'], true) ? 0 : null);
                }
            }

            $status = $data['status'] ?? $rental->status;
            if ($status === VehicleRental::STATUS_ACTIVE && ! $wasActive) {
                $vehicle = Vehicle::query()->lockForUpdate()->findOrFail($rental->vehicle_id);
                $this->assertRentable($vehicle);
                $rental->actual_return_date = null;
            }
            if ($status === VehicleRental::STATUS_COMPLETED && ! $rental->actual_return_date) {
                $rental->actual_return_date = now()->toDateString();
            }
            if ($status === VehicleRental::STATUS_ACTIVE && array_key_exists('actual_return_date', $data) && $data['actual_return_date']) {
                $status = VehicleRental::STATUS_COMPLETED;
            }
            $rental->status = $status;

            $this->assertDates($rental);
            $this->recalculate($rental);
            $rental->save();

            $this->vehicles->syncStatus($rental->vehicle);

            return $rental->fresh(['vehicle', 'customer']);
        });
    }

    public function delete(VehicleRental $rental): void
    {
        DB::transaction(function () use ($rental) {
            $vehicle = $rental->vehicle;
            $rental->delete();
            if ($vehicle) {
                $this->vehicles->syncStatus($vehicle);
            }
        });
    }

    public function defaultRate(Vehicle $vehicle, string $rateType): float
    {
        return (float) match ($rateType) {
            'Weekly' => $vehicle->weekly_rate,
            'Monthly' => $vehicle->monthly_rate,
            default => $vehicle->daily_rate,
        };
    }

    private function assertRentable(Vehicle $vehicle): void
    {
        $busy = $vehicle->rentals()->where('status', VehicleRental::STATUS_ACTIVE)->exists();
        if ($busy || $vehicle->status !== Vehicle::STATUS_AVAILABLE) {
            $reason = $busy ? Vehicle::STATUS_RENTED : $vehicle->status;
            throw ValidationException::withMessages([
                'vehicle_id' => ["{$vehicle->name} is {$reason} and cannot be rented right now."],
            ]);
        }
    }

    private function assertDates(VehicleRental $rental): void
    {
        $start = Carbon::parse($rental->start_date)->startOfDay();
        foreach (['expected_return_date' => 'Expected return date', 'actual_return_date' => 'Actual return date'] as $field => $label) {
            if ($rental->{$field} && Carbon::parse($rental->{$field})->startOfDay()->lt($start)) {
                throw ValidationException::withMessages([$field => ["{$label} cannot be before the start date."]]);
            }
        }
    }

    private function recalculate(VehicleRental $rental): void
    {
        $calc = $this->calculate(
            Carbon::parse($rental->start_date)->toDateString(),
            $rental->expected_return_date ? Carbon::parse($rental->expected_return_date)->toDateString() : null,
            $rental->actual_return_date ? Carbon::parse($rental->actual_return_date)->toDateString() : null,
            $rental->rate_type ?: 'Daily',
            (float) $rental->rental_rate
        );
        $rental->rental_days = $calc['rental_days'];
        $rental->billed_units = $calc['billed_units'];
        $rental->total_amount = $calc['total_amount'];

        $paid = round((float) $rental->paid_amount, 2);
        if ($paid > $calc['total_amount']) {
            throw ValidationException::withMessages([
                'paid_amount' => ['Payment amount cannot be more than the rental total of '.number_format($calc['total_amount'], 2).'.'],
            ]);
        }
        $rental->balance = round($calc['total_amount'] - $paid, 2);
        $rental->payment_status = match (true) {
            $calc['total_amount'] > 0 && $paid >= $calc['total_amount'] => 'Paid',
            $paid > 0 => 'Partial',
            default => 'Pending',
        };
    }

    private function nextNumber(): string
    {
        $prefix = 'VR-'.now()->year.'-';
        $latest = VehicleRental::query()->where('rental_number', 'like', $prefix.'%')->orderByDesc('rental_number')->value('rental_number');
        $next = $latest && preg_match('/-(\d+)$/', $latest, $m) ? ((int) $m[1]) + 1 : 1;

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
