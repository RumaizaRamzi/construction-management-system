<?php

namespace App\Http\Requests\Reminders;

use App\Services\ReminderService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreReminderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required_without:reminder', 'nullable', 'string', 'max:255'],
            'reminder' => ['required_without:title', 'nullable', 'string', 'max:255'],
            'message' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'reminder_type' => ['nullable', 'string', 'max:50'],
            'reminderType' => ['nullable', 'string', 'max:50'],
            'source' => ['nullable', 'string', 'max:50'],
            'due_date' => ['nullable', 'date'],
            'dueDate' => ['nullable', 'date'],
            'next_reminder' => ['nullable', 'date'],
            'nextReminder' => ['nullable', 'date'],
            'last_sent' => ['nullable', 'date'],
            'lastSent' => ['nullable', 'date'],
            'status' => ['nullable', 'string', Rule::in(array_merge(ReminderService::STATUSES, ['Unread', 'Read', 'Snoozed', 'Active', 'Paused']))],
            'priority' => ['nullable', 'string', Rule::in(ReminderService::PRIORITIES)],
            'related_type' => ['nullable', 'string', 'max:50'],
            'relatedType' => ['nullable', 'string', 'max:50'],
            'related_id' => ['nullable', 'integer'],
            'relatedId' => ['nullable', 'integer'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'productId' => ['nullable', 'integer', 'exists:products,id'],
            'frequency' => ['nullable', 'string', 'max:50'],
            'is_recurring' => ['nullable', 'boolean'],
            'isRecurring' => ['nullable', 'boolean'],
            'link' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $due = $this->input('due_date')
                ?? $this->input('dueDate')
                ?? $this->input('next_reminder')
                ?? $this->input('nextReminder');
            if (! $due) {
                $validator->errors()->add('due_date', 'Due date is required.');
            }
        });
    }
}
