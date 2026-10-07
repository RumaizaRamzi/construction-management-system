<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EquipmentCheck extends Model
{
    protected $fillable = [
        'check_number',
        'product_id',
        'rental_id',
        'customer_id',
        'check_type',
        'description',
        'scheduled_date',
        'completed_date',
        'next_check_date',
        'frequency',
        'status',
        'priority',
        'result',
        'condition',
        'checklist_data',
        'assigned_to',
        'checked_by',
        'reminder_before',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_date' => 'date',
            'completed_date' => 'date',
            'next_check_date' => 'date',
            'checklist_data' => 'array',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function rental(): BelongsTo
    {
        return $this->belongsTo(Rental::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function checkedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_by');
    }
}
