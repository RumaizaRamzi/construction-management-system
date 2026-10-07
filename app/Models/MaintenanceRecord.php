<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaintenanceRecord extends Model
{
    protected $fillable = [
        'maintenance_number',
        'product_id',
        'supplier_id',
        'maintenance_type',
        'description',
        'scheduled_date',
        'start_date',
        'started_date',
        'expected_completion',
        'completed_date',
        'cost',
        'estimated_cost',
        'status',
        'priority',
        'technician',
        'next_maintenance_date',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_date' => 'date',
            'start_date' => 'date',
            'started_date' => 'date',
            'expected_completion' => 'date',
            'completed_date' => 'date',
            'next_maintenance_date' => 'date',
            'cost' => 'decimal:2',
            'estimated_cost' => 'decimal:2',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }
}
