<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RentalReturn extends Model
{
    protected $fillable = [
        'rental_id',
        'return_date',
        'returned_quantity',
        'damaged_quantity',
        'missing_quantity',
        'condition',
        'late_days',
        'late_fee',
        'damage_fee',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'return_date' => 'date',
            'late_fee' => 'decimal:2',
            'damage_fee' => 'decimal:2',
        ];
    }

    public function rental(): BelongsTo
    {
        return $this->belongsTo(Rental::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(RentalReturnItem::class);
    }
}
