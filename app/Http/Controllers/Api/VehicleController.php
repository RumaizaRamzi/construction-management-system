<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use App\Models\VehicleMaintenance;
use App\Models\VehicleRental;
use App\Services\VehicleMaintenanceService;
use App\Services\VehicleRentalService;
use App\Services\VehicleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class VehicleController extends Controller
{
    private const PHOTO_DIRECTORY = 'vehicle-photos';

    public function __construct(
        private readonly VehicleService $vehicles,
        private readonly VehicleRentalService $rentals,
        private readonly VehicleMaintenanceService $maintenance,
    ) {
    }

    public function index(): JsonResponse
    {
        $rows = Vehicle::query()->orderBy('name')->get()->map(fn (Vehicle $v) => $this->vehicles->transform($v))->values();

        return $this->success([
            'data' => $rows,
            'categories' => Vehicle::CATEGORIES,
            'statuses' => Vehicle::STATUSES,
            'maintenance_types' => VehicleMaintenance::TYPES,
            'maintenance_statuses' => VehicleMaintenance::STATUSES,
            'rental_statuses' => VehicleRental::STATUSES,
            'rate_types' => VehicleRental::RATE_TYPES,
        ], 'Vehicles retrieved successfully.');
    }

    public function show(Request $request, Vehicle $vehicle): JsonResponse
    {
        return $this->success(
            $this->vehicles->details($vehicle, $request->user(), $this->rentals, $this->maintenance),
            'Vehicle retrieved successfully.'
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), $this->rules());
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        return $this->guard(function () use ($validator) {
            $vehicle = $this->vehicles->create($validator->validated());

            return $this->success($this->vehicles->transform($vehicle), 'Vehicle added successfully.', 201);
        }, 'Unable to add vehicle. Please try again.');
    }

    public function update(Request $request, Vehicle $vehicle): JsonResponse
    {
        $validator = Validator::make($request->all(), $this->rules($vehicle));
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        return $this->guard(function () use ($vehicle, $validator) {
            $updated = $this->vehicles->update($vehicle, $validator->validated());

            return $this->success($this->vehicles->transform($updated), 'Vehicle updated successfully.');
        }, 'Unable to update vehicle. Please try again.');
    }

    public function destroy(Vehicle $vehicle): JsonResponse
    {
        return $this->guard(function () use ($vehicle) {
            $this->vehicles->delete($vehicle);

            return $this->success(null, 'Vehicle deleted successfully.');
        }, 'Unable to delete vehicle. Please try again.');
    }

    public function showPhoto(Vehicle $vehicle): Response
    {
        $disk = Storage::disk(VehicleService::FILE_DISK);
        if (! $vehicle->photo_path || ! $disk->exists($vehicle->photo_path)) {
            return $this->error('No photo has been uploaded for this vehicle.', 404);
        }

        return $disk->response($vehicle->photo_path, 'vehicle-'.$vehicle->id, [
            'Cache-Control' => 'private, max-age=300',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function uploadPhoto(Request $request, Vehicle $vehicle): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'photo' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ], [
            'photo.image' => 'The vehicle photo must be an image (JPG, PNG or WEBP).',
            'photo.mimes' => 'The vehicle photo must be a JPG, PNG or WEBP image.',
            'photo.max' => 'The vehicle photo must not be larger than 5 MB.',
        ]);
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        $path = $request->file('photo')->store(self::PHOTO_DIRECTORY, VehicleService::FILE_DISK);
        if (! $path) {
            return $this->error('Unable to store the photo. Please try again.', 500);
        }

        $old = $vehicle->photo_path;
        $vehicle->photo_path = $path;
        $vehicle->save();
        if ($old && $old !== $path) {
            Storage::disk(VehicleService::FILE_DISK)->delete($old);
        }

        return $this->success($this->vehicles->transform($vehicle->fresh()), 'Vehicle photo uploaded successfully.');
    }

    public function destroyPhoto(Vehicle $vehicle): JsonResponse
    {
        if ($vehicle->photo_path) {
            Storage::disk(VehicleService::FILE_DISK)->delete($vehicle->photo_path);
            $vehicle->photo_path = null;
            $vehicle->save();
        }

        return $this->success($this->vehicles->transform($vehicle->fresh()), 'Vehicle photo removed successfully.');
    }

    private function rules(?Vehicle $vehicle = null): array
    {
        $required = $vehicle ? 'sometimes' : 'required';
        $maxYear = (int) now()->year + 1;

        return [
            'name' => [$required, 'string', 'max:150'],
            'category' => [$required, 'string', 'max:100'],
            'registration_number' => [
                $required, 'string', 'max:50',
                Rule::unique('vehicles', 'registration_number')->ignore($vehicle?->id),
            ],
            'brand' => ['nullable', 'string', 'max:100'],
            'model' => ['nullable', 'string', 'max:100'],
            'manufacture_year' => ['nullable', 'integer', 'min:1950', "max:{$maxYear}"],
            'purchase_date' => ['nullable', 'date', 'before_or_equal:today'],
            'purchase_cost' => ['nullable', 'numeric', 'min:0'],
            'daily_rate' => ['nullable', 'numeric', 'min:0'],
            'weekly_rate' => ['nullable', 'numeric', 'min:0'],
            'monthly_rate' => ['nullable', 'numeric', 'min:0'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['nullable', Rule::in(Vehicle::STATUSES)],
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
