<?php

namespace App\Http\Requests\Products;

use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('products.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'serial_number' => ['required', 'string', 'max:100', 'unique:products,serial_number'],
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
            'listing_type' => ['nullable', 'string', Rule::in(Product::LISTING_TYPES)],
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
