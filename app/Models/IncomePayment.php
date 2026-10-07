<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IncomePayment extends Model
{
    protected $fillable = [
        'income_id',
        'payment_date',
        'amount',
        'payment_method',
        'reference',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'payment_date' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    public function income(): BelongsTo
    {
        return $this->belongsTo(Income::class);
    }
}
