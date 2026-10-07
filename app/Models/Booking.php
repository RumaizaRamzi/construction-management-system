<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Booking extends Model
{
    protected $fillable = [
        'booking_number',
        'customer_id',
        'booking_date',
        'start_date',
        'end_date',
        'subtotal',
        'discount',
        'status',
        'deposit',
        'estimated_amount',
        'paid_amount',
        'payment_status',
        'rental_id',
        'notes',
        'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'booking_date' => 'date',
            'start_date' => 'date',
            'end_date' => 'date',
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'deposit' => 'decimal:2',
            'estimated_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function rental(): BelongsTo
    {
        return $this->belongsTo(Rental::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(BookingItem::class);
    }
}
