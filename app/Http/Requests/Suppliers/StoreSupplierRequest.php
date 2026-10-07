<?php

namespace App\Http\Requests\Suppliers;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSupplierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('suppliers.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'supplier_code' => ['nullable', 'string', 'max:50', 'unique:suppliers,supplier_code'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string'],
            'company_name' => ['nullable', 'string', 'max:255'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'contact' => ['nullable', 'string', 'max:255'],
            'products_supplied' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', 'string', Rule::in(['Active', 'Inactive'])],
            'outstanding' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
