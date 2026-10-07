<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    public const ADMIN_SLUG = 'admin';

    protected $fillable = [
        'name',
        'slug',
        'description',
    ];

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'role_permissions')->withTimestamps();
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function hasPermission(string $slug): bool
    {
        return $this->permissions->contains(fn (Permission $p) => $p->slug === $slug);
    }

    /** The Admin role always has full access and cannot be edited or deleted. */
    public function isLocked(): bool
    {
        return strcasecmp((string) $this->slug, self::ADMIN_SLUG) === 0;
    }
}
