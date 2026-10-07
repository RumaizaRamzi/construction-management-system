<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VehicleMaintenance extends Model
{
    public const STATUS_SCHEDULED = 'Scheduled';

    public const STATUS_IN_PROGRESS = 'In Progress';

    public const STATUS_COMPLETED = 'Completed';

    public const STATUS_CANCELLED = 'Cancelled';

    public const STATUSES = [
        self::STATUS_SCHEDULED,
        self::STATUS_IN_PROGRESS,
        self::STATUS_COMPLETED,
        self::STATUS_CANCELLED,
    ];

    public const TYPES = [
        'Routine Service',
        'Repair',
        'Inspection',
        'Oil Change',
        'Tyre / Track Replacement',
        'Engine Work',
        'Hydraulics',
        'Electrical',
        'Other',
    ];

    protected $table = 'vehicle_maintenance';

    protected $fillable = [
        'maintenance_number',
        'vehicle_id',
        'maintenance_date',
        'maintenance_type',
        'description',
        'parts_cost',
        'labour_cost',
        'total_cost',
        'next_maintenance_date',
        'meter_reading',
        'meter_unit',
        'service_provider',
        'notes',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'maintenance_date' => 'date',
            'next_maintenance_date' => 'date',
            'parts_cost' => 'decimal:2',
            'labour_cost' => 'decimal:2',
            'total_cost' => 'decimal:2',
            'meter_reading' => 'decimal:1',
        ];
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }
}
