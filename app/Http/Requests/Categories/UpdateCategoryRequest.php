<?php

namespace App\Http\Requests\Categories;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('categories.manage') ?? false;
    }

    public function rules(): array
    {
        $id = $this->route('category')?->id ?? $this->route('id');

        return [
            'name' => ['sometimes', 'string', 'max:255', Rule::unique('categories', 'name')->ignore($id)],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', 'string', Rule::in(['Active', 'Inactive'])],
        ];
    }
}
