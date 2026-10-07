<?php

namespace App\Http\Requests\Checks;

use App\Services\CheckService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCheckRequest extends FormRequest
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
            'rental_id' => ['nullable', 'integer', 'exists:rentals,id'],
            'rentalId' => ['nullable', 'integer', 'exists:rentals,id'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'customerId' => ['nullable', 'integer', 'exists:customers,id'],
            'check_type' => ['sometimes', 'string', 'max:150'],
            'checkType' => ['sometimes', 'string', 'max:150'],
            'check' => ['sometimes', 'string', 'max:150'],
            'name' => ['sometimes', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'scheduled_date' => ['nullable', 'date'],
            'scheduledDate' => ['nullable', 'date'],
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
}
