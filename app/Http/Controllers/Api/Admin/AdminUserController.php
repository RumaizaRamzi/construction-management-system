<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreAdminUserRequest;
use App\Http\Requests\Admin\UpdateAdminUserRequest;
use App\Models\Role;
use App\Models\User;
use App\Services\AdminUserService;
use App\Support\QuerySafety;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Throwable;

class AdminUserController extends Controller
{
    public function __construct(private readonly AdminUserService $users)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = QuerySafety::perPage($request->query('per_page'), 25, 100);

        $query = User::query()->with(['roleRelation', 'staff'])->orderBy('name');

        if ($search = trim((string) $request->query('search', ''))) {
            $like = QuerySafety::likeContains($search);
            $query->where(function ($q) use ($like) {
                $q->where('name', 'like', $like)
                    ->orWhere('email', 'like', $like)
                    ->orWhere('phone', 'like', $like)
                    ->orWhereHas('staff', fn ($s) => $s->where('full_name', 'like', $like)->orWhere('staff_code', 'like', $like));
            });
        }
        if (in_array($request->query('status'), AdminUserService::STATUSES, true)) {
            $query->where('status', $request->query('status'));
        }
        if ($roleId = (int) $request->query('role_id')) {
            $query->where('role_id', $roleId);
        }

        $page = $query->paginate($perPage)->through(fn (User $u) => $this->users->transform($u));

        return $this->success([
            'users' => $page,
            'summary' => [
                'total' => User::query()->count(),
                'active' => User::query()->where('status', 'Active')->count(),
                'admins' => $this->users->activeAdminCount(),
                'must_change_password' => User::query()->where('must_change_password', true)->count(),
            ],
        ], 'Users retrieved successfully.');
    }

    /** Roles and staff available for the user form. */
    public function options(Request $request): JsonResponse
    {
        $user = $request->query('user_id') ? User::query()->find((int) $request->query('user_id')) : null;

        return $this->success([
            'roles' => Role::query()->orderBy('name')->get(['id', 'name', 'slug'])->map(fn (Role $r) => [
                'id' => $r->id,
                'name' => $r->name,
                'slug' => $r->slug,
            ])->all(),
            'staff' => $this->users->linkableStaff($user),
        ], 'User form options retrieved.');
    }

    public function store(StoreAdminUserRequest $request): JsonResponse
    {
        return $this->guard(function () use ($request) {
            [$user, $generated] = $this->users->create($request->validated());

            return $this->success([
                'user' => $this->users->transform($user),
                'generated_password' => $generated,
            ], 'User created successfully.', 201);
        }, 'Unable to create user.');
    }

    public function update(UpdateAdminUserRequest $request, User $user): JsonResponse
    {
        return $this->guard(function () use ($request, $user) {
            $updated = $this->users->update($user, $request->validated(), $request->user());

            return $this->success($this->users->transform($updated), 'User updated successfully.');
        }, 'Unable to update user.');
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'password' => ['nullable', 'string', Password::min(8), 'max:100'],
            'must_change_password' => ['nullable', 'boolean'],
        ], ['password.min' => 'The password must be at least 8 characters.']);
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }
        $data = $validator->validated();

        return $this->guard(function () use ($request, $user, $data) {
            $generated = $this->users->resetPassword(
                $user,
                $data['password'] ?? null,
                (bool) ($data['must_change_password'] ?? true),
                $request->user()
            );

            return $this->success([
                'user' => $this->users->transform($user->fresh()),
                'generated_password' => $generated,
            ], 'Password reset successfully.');
        }, 'Unable to reset password.');
    }

    public function updateStatus(Request $request, User $user): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'status' => ['required', Rule::in(AdminUserService::STATUSES)],
        ]);
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        return $this->guard(function () use ($request, $user, $validator) {
            $status = $validator->validated()['status'];
            $updated = $this->users->setStatus($user, $status, $request->user());

            return $this->success(
                $this->users->transform($updated),
                $status === 'Active' ? 'Login enabled.' : 'Login disabled. The user has been signed out.'
            );
        }, 'Unable to update login status.');
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        return $this->guard(function () use ($request, $user) {
            $this->users->delete($user, $request->user());

            return $this->success(null, 'User deleted successfully.');
        }, 'Unable to delete user.');
    }

    private function guard(callable $callback, string $fallback): JsonResponse
    {
        try {
            return $callback();
        } catch (ValidationException $e) {
            $errors = $e->errors();

            return $this->error(collect($errors)->flatten()->first() ?: 'Validation failed.', 422, $errors);
        } catch (Throwable $e) {
            report($e);

            return $this->error($fallback.' Please try again.', 500);
        }
    }
}
