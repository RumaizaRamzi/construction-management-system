<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public const ACCESS_ROLE = 'role';

    public const ACCESS_FULL = 'full';

    public const ACCESS_CUSTOM = 'custom';

    public const ACCESS_MODES = [self::ACCESS_ROLE, self::ACCESS_FULL, self::ACCESS_CUSTOM];

    /**
     * Only user-editable profile/account fields.
     * role_id / role / last_login_at are assigned explicitly in controllers/services.
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'status',
        'phone',
        'profile_image',
        'branch_id',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'must_change_password' => 'boolean',
        ];
    }

    public function staff(): HasOne
    {
        return $this->hasOne(Staff::class);
    }

    public function roleRelation(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function isActive(): bool
    {
        return strcasecmp((string) $this->status, 'Active') === 0;
    }

    public function isAdmin(): bool
    {
        $this->loadMissing('roleRelation');

        return strcasecmp((string) ($this->roleRelation?->slug ?: ''), 'admin') === 0
            || strcasecmp((string) ($this->roleRelation?->name ?: ''), 'Admin') === 0;
    }

    /** Features granted directly to this user (used when access_mode is custom). */
    public function customPermissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'user_permissions')->withTimestamps();
    }

    public function accessMode(): string
    {
        return in_array($this->access_mode, self::ACCESS_MODES, true) ? $this->access_mode : self::ACCESS_ROLE;
    }

    public function permissionSlugs(): array
    {
        return match ($this->accessMode()) {
            self::ACCESS_FULL => Permission::query()->orderBy('slug')->pluck('slug')->all(),
            self::ACCESS_CUSTOM => $this->loadMissing('customPermissions')->customPermissions->pluck('slug')->unique()->values()->all(),
            default => $this->rolePermissionSlugs(),
        };
    }

    public function rolePermissionSlugs(): array
    {
        $this->loadMissing('roleRelation.permissions');

        if (! $this->roleRelation) {
            return [];
        }

        return $this->roleRelation->permissions->pluck('slug')->unique()->values()->all();
    }

    public function hasPermission(string $slug): bool
    {
        // Admin bypass only via role relation — never via free-form users.role string.
        if ($this->isAdmin()) {
            return true;
        }

        return in_array($slug, $this->permissionSlugs(), true);
    }

    public function hasAnyPermission(array $slugs): bool
    {
        foreach ($slugs as $slug) {
            if ($this->hasPermission($slug)) {
                return true;
            }
        }

        return false;
    }
}
