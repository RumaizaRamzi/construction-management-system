<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class StockMovement extends Model
{
    public const TYPE_PURCHASE = 'PURCHASE';

    public const TYPE_SALE = 'SALE';

    public const TYPE_SALE_CANCEL = 'SALE_CANCEL';

    public const TYPE_SALE_ADJUST = 'SALE_ADJUST';

    public const TYPE_RENTAL_OUT = 'RENTAL_OUT';

    public const TYPE_RENTAL_RETURN = 'RENTAL_RETURN';

    public const TYPE_ADJUSTMENT = 'ADJUSTMENT';

    public const TYPE_RESTOCK = 'RESTOCK';

    protected $fillable = [
        'product_id',
        'movement_type',
        'quantity',
        'previous_quantity',
        'new_quantity',
        'reference_type',
        'reference_id',
        'reason',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'previous_quantity' => 'integer',
            'new_quantity' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reference(): MorphTo
    {
        return $this->morphTo(__FUNCTION__, 'reference_type', 'reference_id');
    }
}
