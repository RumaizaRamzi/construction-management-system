<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Purchase extends Model
{
    public const STATUS_COMPLETED = 'Completed';

    public const STATUS_CANCELLED = 'Cancelled';

    public const PAYMENT_TYPES = ['Paid', 'Credit', 'Cheque'];

    protected $fillable = [
        'purchase_number',
        'supplier_id',
        'purchase_date',
        'bill_number',
        'notes',
        'branch_id',
        'total_amount',
        'payment_type',
        'paid_amount',
        'balance',
        'payment_status',
        'status',
        'cancelled_at',
        'cancel_reason',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'purchase_date' => 'date',
            'total_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'balance' => 'decimal:2',
            'cancelled_at' => 'datetime',
        ];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseItem::class);
    }
}
