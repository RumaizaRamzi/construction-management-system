<?php

namespace App\Http\Requests\Checks;

use App\Services\CheckService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCheckRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'check_number' => ['nullable', 'string', 'max:50', 'unique:equipment_checks,check_number'],
            'checkNumber' => ['nullable', 'string', 'max:50'],
            'checkId' => ['nullable', 'string', 'max:50'],
            'product_id' => ['required_without:productId', 'nullable', 'integer', 'exists:products,id'],
            'productId' => ['required_without:product_id', 'nullable', 'integer', 'exists:products,id'],
            'rental_id' => ['nullable', 'integer', 'exists:rentals,id'],
            'rentalId' => ['nullable', 'integer', 'exists:rentals,id'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'customerId' => ['nullable', 'integer', 'exists:customers,id'],
            'check_type' => ['nullable', 'string', 'max:150'],
            'checkType' => ['nullable', 'string', 'max:150'],
            'check' => ['nullable', 'string', 'max:150'],
            'name' => ['nullable', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'scheduled_date' => ['nullable', 'date'],
            'scheduledDate' => ['nullable', 'date'],
            'check_date' => ['nullable', 'date'],
            'checkDate' => ['nullable', 'date'],
            'completed_date' => ['nullable', 'date'],
            'completedDate' => ['nullable', 'date'],
            'lastCompleted' => ['nullable', 'date'],
            'next_check_date' => ['nullable', 'date'],
            'nextCheck' => ['nullable', 'date'],
            'frequency' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'string', Rule::in(array_merge(CheckService::STATUSES, ['Due Today', 'Upcoming', 'Overdue']))],
            'priority' => ['nullable', 'string', Rule::in(CheckService::PRIORITIES)],
            'result' => ['nullable', 'string', 'max:100'],
            'condition' => ['nullable', 'string', 'max:50'],
            'checklist_data' => ['nullable', 'array'],
            'assigned_to' => ['nullable', 'string', 'max:100'],
            'assignedTo' => ['nullable', 'string', 'max:100'],
            'checked_by' => ['nullable', 'integer', 'exists:users,id'],
            'checkedBy' => ['nullable', 'integer', 'exists:users,id'],
            'reminder_before' => ['nullable', 'string', 'max:50'],
            'reminderBefore' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $type = $this->input('check_type')
                ?? $this->input('checkType')
                ?? $this->input('check')
                ?? $this->input('name');
            if (! $type || trim((string) $type) === '') {
                $validator->errors()->add('check_type', 'Check type/name is required.');
            }

            $date = $this->input('scheduled_date')
                ?? $this->input('scheduledDate')
                ?? $this->input('check_date')
                ?? $this->input('checkDate');
            if (! $date) {
                $validator->errors()->add('scheduled_date', 'Scheduled date is required.');
            }

            $product = $this->input('product_id') ?? $this->input('productId');
            if (! $product) {
                $validator->errors()->add('product_id', 'Product is required.');
            }
        });
    }
}
