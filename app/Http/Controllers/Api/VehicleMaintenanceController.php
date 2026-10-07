<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VehicleMaintenance;
use App\Services\VehicleMaintenanceService;
use App\Services\VehicleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class VehicleMaintenanceController extends Controller
{
    private const RECEIPT_DIRECTORY = 'vehicle-receipts';

    public function __construct(private readonly VehicleMaintenanceService $maintenance)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = VehicleMaintenance::query()->with('vehicle')->orderByDesc('maintenance_date')->orderByDesc('id');
        if ($vehicleId = $request->integer('vehicle_id')) {
            $query->where('vehicle_id', $vehicleId);
        }

        return $this->success(
            $query->get()->map(fn (VehicleMaintenance $m) => $this->maintenance->transform($m))->values(),
            'Vehicle maintenance retrieved successfully.'
        );
    }

    public function show(VehicleMaintenance $vehicleMaintenance): JsonResponse
    {
        return $this->success($this->maintenance->transform($vehicleMaintenance), 'Vehicle maintenance retrieved successfully.');
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'vehicle_id' => ['required', 'integer', 'exists:vehicles,id'],
            'maintenance_date' => ['required', 'date'],
            'maintenance_type' => ['required', 'string', 'max:100'],
            ...$this->commonRules(),
        ], $this->messages());
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        return $this->guard(function () use ($validator) {
            $record = $this->maintenance->create($validator->validated());

            return $this->success($this->maintenance->transform($record), 'Maintenance record created successfully.', 201);
        }, 'Unable to create maintenance record. Please try again.');
    }

    public function update(Request $request, VehicleMaintenance $vehicleMaintenance): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'maintenance_date' => ['sometimes', 'date'],
            'maintenance_type' => ['sometimes', 'string', 'max:100'],
            ...$this->commonRules(),
        ], $this->messages());
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        return $this->guard(function () use ($vehicleMaintenance, $validator) {
            $record = $this->maintenance->update($vehicleMaintenance, $validator->validated());

            return $this->success($this->maintenance->transform($record), 'Maintenance record updated successfully.');
        }, 'Unable to update maintenance record. Please try again.');
    }

    public function destroy(VehicleMaintenance $vehicleMaintenance): JsonResponse
    {
        return $this->guard(function () use ($vehicleMaintenance) {
            $this->maintenance->delete($vehicleMaintenance);

            return $this->success(null, 'Maintenance record deleted successfully.');
        }, 'Unable to delete maintenance record. Please try again.');
    }

    public function showReceipt(VehicleMaintenance $vehicleMaintenance): Response
    {
        $disk = Storage::disk(VehicleService::FILE_DISK);
        if (! $vehicleMaintenance->receipt_path || ! $disk->exists($vehicleMaintenance->receipt_path)) {
            return $this->error('No receipt has been uploaded for this record.', 404);
        }

        return $disk->download($vehicleMaintenance->receipt_path, $vehicleMaintenance->receipt_name ?: 'receipt', [
            'Cache-Control' => 'private, no-store, max-age=0',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function uploadReceipt(Request $request, VehicleMaintenance $vehicleMaintenance): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'receipt' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ], [
            'receipt.mimes' => 'The receipt must be a PDF or an image (JPG, PNG or WEBP).',
            'receipt.max' => 'The receipt must not be larger than 10 MB.',
        ]);
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        $file = $request->file('receipt');
        $path = $file->store(self::RECEIPT_DIRECTORY, VehicleService::FILE_DISK);
        if (! $path) {
            return $this->error('Unable to store the receipt. Please try again.', 500);
        }

        $old = $vehicleMaintenance->receipt_path;
        $vehicleMaintenance->receipt_path = $path;
        $vehicleMaintenance->receipt_name = mb_substr(basename($file->getClientOriginalName()), 0, 200);
        $vehicleMaintenance->save();
        if ($old && $old !== $path) {
            Storage::disk(VehicleService::FILE_DISK)->delete($old);
        }

        return $this->success($this->maintenance->transform($vehicleMaintenance->fresh()), 'Receipt uploaded successfully.');
    }

    public function destroyReceipt(VehicleMaintenance $vehicleMaintenance): JsonResponse
    {
        if ($vehicleMaintenance->receipt_path) {
            Storage::disk(VehicleService::FILE_DISK)->delete($vehicleMaintenance->receipt_path);
            $vehicleMaintenance->receipt_path = null;
            $vehicleMaintenance->receipt_name = null;
            $vehicleMaintenance->save();
        }

        return $this->success($this->maintenance->transform($vehicleMaintenance->fresh()), 'Receipt removed successfully.');
    }

    private function commonRules(): array
    {
        return [
            'description' => ['nullable', 'string', 'max:5000'],
            'parts_cost' => ['nullable', 'numeric', 'min:0'],
            'labour_cost' => ['nullable', 'numeric', 'min:0'],
            'next_maintenance_date' => ['nullable', 'date'],
            'meter_reading' => ['nullable', 'numeric', 'min:0'],
            'meter_unit' => ['nullable', Rule::in(['km', 'hours'])],
            'service_provider' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'status' => ['nullable', Rule::in(VehicleMaintenance::STATUSES)],
        ];
    }

    private function messages(): array
    {
        return [
            'vehicle_id.required' => 'Please select a vehicle.',
            'maintenance_date.required' => 'Maintenance date is required.',
            'maintenance_type.required' => 'Maintenance type is required.',
        ];
    }

    private function guard(callable $callback, string $failure): JsonResponse
    {
        try {
            return $callback();
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error($failure, 500);
        }
    }
}
