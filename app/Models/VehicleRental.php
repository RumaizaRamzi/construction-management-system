<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VehicleRental extends Model
{
    public const STATUS_ACTIVE = 'Active';

    public const STATUS_COMPLETED = 'Completed';

    public const STATUS_CANCELLED = 'Cancelled';

    public const STATUSES = [self::STATUS_ACTIVE, self::STATUS_COMPLETED, self::STATUS_CANCELLED];

    public const RATE_TYPES = ['Daily', 'Weekly', 'Monthly'];

    protected $fillable = [
        'rental_number',
        'vehicle_id',
        'customer_id',
        'start_date',
        'expected_return_date',
        'actual_return_date',
        'rate_type',
        'rental_rate',
        'rental_days',
        'billed_units',
        'total_amount',
        'security_deposit',
        'paid_amount',
        'balance',
        'payment_status',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'expected_return_date' => 'date',
            'actual_return_date' => 'date',
            'rental_rate' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'security_deposit' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'balance' => 'decimal:2',
            'rental_days' => 'integer',
            'billed_units' => 'integer',
        ];
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
