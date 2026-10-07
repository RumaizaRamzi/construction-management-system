<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Income extends Model
{
    protected $table = 'income';

    protected $fillable = [
        'reference',
        'date',
        'source',
        'category',
        'customer_id',
        'amount',
        'paid_amount',
        'balance',
        'payment_method',
        'status',
        'due_date',
        'related_type',
        'related_id',
        'description',
        'notes',
        'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'due_date' => 'date',
            'amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'balance' => 'decimal:2',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(IncomePayment::class);
    }
}
