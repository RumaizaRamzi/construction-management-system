<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Expense extends Model
{
    protected $fillable = [
        'reference',
        'date',
        'category',
        'supplier_id',
        'product_id',
        'amount',
        'paid_amount',
        'balance',
        'payment_method',
        'status',
        'due_date',
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

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(ExpensePayment::class);
    }
}
