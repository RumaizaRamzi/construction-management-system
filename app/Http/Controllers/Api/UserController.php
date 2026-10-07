<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Users\StoreUserRequest;
use App\Http\Requests\Users\UpdateUserRequest;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Support\QuerySafety;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class UserController extends Controller
{
    public function __construct(private readonly AuthController $auth)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = QuerySafety::perPage($request->query('per_page'), 50, 100);

        $query = User::query()
            ->with('roleRelation')
            ->orderBy('name');

        if ($search = trim((string) $request->query('search', ''))) {
            $like = QuerySafety::likeContains($search);
            $query->where(function ($q) use ($like) {
                $q->where('name', 'like', $like)
                    ->orWhere('email', 'like', $like)
                    ->orWhere('phone', 'like', $like);
            });
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($roleId = $request->query('role_id')) {
            $query->where('role_id', (int) $roleId);
        }

        $page = $query->paginate($perPage)->through(
            fn (User $user) => $this->auth->transformUser($user)
        );

        return $this->success($page, 'Users retrieved successfully.');
    }

    public function show(User $user): JsonResponse
    {
        return $this->success(
            $this->auth->transformUser($user->loadMissing('roleRelation.permissions')),
            'User retrieved successfully.'
        );
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $data = $request->validated();
        $role = Role::query()->findOrFail($data['role_id']);

        $user = new User([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'phone' => $data['phone'] ?? null,
            'branch_id' => $data['branch_id'] ?? null,
            'status' => $data['status'] ?? 'Active',
        ]);
        $user->role_id = $role->id;
        $user->role = $role->name;
        $user->save();

        return $this->success(
            $this->auth->transformUser($user->fresh(['roleRelation.permissions'])),
            'User created successfully.',
            201
        );
    }

    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $data = $request->validated();

        if (array_key_exists('name', $data)) {
            $user->name = $data['name'];
        }
        if (array_key_exists('email', $data)) {
            $user->email = $data['email'];
        }
        if (array_key_exists('phone', $data)) {
            $user->phone = $data['phone'];
        }
        if (array_key_exists('branch_id', $data)) {
            $user->branch_id = $data['branch_id'];
        }
        if (array_key_exists('status', $data)) {
            $user->status = $data['status'];
        }
        if (! empty($data['password'])) {
            $user->password = $data['password'];
        }
        if (array_key_exists('role_id', $data)) {
            $role = Role::query()->findOrFail($data['role_id']);
            $user->role_id = $role->id;
            $user->role = $role->name;
        }

        $user->save();

        return $this->success(
            $this->auth->transformUser($user->fresh(['roleRelation.permissions'])),
            'User updated successfully.'
        );
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ((int) $request->user()->id === (int) $user->id) {
            return $this->error('You cannot delete your own account.', 422);
        }

        try {
            $user->tokens()->delete();
            $user->delete();

            return $this->success(null, 'User deleted successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to delete user.', 500);
        }
    }

    public function roles(): JsonResponse
    {
        $roles = Role::query()
            ->with('permissions')
            ->orderBy('name')
            ->get()
            ->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'slug' => $role->slug,
                'description' => $role->description,
                'permissions' => $role->permissions->pluck('slug')->values()->all(),
            ]);

        return $this->success($roles, 'Roles retrieved successfully.');
    }

    public function permissions(): JsonResponse
    {
        $permissions = Permission::query()
            ->orderBy('group')
            ->orderBy('name')
            ->get()
            ->map(fn (Permission $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'slug' => $p->slug,
                'group' => $p->group,
                'description' => $p->description,
            ]);

        return $this->success($permissions, 'Permissions retrieved successfully.');
    }
}
