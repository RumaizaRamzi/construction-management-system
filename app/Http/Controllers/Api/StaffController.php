<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\StoreStaffRequest;
use App\Http\Requests\Staff\UpdateStaffRequest;
use App\Models\Staff;
use App\Services\StaffService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class StaffController extends Controller
{
    public function __construct(private readonly StaffService $staff)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $query = Staff::query()->with(['role:id,name', 'branch:id,name', 'user:id,name,email'])->orderBy('full_name');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('full_name', 'like', "%{$search}%")
                    ->orWhere('nic', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('staff_code', 'like', "%{$search}%");
            });
        }
        if ($roleId = $request->integer('role_id')) {
            $query->where('role_id', $roleId);
        }
        if ($branchId = $request->integer('branch_id')) {
            $query->where('branch_id', $branchId);
        }
        if (($status = $request->query('status')) && $status !== 'all') {
            $query->where('status', $status);
        }

        $page = $query->paginate($perPage)->through(fn (Staff $s) => $this->staff->transform($s));

        return $this->success($page, 'Staff retrieved successfully.');
    }

    public function summary(): JsonResponse
    {
        return $this->success($this->staff->summary(), 'Staff summary retrieved successfully.');
    }

    public function show(Request $request, Staff $staff): JsonResponse
    {
        return $this->success($this->staff->details($staff, $request->user()), 'Staff member retrieved successfully.');
    }

    public function store(StoreStaffRequest $request): JsonResponse
    {
        return $this->guard(function () use ($request) {
            $member = $this->staff->create($request->validated());

            return $this->success($this->staff->transform($member), 'Staff member added successfully.', 201);
        }, 'Unable to add staff member. Please try again.');
    }

    public function update(UpdateStaffRequest $request, Staff $staff): JsonResponse
    {
        return $this->guard(function () use ($request, $staff) {
            $member = $this->staff->update($staff, $request->validated());
            $message = $request->has('status') && count($request->validated()) === 1
                ? ($member->isActive() ? 'Staff member reactivated.' : 'Staff member deactivated. Their history is kept.')
                : 'Staff member updated successfully.';

            return $this->success($this->staff->transform($member), $message);
        }, 'Unable to update staff member. Please try again.');
    }

    public function destroy(Staff $staff): JsonResponse
    {
        return $this->guard(function () use ($staff) {
            $this->staff->delete($staff);

            return $this->success(null, 'Staff member removed. Their attendance and assignment history is kept.');
        }, 'Unable to remove staff member. Please try again.');
    }

    public function showPhoto(Staff $staff): Response
    {
        $disk = Storage::disk(StaffService::FILE_DISK);
        if (! $staff->photo || ! $disk->exists($staff->photo)) {
            return $this->error('No photo has been uploaded for this staff member.', 404);
        }

        return $disk->response($staff->photo, 'staff-'.$staff->id, [
            'Cache-Control' => 'private, max-age=300',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function uploadPhoto(Request $request, Staff $staff): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'photo' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ], [
            'photo.required' => 'Please choose a photo to upload.',
            'photo.image' => 'The staff photo must be an image (JPG, PNG or WEBP).',
            'photo.mimes' => 'The staff photo must be a JPG, PNG or WEBP image.',
            'photo.max' => 'The staff photo must not be larger than 2 MB.',
        ]);
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        return $this->guard(function () use ($request, $staff) {
            $member = $this->staff->storePhoto($staff, $request->file('photo'));

            return $this->success($this->staff->transform($member), 'Staff photo uploaded successfully.');
        }, 'Unable to store the photo. Please try again.');
    }

    public function destroyPhoto(Staff $staff): JsonResponse
    {
        return $this->guard(function () use ($staff) {
            return $this->success($this->staff->transform($this->staff->removePhoto($staff)), 'Staff photo removed successfully.');
        }, 'Unable to remove the photo. Please try again.');
    }

    private function guard(callable $callback, string $failure): JsonResponse
    {
        try {
            return $callback();
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error($failure, 500);
        }
    }
}
