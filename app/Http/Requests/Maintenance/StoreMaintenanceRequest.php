<?php

namespace App\Http\Requests\Maintenance;

use App\Services\MaintenanceService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMaintenanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'maintenance_number' => ['nullable', 'string', 'max:50', 'unique:maintenance_records,maintenance_number'],
            'maintenanceNumber' => ['nullable', 'string', 'max:50'],
            'maintenanceId' => ['nullable', 'string', 'max:50'],
            'product_id' => ['required_without:productId', 'nullable', 'integer', 'exists:products,id'],
            'productId' => ['required_without:product_id', 'nullable', 'integer', 'exists:products,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'supplierId' => ['nullable', 'integer', 'exists:suppliers,id'],
            'maintenance_type' => ['nullable', 'string', 'max:100'],
            'maintenanceType' => ['nullable', 'string', 'max:100'],
            'description' => ['required', 'string'],
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

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $type = $this->input('maintenance_type') ?? $this->input('maintenanceType');
            if (! $type || trim((string) $type) === '') {
                $validator->errors()->add('maintenance_type', 'Maintenance type is required.');
            }
            $start = $this->input('start_date') ?? $this->input('startDate') ?? $this->input('scheduled_date') ?? $this->input('scheduledDate');
            if (! $start) {
                $validator->errors()->add('start_date', 'Start date is required.');
            }
            $product = $this->input('product_id') ?? $this->input('productId');
            if (! $product) {
                $validator->errors()->add('product_id', 'Product is required.');
            }
        });
    }
}
