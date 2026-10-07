<?php

namespace App\Http\Requests\Suppliers;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSupplierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('suppliers.update') ?? false;
    }

    public function rules(): array
    {
        $id = $this->route('supplier')?->id ?? $this->route('id');

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'supplier_code' => ['nullable', 'string', 'max:50', Rule::unique('suppliers', 'supplier_code')->ignore($id)],
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
