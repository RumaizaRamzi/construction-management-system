<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffAssignment extends Model
{
    protected $fillable = ['staff_id', 'vehicle_id', 'rental_id', 'assigned_from', 'assigned_to', 'notes'];

    protected function casts(): array
    {
        return [
            'assigned_from' => 'date',
            'assigned_to' => 'date',
        ];
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Staff::class)->withTrashed();
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function rental(): BelongsTo
    {
        return $this->belongsTo(Rental::class);
    }
}
