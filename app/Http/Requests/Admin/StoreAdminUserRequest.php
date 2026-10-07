<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use App\Services\AdminUserService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StoreAdminUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => mb_strtolower(trim($this->input('email')))]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required_without:staff_id', 'nullable', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['nullable', 'string', Password::min(8), 'max:100'],
            'must_change_password' => ['nullable', 'boolean'],
            'role_id' => ['required', 'integer', 'exists:roles,id'],
            'status' => ['nullable', Rule::in(AdminUserService::STATUSES)],
            'phone' => ['nullable', 'string', 'max:50'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'staff_id' => ['nullable', 'integer'],
            ...self::accessRules(),
        ];
    }

    public static function accessRules(): array
    {
        return [
            'access_mode' => ['nullable', Rule::in(User::ACCESS_MODES)],
            'permissions' => ['nullable', 'array', 'required_if:access_mode,'.User::ACCESS_CUSTOM],
            'permissions.*' => ['string', 'distinct', Rule::exists('permissions', 'slug')],
        ];
    }

    public function messages(): array
    {
        return self::friendlyMessages();
    }

    public static function friendlyMessages(): array
    {
        return [
            'name.required_without' => 'Enter a name or choose a staff member.',
            'email.required' => 'Email address is required.',
            'email.email' => 'Enter a valid email address.',
            'email.unique' => 'A user with this email address already exists.',
            'password.min' => 'The password must be at least 8 characters.',
            'role_id.required' => 'Please choose a role.',
            'role_id.exists' => 'The selected role no longer exists.',
            'access_mode.in' => 'Feature access must be role default, full access or selected features.',
            'permissions.required_if' => 'Select at least one feature, or choose full access.',
            'permissions.*.exists' => 'One of the selected features no longer exists.',
        ];
    }
}
