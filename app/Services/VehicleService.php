<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleMaintenance;
use App\Models\VehicleRental;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class VehicleService
{
    public const FILE_DISK = 'local';

    public function transform(Vehicle $vehicle): array
    {
        return [
            'id' => $vehicle->id,
            'vehicle_code' => $vehicle->vehicle_code,
            'name' => $vehicle->name,
            'category' => $vehicle->category,
            'registration_number' => $vehicle->registration_number,
            'brand' => $vehicle->brand,
            'model' => $vehicle->model,
            'manufacture_year' => $vehicle->manufacture_year,
            'purchase_date' => $vehicle->purchase_date?->toDateString(),
            'purchase_cost' => $vehicle->purchase_cost !== null ? (float) $vehicle->purchase_cost : null,
            'daily_rate' => $vehicle->daily_rate !== null ? (float) $vehicle->daily_rate : null,
            'weekly_rate' => $vehicle->weekly_rate !== null ? (float) $vehicle->weekly_rate : null,
            'monthly_rate' => $vehicle->monthly_rate !== null ? (float) $vehicle->monthly_rate : null,
            'branch_id' => $vehicle->branch_id,
            'has_photo' => (bool) $vehicle->photo_path,
            'description' => $vehicle->description,
            'status' => $vehicle->status,
            'created_at' => $vehicle->created_at?->toIso8601String(),
            'updated_at' => $vehicle->updated_at?->toIso8601String(),
        ];
    }

    public function create(array $data): Vehicle
    {
        return DB::transaction(function () use ($data) {
            $status = $data['status'] ?? Vehicle::STATUS_AVAILABLE;
            if ($status === Vehicle::STATUS_RENTED) {
                throw ValidationException::withMessages([
                    'status' => ['A vehicle becomes Rented automatically when a rental is created.'],
                ]);
            }

            return Vehicle::query()->create([
                ...$this->fields($data),
                'vehicle_code' => $this->nextCode(),
                'status' => $status,
            ]);
        });
    }

    public function update(Vehicle $vehicle, array $data): Vehicle
    {
        return DB::transaction(function () use ($vehicle, $data) {
            $vehicle = Vehicle::query()->lockForUpdate()->findOrFail($vehicle->id);
            $vehicle->fill(array_intersect_key($this->fields($data), $data));

            if (! empty($data['status']) && $data['status'] !== $vehicle->getOriginal('status')) {
                $this->assertManualStatus($vehicle, $data['status']);
                $vehicle->status = $data['status'];
            }

            $vehicle->save();

            return $vehicle->fresh();
        });
    }

    public function delete(Vehicle $vehicle): void
    {
        DB::transaction(function () use ($vehicle) {
            $rentals = $vehicle->rentals()->count();
            $maintenance = $vehicle->maintenance()->count();
            if ($rentals || $maintenance) {
                throw ValidationException::withMessages([
                    'vehicle' => [
                        "This vehicle has {$rentals} rental(s) and {$maintenance} maintenance record(s) and cannot be deleted. Mark it Out of Service instead.",
                    ],
                ]);
            }
            $photo = $vehicle->photo_path;
            $vehicle->delete();
            if ($photo) {
                Storage::disk(self::FILE_DISK)->delete($photo);
            }
        });
    }

    /**
     * Derive availability from rentals and maintenance. Out of Service is only ever set by hand, and a
     * manually set Under Maintenance is only released when an in-progress maintenance record ends.
     */
    public function syncStatus(Vehicle $vehicle, bool $maintenanceEnded = false): void
    {
        $vehicle = Vehicle::query()->lockForUpdate()->find($vehicle->id);
        if (! $vehicle) {
            return;
        }

        $status = match (true) {
            $vehicle->rentals()->where('status', VehicleRental::STATUS_ACTIVE)->exists() => Vehicle::STATUS_RENTED,
            $vehicle->maintenance()->where('status', VehicleMaintenance::STATUS_IN_PROGRESS)->exists() => Vehicle::STATUS_MAINTENANCE,
            $vehicle->status === Vehicle::STATUS_RENTED => Vehicle::STATUS_AVAILABLE,
            $vehicle->status === Vehicle::STATUS_MAINTENANCE && $maintenanceEnded => Vehicle::STATUS_AVAILABLE,
            default => $vehicle->status,
        };

        if ($status !== $vehicle->status) {
            $vehicle->status = $status;
            $vehicle->save();
        }
    }

    public function stats(Vehicle $vehicle): array
    {
        $rentals = $vehicle->rentals()->where('status', '!=', VehicleRental::STATUS_CANCELLED);

        return [
            'times_rented' => (clone $rentals)->count(),
            'total_rental_income' => (float) (clone $rentals)->sum('paid_amount'),
            'total_rental_billed' => (float) (clone $rentals)->sum('total_amount'),
            'total_maintenance_cost' => (float) $vehicle->maintenance()
                ->where('status', '!=', VehicleMaintenance::STATUS_CANCELLED)
                ->sum('total_cost'),
        ];
    }

    public function details(Vehicle $vehicle, ?User $user, VehicleRentalService $rentals, VehicleMaintenanceService $maintenance): array
    {
        $rentalRows = $vehicle->rentals()->with('customer')->orderByDesc('start_date')->orderByDesc('id')->get();
        $maintenanceRows = $vehicle->maintenance()->orderByDesc('maintenance_date')->orderByDesc('id')->get();
        $current = $rentalRows->firstWhere('status', VehicleRental::STATUS_ACTIVE);

        $documents = $maintenanceRows
            ->filter(fn (VehicleMaintenance $m) => $m->receipt_path)
            ->map(fn (VehicleMaintenance $m) => [
                'maintenance_id' => $m->id,
                'maintenance_number' => $m->maintenance_number,
                'name' => $m->receipt_name ?: 'Receipt',
                'date' => $m->maintenance_date?->toDateString(),
            ])
            ->values();

        return [
            ...$this->transform($vehicle),
            'stats' => $this->stats($vehicle),
            'current_rental' => $current ? $rentals->transform($current) : null,
            'rentals' => $rentalRows->map(fn (VehicleRental $r) => $rentals->transform($r))->values(),
            'maintenance' => $maintenanceRows->map(fn (VehicleMaintenance $m) => $maintenance->transform($m, $vehicle))->values(),
            'documents' => $documents,
            'activity' => $user?->hasPermission('activity.view')
                ? $this->activity($vehicle, $rentalRows->pluck('id')->all(), $maintenanceRows->pluck('id')->all())
                : [],
        ];
    }

    private function activity(Vehicle $vehicle, array $rentalIds, array $maintenanceIds): array
    {
        return ActivityLog::query()
            ->where(function ($q) use ($vehicle, $rentalIds, $maintenanceIds) {
                $q->where(fn ($s) => $s->where('subject_type', 'Vehicle')->where('subject_id', $vehicle->id));
                if ($rentalIds) {
                    $q->orWhere(fn ($s) => $s->where('subject_type', 'VehicleRental')->whereIn('subject_id', $rentalIds));
                }
                if ($maintenanceIds) {
                    $q->orWhere(fn ($s) => $s->where('subject_type', 'VehicleMaintenance')->whereIn('subject_id', $maintenanceIds));
                }
            })
            ->latest('id')
            ->limit(50)
            ->get()
            ->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'user_name' => $log->user_name ?? 'System',
                'action' => $log->action,
                'description' => $log->description,
                'created_at' => $log->created_at?->toIso8601String(),
            ])
            ->all();
    }

    private function assertManualStatus(Vehicle $vehicle, string $status): void
    {
        $hasActiveRental = $vehicle->rentals()->where('status', VehicleRental::STATUS_ACTIVE)->exists();
        if ($hasActiveRental) {
            throw ValidationException::withMessages([
                'status' => ['This vehicle is currently rented. Complete or cancel the rental before changing its status.'],
            ]);
        }
        if ($status === Vehicle::STATUS_RENTED) {
            throw ValidationException::withMessages([
                'status' => ['A vehicle becomes Rented automatically when a rental is created.'],
            ]);
        }
        $inProgress = $vehicle->maintenance()->where('status', VehicleMaintenance::STATUS_IN_PROGRESS)->exists();
        if ($inProgress && $status === Vehicle::STATUS_AVAILABLE) {
            throw ValidationException::withMessages([
                'status' => ['This vehicle has maintenance in progress. Complete or cancel it before marking the vehicle Available.'],
            ]);
        }
    }

    private function fields(array $data): array
    {
        $fields = [];
        foreach ([
            'name', 'category', 'registration_number', 'brand', 'model', 'manufacture_year',
            'purchase_date', 'purchase_cost', 'daily_rate', 'weekly_rate', 'monthly_rate',
            'branch_id', 'description',
        ] as $key) {
            if (array_key_exists($key, $data)) {
                $value = $data[$key];
                $fields[$key] = is_string($value) ? (trim($value) === '' ? null : trim($value)) : $value;
            }
        }
        if (isset($fields['registration_number'])) {
            $fields['registration_number'] = strtoupper($fields['registration_number']);
        }

        return $fields;
    }

    private function nextCode(): string
    {
        $latest = Vehicle::query()->where('vehicle_code', 'like', 'VEH-%')->orderByDesc('id')->value('vehicle_code');
        $next = $latest && preg_match('/VEH-(\d+)/', $latest, $m) ? ((int) $m[1]) + 1 : 1;

        do {
            $code = sprintf('VEH-%04d', $next++);
        } while (Vehicle::query()->where('vehicle_code', $code)->exists());

        return $code;
    }
}
