<?php

namespace App\Http\Requests\Products;

use Illuminate\Foundation\Http\FormRequest;

class TransferProductToSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('products.update') ?? false;
    }

    public function rules(): array
    {
        return [
            'sale_price' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
        ];
    }
}
