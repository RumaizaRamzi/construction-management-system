<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reminder extends Model
{
    protected $fillable = [
        'reminder_number',
        'title',
        'message',
        'description',
        'reminder_type',
        'due_date',
        'next_reminder',
        'last_sent',
        'status',
        'priority',
        'related_type',
        'related_id',
        'product_id',
        'frequency',
        'is_recurring',
        'link',
        'notes',
        'completed_at',
        'dismissed_at',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'next_reminder' => 'date',
            'last_sent' => 'date',
            'is_recurring' => 'boolean',
            'completed_at' => 'datetime',
            'dismissed_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function scopePending($query)
    {
        return $query->where('status', 'Pending');
    }

    public function scopeRecurring($query)
    {
        return $query->where('is_recurring', true);
    }
}
