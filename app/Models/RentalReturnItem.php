<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RentalReturnItem extends Model
{
    protected $fillable = [
        'rental_return_id',
        'rental_item_id',
        'product_id',
        'returned_quantity',
        'damaged_quantity',
        'missing_quantity',
    ];

    public function rentalReturn(): BelongsTo
    {
        return $this->belongsTo(RentalReturn::class);
    }

    public function rentalItem(): BelongsTo
    {
        return $this->belongsTo(RentalItem::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
