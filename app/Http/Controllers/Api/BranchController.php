<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Services\BranchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class BranchController extends Controller
{
    public function __construct(private readonly BranchService $branches)
    {
    }

    public function index(): JsonResponse
    {
        $branches = Branch::query()
            ->orderBy('name')
            ->get()
            ->map(fn (Branch $branch) => $this->branches->transform($branch))
            ->values();

        return $this->success($branches, 'Branches retrieved successfully.');
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), $this->rules());
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors()->toArray());
        }

        try {
            $branch = $this->branches->create($validator->validated());

            return $this->success($this->branches->transform($branch), 'Branch created successfully.', 201);
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to create branch. Please try again.', 500);
        }
    }

    public function update(Request $request, Branch $branch): JsonResponse
    {
        $validator = Validator::make($request->all(), $this->rules($branch));
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors()->toArray());
        }

        try {
            $updated = $this->branches->update($branch, $validator->validated());

            return $this->success($this->branches->transform($updated), 'Branch updated successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update branch. Please try again.', 500);
        }
    }

    public function destroy(Branch $branch): JsonResponse
    {
        try {
            $this->branches->delete($branch);

            return $this->success(null, 'Branch deleted successfully.');
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to delete branch. Please try again.', 500);
        }
    }

    private function rules(?Branch $branch = null): array
    {
        return [
            'name' => [
                $branch ? 'sometimes' : 'required',
                'string',
                'max:150',
                Rule::unique('branches', 'name')->ignore($branch?->id),
            ],
            'code' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:500'],
            'phone' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', Rule::in(['Active', 'Inactive'])],
        ];
    }
}
