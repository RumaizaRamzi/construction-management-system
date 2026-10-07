<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VehicleRental;
use App\Services\VehicleRentalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class VehicleRentalController extends Controller
{
    public function __construct(private readonly VehicleRentalService $rentals)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = VehicleRental::query()->with(['vehicle', 'customer'])->orderByDesc('start_date')->orderByDesc('id');
        if ($vehicleId = $request->integer('vehicle_id')) {
            $query->where('vehicle_id', $vehicleId);
        }

        return $this->success(
            $query->get()->map(fn (VehicleRental $r) => $this->rentals->transform($r))->values(),
            'Vehicle rentals retrieved successfully.'
        );
    }

    public function show(VehicleRental $vehicleRental): JsonResponse
    {
        return $this->success($this->rentals->transform($vehicleRental), 'Vehicle rental retrieved successfully.');
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'vehicle_id' => ['required', 'integer', 'exists:vehicles,id'],
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'start_date' => ['required', 'date'],
            'expected_return_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            ...$this->commonRules(),
        ], $this->messages());
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        return $this->guard(function () use ($validator) {
            $rental = $this->rentals->create($validator->validated());

            return $this->success($this->rentals->transform($rental), 'Vehicle rental created successfully.', 201);
        }, 'Unable to create vehicle rental. Please try again.');
    }

    public function update(Request $request, VehicleRental $vehicleRental): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => ['sometimes', 'integer', 'exists:customers,id'],
            'start_date' => ['sometimes', 'date'],
            'expected_return_date' => ['nullable', 'date'],
            'actual_return_date' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(VehicleRental::STATUSES)],
            ...$this->commonRules(),
        ], $this->messages());
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        return $this->guard(function () use ($vehicleRental, $validator) {
            $rental = $this->rentals->update($vehicleRental, $validator->validated());
            $message = $rental->status === VehicleRental::STATUS_COMPLETED && $vehicleRental->status !== VehicleRental::STATUS_COMPLETED
                ? 'Vehicle returned and rental completed.'
                : 'Vehicle rental updated successfully.';

            return $this->success($this->rentals->transform($rental), $message);
        }, 'Unable to update vehicle rental. Please try again.');
    }

    public function destroy(VehicleRental $vehicleRental): JsonResponse
    {
        return $this->guard(function () use ($vehicleRental) {
            $this->rentals->delete($vehicleRental);

            return $this->success(null, 'Vehicle rental deleted successfully.');
        }, 'Unable to delete vehicle rental. Please try again.');
    }

    private function commonRules(): array
    {
        return [
            'rate_type' => ['nullable', Rule::in(VehicleRental::RATE_TYPES)],
            'rental_rate' => ['nullable', 'numeric', 'min:0'],
            'security_deposit' => ['nullable', 'numeric', 'min:0'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    private function messages(): array
    {
        return [
            'vehicle_id.required' => 'Please select a vehicle.',
            'customer_id.required' => 'Please select a customer.',
            'start_date.required' => 'Rental start date is required.',
            'expected_return_date.after_or_equal' => 'Expected return date cannot be before the start date.',
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
