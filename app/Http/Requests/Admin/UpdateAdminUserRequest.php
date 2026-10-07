<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAdminUserRequest extends FormRequest
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
        $userId = $this->route('user')?->id;

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($userId)],
            'role_id' => ['sometimes', 'required', 'integer', 'exists:roles,id'],
            'phone' => ['nullable', 'string', 'max:50'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'staff_id' => ['nullable', 'integer'],
            ...StoreAdminUserRequest::accessRules(),
        ];
    }

    public function messages(): array
    {
        return StoreAdminUserRequest::friendlyMessages() + [
            'name.required' => 'Name is required.',
        ];
    }
}
