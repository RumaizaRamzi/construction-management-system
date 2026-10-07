<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Staff;
use App\Models\StaffAssignment;
use App\Services\StaffService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Throwable;

class StaffAssignmentController extends Controller
{
    public function __construct(private readonly StaffService $staff)
    {
    }

    public function index(Staff $staff): JsonResponse
    {
        return $this->success($this->staff->assignments($staff), 'Assignments retrieved successfully.');
    }

    public function store(Request $request, Staff $staff): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'vehicle_id' => ['nullable', 'integer', 'exists:vehicles,id', 'required_without:rental_id'],
            'rental_id' => ['nullable', 'integer', 'exists:rentals,id', 'required_without:vehicle_id'],
            'assigned_from' => ['required', 'date'],
            'assigned_to' => ['nullable', 'date', 'after_or_equal:assigned_from'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'vehicle_id.required_without' => 'Select a vehicle or a rental.',
            'rental_id.required_without' => 'Select a vehicle or a rental.',
            'assigned_from.required' => 'Start date is required.',
            'assigned_to.after_or_equal' => 'End date cannot be before the start date.',
        ]);
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        try {
            $assignment = $this->staff->assign($staff, $validator->validated());

            return $this->success($this->staff->transformAssignment($assignment), 'Staff assigned successfully.', 201);
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to save assignment. Please try again.', 500);
        }
    }

    public function destroy(StaffAssignment $staffAssignment): JsonResponse
    {
        try {
            $staffAssignment->delete();

            return $this->success(null, 'Assignment removed.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to remove assignment. Please try again.', 500);
        }
    }
}
