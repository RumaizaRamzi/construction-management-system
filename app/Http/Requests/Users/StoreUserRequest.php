<?php

namespace App\Http\Requests\Users;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('users.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'role_id' => ['required', 'integer', 'exists:roles,id'],
            'status' => ['nullable', Rule::in(['Active', 'Inactive'])],
            'phone' => ['nullable', 'string', 'max:50'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ];
    }
}
