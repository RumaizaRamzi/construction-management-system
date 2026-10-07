<?php

namespace App\Services;

use App\Models\Vehicle;
use App\Models\VehicleMaintenance;
use App\Models\VehicleRental;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class VehicleMaintenanceService
{
    public function __construct(private readonly VehicleService $vehicles)
    {
    }

    public function transform(VehicleMaintenance $record, ?Vehicle $vehicle = null): array
    {
        $vehicle ??= $record->relationLoaded('vehicle') ? $record->vehicle : $record->vehicle()->first();

        return [
            'id' => $record->id,
            'maintenance_number' => $record->maintenance_number,
            'vehicle_id' => $record->vehicle_id,
            'vehicle_name' => $vehicle?->name,
            'vehicle_registration' => $vehicle?->registration_number,
            'maintenance_date' => $record->maintenance_date?->toDateString(),
            'maintenance_type' => $record->maintenance_type,
            'description' => $record->description,
            'parts_cost' => (float) $record->parts_cost,
            'labour_cost' => (float) $record->labour_cost,
            'total_cost' => (float) $record->total_cost,
            'next_maintenance_date' => $record->next_maintenance_date?->toDateString(),
            'meter_reading' => $record->meter_reading !== null ? (float) $record->meter_reading : null,
            'meter_unit' => $record->meter_unit,
            'service_provider' => $record->service_provider,
            'has_receipt' => (bool) $record->receipt_path,
            'receipt_name' => $record->receipt_name,
            'notes' => $record->notes,
            'status' => $record->status,
            'created_at' => $record->created_at?->toIso8601String(),
        ];
    }

    public function create(array $data): VehicleMaintenance
    {
        return DB::transaction(function () use ($data) {
            $vehicle = Vehicle::query()->lockForUpdate()->findOrFail($data['vehicle_id']);
            $record = new VehicleMaintenance([
                ...$this->fields($data),
                'maintenance_number' => $this->nextNumber(),
                'vehicle_id' => $vehicle->id,
                'status' => $data['status'] ?? VehicleMaintenance::STATUS_SCHEDULED,
            ]);
            $this->assertCanStart($vehicle, $record->status);
            $this->assertDates($record);
            $record->total_cost = round((float) $record->parts_cost + (float) $record->labour_cost, 2);
            $record->save();

            $this->vehicles->syncStatus($vehicle);

            return $record->fresh('vehicle');
        });
    }

    public function update(VehicleMaintenance $record, array $data): VehicleMaintenance
    {
        return DB::transaction(function () use ($record, $data) {
            $record = VehicleMaintenance::query()->lockForUpdate()->findOrFail($record->id);
            $vehicle = Vehicle::query()->lockForUpdate()->findOrFail($record->vehicle_id);

            $wasInProgress = $record->status === VehicleMaintenance::STATUS_IN_PROGRESS;
            $record->fill($this->fields($data));
            if (! empty($data['status']) && $data['status'] !== $record->status) {
                if ($data['status'] === VehicleMaintenance::STATUS_IN_PROGRESS) {
                    $this->assertCanStart($vehicle, $data['status']);
                }
                $record->status = $data['status'];
            }
            $this->assertDates($record);
            $record->total_cost = round((float) $record->parts_cost + (float) $record->labour_cost, 2);
            $record->save();

            $this->vehicles->syncStatus($vehicle, $wasInProgress && $record->status !== VehicleMaintenance::STATUS_IN_PROGRESS);

            return $record->fresh('vehicle');
        });
    }

    public function delete(VehicleMaintenance $record): void
    {
        DB::transaction(function () use ($record) {
            $vehicle = $record->vehicle;
            $receipt = $record->receipt_path;
            $wasInProgress = $record->status === VehicleMaintenance::STATUS_IN_PROGRESS;
            $record->delete();
            if ($receipt) {
                Storage::disk(VehicleService::FILE_DISK)->delete($receipt);
            }
            if ($vehicle) {
                $this->vehicles->syncStatus($vehicle, $wasInProgress);
            }
        });
    }

    private function assertCanStart(Vehicle $vehicle, string $status): void
    {
        if ($status !== VehicleMaintenance::STATUS_IN_PROGRESS) {
            return;
        }
        if ($vehicle->rentals()->where('status', VehicleRental::STATUS_ACTIVE)->exists()) {
            throw ValidationException::withMessages([
                'status' => ["{$vehicle->name} is currently rented. Complete the rental before starting maintenance, or save this record as Scheduled."],
            ]);
        }
    }

    private function assertDates(VehicleMaintenance $record): void
    {
        if ($record->next_maintenance_date && $record->maintenance_date
            && Carbon::parse($record->next_maintenance_date)->lt(Carbon::parse($record->maintenance_date))) {
            throw ValidationException::withMessages([
                'next_maintenance_date' => ['Next maintenance date cannot be before the maintenance date.'],
            ]);
        }
    }

    private function fields(array $data): array
    {
        $fields = [];
        foreach ([
            'maintenance_date', 'maintenance_type', 'description', 'parts_cost', 'labour_cost',
            'next_maintenance_date', 'meter_reading', 'meter_unit', 'service_provider', 'notes',
        ] as $key) {
            if (array_key_exists($key, $data)) {
                $value = $data[$key];
                if (in_array($key, ['parts_cost', 'labour_cost'], true)) {
                    $value = (float) ($value ?? 0);
                }
                $fields[$key] = is_string($value) && trim($value) === '' ? null : $value;
            }
        }

        return $fields;
    }

    private function nextNumber(): string
    {
        $prefix = 'VM-'.now()->year.'-';
        $latest = VehicleMaintenance::query()->where('maintenance_number', 'like', $prefix.'%')->orderByDesc('maintenance_number')->value('maintenance_number');
        $next = $latest && preg_match('/-(\d+)$/', $latest, $m) ? ((int) $m[1]) + 1 : 1;

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
