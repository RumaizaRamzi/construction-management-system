<?php

namespace App\Http\Requests\Sales;

use Illuminate\Foundation\Http\FormRequest;

class StoreSalePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return ($user?->hasPermission('payments.manage') || $user?->hasPermission('sales.update')) ?? false;
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'string', 'max:100'],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
