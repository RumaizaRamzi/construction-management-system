<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vehicle extends Model
{
    public const STATUS_AVAILABLE = 'Available';

    public const STATUS_RENTED = 'Rented';

    public const STATUS_MAINTENANCE = 'Under Maintenance';

    public const STATUS_OUT_OF_SERVICE = 'Out of Service';

    public const STATUSES = [
        self::STATUS_AVAILABLE,
        self::STATUS_RENTED,
        self::STATUS_MAINTENANCE,
        self::STATUS_OUT_OF_SERVICE,
    ];

    public const CATEGORIES = [
        'Excavator',
        'Bulldozer',
        'Crane',
        'Dump Truck',
        'Backhoe Loader',
        'Wheel Loader',
        'Forklift',
        'Other Construction Vehicle',
    ];

    protected $fillable = [
        'vehicle_code',
        'name',
        'category',
        'registration_number',
        'brand',
        'model',
        'manufacture_year',
        'purchase_date',
        'purchase_cost',
        'daily_rate',
        'weekly_rate',
        'monthly_rate',
        'branch_id',
        'description',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'purchase_date' => 'date',
            'purchase_cost' => 'decimal:2',
            'daily_rate' => 'decimal:2',
            'weekly_rate' => 'decimal:2',
            'monthly_rate' => 'decimal:2',
            'manufacture_year' => 'integer',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function rentals(): HasMany
    {
        return $this->hasMany(VehicleRental::class);
    }

    public function maintenance(): HasMany
    {
        return $this->hasMany(VehicleMaintenance::class);
    }

    public function staffAssignments(): HasMany
    {
        return $this->hasMany(StaffAssignment::class);
    }
}
