<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Staff extends Model
{
    use SoftDeletes;

    public const STATUS_ACTIVE = 'Active';

    public const STATUS_INACTIVE = 'Inactive';

    public const STATUSES = [self::STATUS_ACTIVE, self::STATUS_INACTIVE];

    protected $table = 'staff';

    protected $fillable = [
        'staff_code',
        'full_name',
        'nic',
        'phone',
        'email',
        'address',
        'photo',
        'role_id',
        'branch_id',
        'joined_date',
        'status',
        'user_id',
        'notes',
    ];

    /** Storage path stays server-side; the photo is only served through the authenticated endpoint. */
    protected $hidden = ['photo'];

    protected function casts(): array
    {
        return [
            'joined_date' => 'date',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(StaffRole::class, 'role_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(StaffAssignment::class);
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }
}
