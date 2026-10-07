<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    public const STATUS_PRESENT = 'present';

    public const STATUS_ABSENT = 'absent';

    public const STATUS_LATE = 'late';

    public const STATUS_LEAVE = 'leave';

    public const STATUS_HALF_DAY = 'half_day';

    public const STATUSES = [
        self::STATUS_PRESENT,
        self::STATUS_ABSENT,
        self::STATUS_LATE,
        self::STATUS_LEAVE,
        self::STATUS_HALF_DAY,
    ];

    /** Statuses where the staff member was not at work, so check-in/out times are not kept. */
    public const NOT_WORKING = [self::STATUS_ABSENT, self::STATUS_LEAVE];

    protected $fillable = ['staff_id', 'date', 'check_in', 'check_out', 'status', 'notes'];

    protected function casts(): array
    {
        return [
            'date' => 'date',
        ];
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Staff::class)->withTrashed();
    }
}
