<?php

namespace App\Http\Requests\Maintenance;

use App\Services\MaintenanceService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMaintenanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'product_id' => ['sometimes', 'integer', 'exists:products,id'],
            'productId' => ['sometimes', 'integer', 'exists:products,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'supplierId' => ['nullable', 'integer', 'exists:suppliers,id'],
            'maintenance_type' => ['sometimes', 'string', 'max:100'],
            'maintenanceType' => ['sometimes', 'string', 'max:100'],
            'description' => ['sometimes', 'string'],
            'scheduled_date' => ['nullable', 'date'],
            'scheduledDate' => ['nullable', 'date'],
            'start_date' => ['nullable', 'date'],
            'startDate' => ['nullable', 'date'],
            'started_date' => ['nullable', 'date'],
            'startedDate' => ['nullable', 'date'],
            'expected_completion' => ['nullable', 'date'],
            'expectedCompletion' => ['nullable', 'date'],
            'completed_date' => ['nullable', 'date'],
            'completedDate' => ['nullable', 'date'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'estimated_cost' => ['nullable', 'numeric', 'min:0'],
            'estimatedCost' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'string', Rule::in(MaintenanceService::STATUSES)],
            'priority' => ['nullable', 'string', Rule::in(MaintenanceService::PRIORITIES)],
            'technician' => ['nullable', 'string', 'max:100'],
            'next_maintenance_date' => ['nullable', 'date'],
            'nextMaintenanceDate' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
