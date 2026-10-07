<?php

namespace App\Http\Requests\Products;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('products.update') ?? false;
    }

    public function rules(): array
    {
        $productId = $this->route('product')?->id ?? $this->route('id');

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'serial_number' => ['sometimes', 'string', 'max:100', Rule::unique('products', 'serial_number')->ignore($productId)],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'description' => ['nullable', 'string'],
            'image' => ['nullable', 'string', 'max:500'],
            'quantity' => ['nullable', 'integer', 'min:0'],
            'available_quantity' => ['nullable', 'integer', 'min:0'],
            'minimum_stock' => ['nullable', 'integer', 'min:0'],
            'purchase_price' => ['nullable', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            'rental_price' => ['nullable', 'numeric', 'min:0'],
            'unit' => ['nullable', 'string', 'max:50'],
            'condition' => ['nullable', 'string', 'max:100'],
            'location' => ['nullable', 'string', 'max:255'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'status' => ['nullable', 'string', Rule::in(['Available', 'Rented', 'Maintenance', 'Inactive', 'Out of Stock'])],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('purchase_cost') && ! $this->filled('purchase_price')) {
            $this->merge(['purchase_price' => $this->input('purchase_cost')]);
        }
        if ($this->filled('min_stock') && ! $this->filled('minimum_stock')) {
            $this->merge(['minimum_stock' => $this->input('min_stock')]);
        }
    }
}
