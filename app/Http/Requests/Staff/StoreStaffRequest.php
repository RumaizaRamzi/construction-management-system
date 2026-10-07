<?php

namespace App\Http\Requests\Staff;

use App\Models\Staff;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreStaffRequest extends FormRequest
{
    /** Sri Lankan NIC: old format 9 digits + V/X, new format 12 digits. */
    public const NIC_PATTERN = '/^(\d{9}[VvXx]|\d{12})$/';

    /** Digits with optional leading +, spaces, dashes or brackets; 9–15 digits in total. */
    public const PHONE_PATTERN = '/^\+?[0-9\s\-()]{9,20}$/';

    public function authorize(): bool
    {
        return $this->user()?->hasPermission('staff.create') ?? false;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(array_filter([
            'nic' => is_string($this->nic) ? strtoupper(trim($this->nic)) : $this->nic,
            'staff_code' => is_string($this->staff_code) ? strtoupper(trim($this->staff_code)) : $this->staff_code,
        ], fn ($v) => $v !== null));
    }

    public function rules(): array
    {
        return $this->staffRules(null, ['required']);
    }

    public function messages(): array
    {
        return self::friendlyMessages();
    }

    protected function staffRules(?int $ignoreId, array $required): array
    {
        return [
            'staff_code' => ['nullable', 'string', 'max:30', Rule::unique('staff', 'staff_code')->ignore($ignoreId)],
            'full_name' => [...$required, 'string', 'max:150'],
            'nic' => [...$required, 'string', 'max:20', 'regex:'.self::NIC_PATTERN, Rule::unique('staff', 'nic')->ignore($ignoreId)],
            'phone' => [...$required, 'string', 'max:30', 'regex:'.self::PHONE_PATTERN],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => [...$required, 'string', 'max:500'],
            'role_id' => [...$required, 'integer', 'exists:staff_roles,id'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'joined_date' => [...$required, 'date', 'before_or_equal:today'],
            'status' => ['nullable', Rule::in(Staff::STATUSES)],
            'user_id' => ['nullable', 'integer', 'exists:users,id', Rule::unique('staff', 'user_id')->ignore($ignoreId)],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public static function friendlyMessages(): array
    {
        return [
            'full_name.required' => 'Full name is required.',
            'nic.required' => 'NIC number is required.',
            'nic.regex' => 'Enter a valid NIC number (9 digits followed by V or X, or 12 digits).',
            'nic.unique' => 'A staff member with this NIC number already exists.',
            'staff_code.unique' => 'This staff code is already in use. Leave it blank to generate one automatically.',
            'phone.required' => 'Phone number is required.',
            'phone.regex' => 'Enter a valid phone number, e.g. 077 123 4567 or +94 77 123 4567.',
            'address.required' => 'Address is required.',
            'role_id.required' => 'Please select a role.',
            'role_id.exists' => 'Please select a valid role.',
            'joined_date.required' => 'Joined date is required.',
            'joined_date.before_or_equal' => 'Joined date cannot be in the future.',
            'user_id.unique' => 'This user account is already linked to another staff member.',
        ];
    }
}
