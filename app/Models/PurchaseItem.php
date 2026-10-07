<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseItem extends Model
{
    protected $fillable = [
        'purchase_id',
        'product_id',
        'is_new_product',
        'quantity',
        'unit_cost',
        'line_total',
        'listing_type',
        'sale_price',
        'rental_price',
    ];

    protected function casts(): array
    {
        return [
            'is_new_product' => 'boolean',
            'quantity' => 'integer',
            'unit_cost' => 'decimal:2',
            'line_total' => 'decimal:2',
            'sale_price' => 'decimal:2',
            'rental_price' => 'decimal:2',
        ];
    }

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
