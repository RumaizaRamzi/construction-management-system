<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sale extends Model
{
    protected $fillable = [
        'invoice_number',
        'customer_id',
        'sale_date',
        'subtotal',
        'discount',
        'tax',
        'total_amount',
        'paid_amount',
        'balance',
        'payment_status',
        'payment_method',
        'payment_date',
        'sale_status',
        'notes',
        'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'sale_date' => 'date',
            'payment_date' => 'date',
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'tax' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'balance' => 'decimal:2',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SalePayment::class)->orderBy('payment_date')->orderBy('id');
    }
}
