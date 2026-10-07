<?php

namespace App\Http\Requests\Sales;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('sales.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'invoice_number' => ['nullable', 'string', 'max:50', 'unique:sales,invoice_number'],
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'sale_date' => ['nullable', 'date'],
            'date' => ['nullable', 'date'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'tax' => ['nullable', 'numeric', 'min:0'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'amount_paid' => ['nullable', 'numeric', 'min:0'],
            'payment_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'string', 'max:100'],
            'payment_date' => ['nullable', 'date'],
            'sale_status' => ['nullable', 'string', Rule::in(['Pending', 'Completed', 'Cancelled', 'Refunded'])],
            'notes' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'customer_id.required' => 'A customer is required.',
            'customer_id.exists' => 'The selected customer is invalid.',
            'items.required' => 'Add at least one product.',
            'items.min' => 'Add at least one product.',
            'items.*.product_id.required' => 'Each item must include a product.',
            'items.*.product_id.exists' => 'One or more products are invalid.',
            'items.*.quantity.min' => 'Quantity must be greater than zero.',
            'invoice_number.unique' => 'This invoice number is already in use.',
        ];
    }
}
