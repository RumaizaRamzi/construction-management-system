<?php

namespace App\Http\Requests\Products;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdjustStockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('products.update') ?? false;
    }

    public function rules(): array
    {
        return [
            'quantity_delta' => ['nullable', 'integer'],
            'quantity' => ['nullable', 'integer'],
            'new_quantity' => ['nullable', 'integer', 'min:0'],
            'reason' => ['nullable', 'string', 'max:500'],
            'movement_type' => ['nullable', 'string', Rule::in([
                'ADJUSTMENT', 'RESTOCK', 'PURCHASE', 'DAMAGE', 'MISSING',
            ])],
        ];
    }
}
