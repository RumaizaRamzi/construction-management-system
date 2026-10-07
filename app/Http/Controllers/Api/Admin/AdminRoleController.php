<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use App\Services\ActivityLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Throwable;

class AdminRoleController extends Controller
{
    public function __construct(private readonly ActivityLogService $activity)
    {
    }

    public function index(): JsonResponse
    {
        $roles = Role::query()
            ->with('permissions:id,slug')
            ->withCount('users')
            ->orderBy('name')
            ->get()
            ->map(fn (Role $r) => $this->transform($r))
            ->values();

        return $this->success($roles, 'Roles retrieved successfully.');
    }

    public function permissions(): JsonResponse
    {
        $permissions = Permission::query()
            ->orderBy('group')
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'group', 'description'])
            ->map(fn (Permission $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'slug' => $p->slug,
                'group' => $p->group,
                'description' => $p->description,
            ]);

        return $this->success($permissions, 'Permissions retrieved successfully.');
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), $this->rules(), $this->messages());
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }
        $data = $validator->validated();

        try {
            $role = DB::transaction(function () use ($data) {
                $role = Role::query()->create([
                    'name' => trim($data['name']),
                    'slug' => $this->uniqueSlug($data['name']),
                    'description' => $this->text($data['description'] ?? null),
                ]);
                $this->syncPermissions($role, $data['permissions'] ?? [], false);

                return $role;
            });

            return $this->success($this->transform($role->fresh('permissions')->loadCount('users')), 'Role created successfully.', 201);
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to create role. Please try again.', 500);
        }
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        if ($role->isLocked()) {
            return $this->error('The Admin role is locked and always has full access.', 422, ['role' => ['The Admin role is locked.']]);
        }

        $validator = Validator::make($request->all(), $this->rules($role), $this->messages());
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }
        $data = $validator->validated();

        try {
            DB::transaction(function () use ($role, $data) {
                if (array_key_exists('name', $data)) {
                    $role->name = trim($data['name']);
                }
                if (array_key_exists('description', $data)) {
                    $role->description = $this->text($data['description']);
                }
                $role->save();

                if ($role->wasChanged('name')) {
                    $role->users()->update(['role' => $role->name]);
                }
                if (array_key_exists('permissions', $data)) {
                    $this->syncPermissions($role, $data['permissions'] ?? [], true);
                }
            });

            return $this->success($this->transform($role->fresh('permissions')->loadCount('users')), 'Role updated successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update role. Please try again.', 500);
        }
    }

    public function destroy(Role $role): JsonResponse
    {
        if ($role->isLocked()) {
            return $this->error('The Admin role is locked and cannot be deleted.', 422, ['role' => ['The Admin role is locked.']]);
        }

        $inUse = $role->users()->count();
        if ($inUse > 0) {
            return $this->error(
                "The \"{$role->name}\" role is assigned to {$inUse} user(s) and cannot be deleted. Move them to another role first.",
                422,
                ['role' => ["This role is assigned to {$inUse} user(s)."]]
            );
        }

        try {
            DB::transaction(function () use ($role) {
                $role->permissions()->detach();
                $role->delete();
            });

            return $this->success(null, 'Role deleted successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to delete role. Please try again.', 500);
        }
    }

    private function syncPermissions(Role $role, array $slugs, bool $log): void
    {
        $before = $role->permissions()->pluck('slug')->all();
        $ids = Permission::query()->whereIn('slug', $slugs)->pluck('id')->all();
        $role->permissions()->sync($ids);
        $after = $role->permissions()->pluck('slug')->all();

        $added = array_values(array_diff($after, $before));
        $removed = array_values(array_diff($before, $after));
        if (! $log || ($added === [] && $removed === [])) {
            return;
        }

        $parts = [];
        if ($added) {
            $parts[] = 'added '.implode(', ', $added);
        }
        if ($removed) {
            $parts[] = 'removed '.implode(', ', $removed);
        }
        $this->activity->record(
            'updated',
            'users',
            "Permissions for role {$role->name} changed: ".implode('; ', $parts),
            $role,
            ['permissions' => $before],
            ['permissions' => $after]
        );
    }

    private function transform(Role $role): array
    {
        return [
            'id' => $role->id,
            'name' => $role->name,
            'slug' => $role->slug,
            'description' => $role->description,
            'locked' => $role->isLocked(),
            'users_count' => (int) ($role->users_count ?? $role->users()->count()),
            'permissions' => $role->permissions->pluck('slug')->values()->all(),
        ];
    }

    private function rules(?Role $role = null): array
    {
        return [
            'name' => [
                ...($role ? ['sometimes', 'required'] : ['required']), 'string', 'max:100',
                function (string $attribute, mixed $value, \Closure $fail) use ($role) {
                    $name = mb_strtolower(trim((string) $value));
                    $taken = Role::query()
                        ->where(fn ($q) => $q->whereRaw('LOWER(name) = ?', [$name])->orWhere('slug', Str::slug($name)))
                        ->when($role, fn ($q) => $q->whereKeyNot($role->id))
                        ->exists();
                    if ($taken || Str::slug($name) === Role::ADMIN_SLUG) {
                        $fail('A role with this name already exists.');
                    }
                },
            ],
            'description' => ['nullable', 'string', 'max:500'],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string', 'distinct', 'exists:permissions,slug'],
        ];
    }

    private function messages(): array
    {
        return [
            'name.required' => 'Role name is required.',
            'permissions.*.exists' => 'One of the selected permissions does not exist.',
        ];
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'role';
        $slug = $base;
        $i = 2;
        while (Role::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }

    private function text(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
