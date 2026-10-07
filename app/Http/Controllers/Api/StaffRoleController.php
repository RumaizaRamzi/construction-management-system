<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Staff;
use App\Models\StaffRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Throwable;

class StaffRoleController extends Controller
{
    public function index(): JsonResponse
    {
        $roles = StaffRole::query()
            ->withCount(['staff as staff_count' => fn ($q) => $q->withTrashed()])
            ->orderBy('name')
            ->get()
            ->map(fn (StaffRole $r) => $this->transform($r))
            ->values();

        return $this->success($roles, 'Staff roles retrieved successfully.');
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), $this->rules(), $this->messages());
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        try {
            $role = StaffRole::query()->create($this->clean($validator->validated()));

            return $this->success($this->transform($role), 'Role added successfully.', 201);
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to add role. Please try again.', 500);
        }
    }

    public function update(Request $request, StaffRole $staffRole): JsonResponse
    {
        $validator = Validator::make($request->all(), $this->rules($staffRole), $this->messages());
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        try {
            $staffRole->fill($this->clean($validator->validated()))->save();

            return $this->success($this->transform($staffRole->fresh()), 'Role updated successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update role. Please try again.', 500);
        }
    }

    public function destroy(StaffRole $staffRole): JsonResponse
    {
        $inUse = Staff::withTrashed()->where('role_id', $staffRole->id)->count();
        if ($inUse > 0) {
            return $this->error(
                "The \"{$staffRole->name}\" role is used by {$inUse} staff member(s) and cannot be deleted. Move them to another role first.",
                422,
                ['role' => ["This role is used by {$inUse} staff member(s)."]]
            );
        }

        try {
            $staffRole->delete();

            return $this->success(null, 'Role deleted successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to delete role. Please try again.', 500);
        }
    }

    private function transform(StaffRole $role): array
    {
        return [
            'id' => $role->id,
            'name' => $role->name,
            'description' => $role->description,
            'staff_count' => (int) ($role->staff_count ?? Staff::withTrashed()->where('role_id', $role->id)->count()),
            'created_at' => $role->created_at?->toIso8601String(),
        ];
    }

    private function rules(?StaffRole $role = null): array
    {
        return [
            'name' => [
                'required', 'string', 'max:100',
                Rule::unique('staff_roles', 'name')->ignore($role?->id),
                function (string $attribute, mixed $value, \Closure $fail) use ($role) {
                    $taken = StaffRole::query()
                        ->whereRaw('LOWER(name) = ?', [mb_strtolower(trim((string) $value))])
                        ->when($role, fn ($q) => $q->whereKeyNot($role->id))
                        ->exists();
                    if ($taken) {
                        $fail('A role with this name already exists.');
                    }
                },
            ],
            'description' => ['nullable', 'string', 'max:500'],
        ];
    }

    private function messages(): array
    {
        return [
            'name.required' => 'Role name is required.',
            'name.unique' => 'A role with this name already exists.',
        ];
    }

    private function clean(array $data): array
    {
        $data['name'] = trim($data['name']);
        $data['description'] = isset($data['description']) && trim((string) $data['description']) !== '' ? trim($data['description']) : null;

        return $data;
    }
}
