<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notification extends Model
{
    public const STATUS_UNREAD = 'Unread';

    public const STATUS_READ = 'Read';

    public const STATUS_DISMISSED = 'Dismissed';

    protected $fillable = [
        'user_id',
        'type',
        'category',
        'priority',
        'title',
        'message',
        'related_type',
        'related_id',
        'link',
        'action_url',
        'is_read',
        'status',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'is_read' => 'boolean',
            'read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeActive($query)
    {
        return $query->where('status', '!=', self::STATUS_DISMISSED);
    }

    public function scopeUnread($query)
    {
        return $query->where('status', self::STATUS_UNREAD)->where('is_read', false);
    }

    public function markRead(): self
    {
        $this->forceFill([
            'is_read' => true,
            'status' => self::STATUS_READ,
            'read_at' => $this->read_at ?: now(),
        ])->save();

        return $this;
    }

    public function dismiss(): self
    {
        $this->forceFill([
            'is_read' => true,
            'status' => self::STATUS_DISMISSED,
            'read_at' => $this->read_at ?: now(),
        ])->save();

        return $this;
    }
}
