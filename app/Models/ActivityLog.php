<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    protected $fillable = [
        'user_id',
        'user_name',
        'action',
        'module',
        'subject_type',
        'subject_id',
        'subject_label',
        'description',
        'ip_address',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
