<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use App\Services\ActivityLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = User::query()->where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return $this->error('Invalid email or password.', 401);
        }

        if (! $user->isActive()) {
            return $this->error('Your account is inactive. Contact an administrator.', 403);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        $token = $user->createToken($data['device_name'] ?? 'buildtrack-web')->plainTextToken;

        app(ActivityLogService::class)->record('login', 'auth', $user->name.' signed in', null, null, null, $user);

        return $this->success([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $this->transformUser($user->fresh(['roleRelation.permissions'])),
        ], 'Login successful.');
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user) {
            app(ActivityLogService::class)->record('logout', 'auth', $user->name.' signed out', null, null, null, $user);
        }
        $user?->currentAccessToken()?->delete();

        return $this->success(null, 'Logged out successfully.');
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('roleRelation.permissions');

        return $this->success($this->transformUser($user), 'Authenticated user retrieved.');
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', 'unique:users,email,'.$user->id],
            'phone' => ['nullable', 'string', 'max:50'],
            'password' => ['nullable', 'confirmed', Password::min(8)],
            'current_password' => ['required_with:password', 'string'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        $data = $validator->validated();

        if (! empty($data['password'])) {
            if (! Hash::check($data['current_password'], $user->password)) {
                return $this->error('Current password is incorrect.', 422, [
                    'current_password' => ['Current password is incorrect.'],
                ]);
            }
            if (Hash::check($data['password'], $user->password)) {
                return $this->error('Choose a new password that is different from the current one.', 422, [
                    'password' => ['Choose a new password that is different from the current one.'],
                ]);
            }
            $user->password = $data['password'];
            $user->must_change_password = false;
        }

        if (array_key_exists('name', $data)) {
            $user->name = $data['name'];
        }
        if (array_key_exists('email', $data)) {
            $user->email = $data['email'];
        }
        if (array_key_exists('phone', $data)) {
            $user->phone = $data['phone'];
        }

        $user->save();

        return $this->success(
            $this->transformUser($user->fresh(['roleRelation.permissions'])),
            'Profile updated successfully.'
        );
    }

    public function transformUser(User $user): array
    {
        $role = $user->roleRelation;

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'branch_id' => $user->branch_id,
            'role' => $role?->name ?: $user->role,
            'role_id' => $user->role_id,
            'role_slug' => $role?->slug,
            'status' => $user->status,
            'must_change_password' => (bool) $user->must_change_password,
            'permissions' => $user->permissionSlugs(),
            'profile_image' => $user->profile_image,
            'last_login_at' => optional($user->last_login_at)?->toIso8601String(),
            'created_at' => optional($user->created_at)?->toIso8601String(),
        ];
    }
}
