<?php

namespace App\Services;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Staff;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Admin-only user and login management. Passwords are never logged. */
class AdminUserService
{
    public const STATUSES = ['Active', 'Inactive'];

    public function __construct(private readonly ActivityLogService $activity)
    {
    }

    public function transform(User $user): array
    {
        $user->loadMissing(['roleRelation', 'staff', 'customPermissions']);
        $staff = $user->staff;
        $mode = $user->accessMode();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'branch_id' => $user->branch_id,
            'role' => $user->roleRelation?->name ?: $user->role,
            'role_id' => $user->role_id,
            'role_slug' => $user->roleRelation?->slug,
            'is_admin' => $user->isAdmin(),
            'access_mode' => $mode,
            'permissions' => $mode === User::ACCESS_CUSTOM ? $user->customPermissions->pluck('slug')->values()->all() : [],
            'feature_count' => $user->isAdmin() ? null : count($user->permissionSlugs()),
            'status' => $user->status,
            'must_change_password' => (bool) $user->must_change_password,
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'created_at' => $user->created_at?->toIso8601String(),
            'staff' => $staff ? [
                'id' => $staff->id,
                'staff_code' => $staff->staff_code,
                'full_name' => $staff->full_name,
                'status' => $staff->status,
            ] : null,
        ];
    }

    /** Active staff that do not have a login yet (plus the one already linked to $user). */
    public function linkableStaff(?User $user = null): array
    {
        return Staff::query()
            ->with('role')
            ->where(function ($q) use ($user) {
                $q->whereNull('user_id');
                if ($user) {
                    $q->orWhere('user_id', $user->id);
                }
            })
            ->where('status', Staff::STATUS_ACTIVE)
            ->orderBy('full_name')
            ->get()
            ->map(fn (Staff $s) => [
                'id' => $s->id,
                'staff_code' => $s->staff_code,
                'full_name' => $s->full_name,
                'email' => $s->email,
                'phone' => $s->phone,
                'branch_id' => $s->branch_id,
                'role_name' => $s->role?->name,
            ])
            ->all();
    }

    public function activeAdminCount(): int
    {
        return User::query()
            ->where('status', 'Active')
            ->whereHas('roleRelation', fn ($q) => $q->where('slug', Role::ADMIN_SLUG))
            ->count();
    }

    public function isLastActiveAdmin(User $user): bool
    {
        return $user->isAdmin() && $user->isActive() && $this->activeAdminCount() <= 1;
    }

    public function generatePassword(): string
    {
        return Str::password(12, true, true, false);
    }

    /** @return array{0: User, 1: string|null} the user and the generated password (if any) */
    public function create(array $data): array
    {
        $generated = empty($data['password']) ? $this->generatePassword() : null;

        $user = DB::transaction(function () use ($data, $generated) {
            $staff = $this->resolveStaff($data['staff_id'] ?? null, null);
            $role = Role::query()->findOrFail($data['role_id']);

            $user = new User([
                'name' => trim($data['name'] ?? '') ?: $staff?->full_name,
                'email' => mb_strtolower(trim($data['email'])),
                'password' => $generated ?? $data['password'],
                'phone' => $this->text($data['phone'] ?? null) ?? $staff?->phone,
                'branch_id' => $data['branch_id'] ?? $staff?->branch_id,
                'status' => $data['status'] ?? 'Active',
            ]);
            $user->role_id = $role->id;
            $user->role = $role->name;
            $user->must_change_password = (bool) ($data['must_change_password'] ?? true);
            $user->access_mode = $data['access_mode'] ?? User::ACCESS_ROLE;
            $user->save();

            $this->syncAccess($user, $user->access_mode, $data['permissions'] ?? [], false);

            if ($staff) {
                $this->linkStaff($user, $staff);
            }

            return $user;
        });

        return [$user->fresh(['roleRelation', 'staff', 'customPermissions']), $generated];
    }

    public function update(User $user, array $data, User $actor): User
    {
        return DB::transaction(function () use ($user, $data, $actor) {
            if (array_key_exists('role_id', $data) && (int) $data['role_id'] !== (int) $user->role_id) {
                $role = Role::query()->findOrFail($data['role_id']);
                if (! $role->isLocked()) {
                    if ($actor->is($user)) {
                        throw ValidationException::withMessages(['role_id' => 'You cannot remove the Admin role from your own account.']);
                    }
                    if ($this->isLastActiveAdmin($user)) {
                        throw ValidationException::withMessages(['role_id' => 'This is the last active Admin. Make another user an Admin first.']);
                    }
                }
                $user->role_id = $role->id;
                $user->role = $role->name;
            }

            foreach (['name', 'phone', 'branch_id'] as $field) {
                if (array_key_exists($field, $data)) {
                    $user->{$field} = is_string($data[$field]) ? $this->text($data[$field]) : $data[$field];
                }
            }
            if (array_key_exists('email', $data)) {
                $user->email = mb_strtolower(trim($data['email']));
            }
            $user->save();

            if (array_key_exists('access_mode', $data)) {
                if ($actor->is($user) && $data['access_mode'] !== $user->accessMode()) {
                    throw ValidationException::withMessages(['access_mode' => 'You cannot change the feature access of your own account.']);
                }
                $this->syncAccess($user, $data['access_mode'], $data['permissions'] ?? [], true);
            }

            if (array_key_exists('staff_id', $data)) {
                $current = $user->staff;
                $next = $this->resolveStaff($data['staff_id'], $user);
                if ($current && (! $next || ! $current->is($next))) {
                    $current->user_id = null;
                    $current->save();
                    $this->activity->record('updated', 'users', "Unlinked login {$user->name} from staff {$current->full_name}", $user);
                }
                if ($next && (! $current || ! $current->is($next))) {
                    $this->linkStaff($user, $next);
                }
            }

            return $user->fresh(['roleRelation', 'staff', 'customPermissions']);
        });
    }

    /**
     * Applies the access mode and, for custom access, the selected features. Logs what changed (feature names only).
     *
     * @param  array<int, string>  $slugs
     */
    private function syncAccess(User $user, string $mode, array $slugs, bool $log): void
    {
        $beforeMode = $user->getOriginal('access_mode') ?? $user->accessMode();
        $before = $user->customPermissions()->pluck('slug')->all();

        $ids = $mode === User::ACCESS_CUSTOM
            ? Permission::query()->whereIn('slug', array_unique($slugs))->pluck('id')->all()
            : [];

        $user->access_mode = $mode;
        $user->save();
        $user->customPermissions()->sync($ids);
        $user->unsetRelation('customPermissions');

        $after = $mode === User::ACCESS_CUSTOM ? $user->customPermissions()->pluck('slug')->all() : [];
        $added = array_values(array_diff($after, $before));
        $removed = array_values(array_diff($before, $after));

        $labels = [User::ACCESS_ROLE => 'role default', User::ACCESS_FULL => 'full access', User::ACCESS_CUSTOM => 'selected features'];
        if (! $log && $mode === User::ACCESS_ROLE) {
            return;
        }
        if ($log && $beforeMode === $mode && ! $added && ! $removed) {
            return;
        }

        $parts = ["Feature access for {$user->name}: {$labels[$mode]}"];
        if ($mode === User::ACCESS_CUSTOM) {
            $parts[] = count($after).' feature(s)';
            if ($added) {
                $parts[] = 'added '.implode(', ', $added);
            }
            if ($removed) {
                $parts[] = 'removed '.implode(', ', $removed);
            }
        }

        $this->activity->record(
            'permissions_changed',
            'users',
            implode('; ', $parts),
            $user,
            ['access_mode' => $beforeMode, 'features' => $before],
            ['access_mode' => $mode, 'features' => $after]
        );
    }

    /** @return string|null the generated password, if one was generated */
    public function resetPassword(User $user, ?string $password, bool $forceChange, User $actor): ?string
    {
        $generated = $password ? null : $this->generatePassword();

        $user->password = $generated ?? $password;
        $user->must_change_password = $forceChange;
        $user->save();

        if (! $actor->is($user)) {
            $user->tokens()->delete();
        }

        $this->activity->record(
            'password_reset',
            'users',
            "Password reset for {$user->name}".($forceChange ? ' (must change on next login)' : ''),
            $user
        );

        return $generated;
    }

    public function setStatus(User $user, string $status, User $actor): User
    {
        if ($status === 'Inactive') {
            if ($actor->is($user)) {
                throw ValidationException::withMessages(['status' => 'You cannot disable your own account.']);
            }
            if ($this->isLastActiveAdmin($user)) {
                throw ValidationException::withMessages(['status' => 'This is the last active Admin and cannot be disabled.']);
            }
        }

        $user->status = $status;
        $user->save();

        if ($status === 'Inactive') {
            $user->tokens()->delete();
        }

        return $user->fresh(['roleRelation', 'staff']);
    }

    public function delete(User $user, User $actor): void
    {
        if ($actor->is($user)) {
            throw ValidationException::withMessages(['user' => 'You cannot delete your own account.']);
        }
        if ($user->isAdmin() && $this->activeAdminCount() <= 1 && $user->isActive()) {
            throw ValidationException::withMessages(['user' => 'This is the last active Admin and cannot be deleted.']);
        }

        DB::transaction(function () use ($user) {
            Staff::withTrashed()->where('user_id', $user->id)->update(['user_id' => null]);
            $user->tokens()->delete();
            $user->delete();
        });
    }

    /** Called when a staff member is deactivated: their login is disabled too. */
    public function disableLoginForStaff(Staff $staff): void
    {
        if (! $staff->user_id) {
            return;
        }
        $user = User::query()->find($staff->user_id);
        if (! $user || ! $user->isActive() || $this->isLastActiveAdmin($user)) {
            return;
        }

        $user->status = 'Inactive';
        $user->save();
        $user->tokens()->delete();

        $this->activity->record('status_changed', 'users', "Login for {$user->name} disabled because staff member {$staff->full_name} was deactivated", $user);
    }

    private function resolveStaff(mixed $staffId, ?User $user): ?Staff
    {
        if (! $staffId) {
            return null;
        }
        $staff = Staff::query()->find($staffId);
        if (! $staff) {
            throw ValidationException::withMessages(['staff_id' => 'The selected staff member was not found.']);
        }
        if ($staff->user_id && (! $user || (int) $staff->user_id !== (int) $user->id)) {
            throw ValidationException::withMessages(['staff_id' => 'This staff member already has a login account.']);
        }
        if (! $staff->isActive() && (! $user || (int) $staff->user_id !== (int) $user->id)) {
            throw ValidationException::withMessages(['staff_id' => 'Inactive staff members cannot be given a login.']);
        }

        return $staff;
    }

    private function linkStaff(User $user, Staff $staff): void
    {
        $staff->user_id = $user->id;
        $staff->save();
        $this->activity->record('updated', 'users', "Linked login {$user->name} to staff {$staff->full_name}", $user);
    }

    private function text(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
