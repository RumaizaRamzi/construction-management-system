<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RentalItem extends Model
{
    protected $fillable = [
        'rental_id',
        'product_id',
        'quantity',
        'rental_rate',
        'rental_days',
        'subtotal',
    ];

    protected function casts(): array
    {
        return [
            'rental_rate' => 'decimal:2',
            'subtotal' => 'decimal:2',
        ];
    }

    public function rental(): BelongsTo
    {
        return $this->belongsTo(Rental::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
