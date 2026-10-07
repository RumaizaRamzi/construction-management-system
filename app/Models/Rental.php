<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Rental extends Model
{
    protected $fillable = [
        'rental_number',
        'customer_id',
        'start_date',
        'expected_return_date',
        'actual_return_date',
        'subtotal',
        'discount',
        'deposit',
        'late_fee',
        'damage_fee',
        'total_amount',
        'paid_amount',
        'balance',
        'payment_status',
        'payment_method',
        'status',
        'notes',
        'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'expected_return_date' => 'date',
            'actual_return_date' => 'date',
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'deposit' => 'decimal:2',
            'late_fee' => 'decimal:2',
            'damage_fee' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'balance' => 'decimal:2',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(RentalItem::class);
    }

    public function staffAssignments(): HasMany
    {
        return $this->hasMany(StaffAssignment::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(RentalPayment::class);
    }

    public function returns(): HasMany
    {
        return $this->hasMany(RentalReturn::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }
}
