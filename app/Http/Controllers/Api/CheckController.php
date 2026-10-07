<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Checks\StoreCheckRequest;
use App\Http\Requests\Checks\UpdateCheckRequest;
use App\Models\EquipmentCheck;
use App\Services\CheckService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;

class CheckController extends Controller
{
    public function __construct(private readonly CheckService $checks)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->query('per_page', 50)));

        $query = EquipmentCheck::query()
            ->with(['product:id,serial_number,name,image,category_id', 'product.category:id,name', 'rental:id,rental_number', 'customer:id,name', 'checkedByUser:id,name'])
            ->orderByDesc('scheduled_date')
            ->orderByDesc('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('check_number', 'like', "%{$search}%")
                    ->orWhere('check_type', 'like', "%{$search}%")
                    ->orWhere('assigned_to', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%")
                    ->orWhereHas('product', fn ($p) => $p->where('name', 'like', "%{$search}%")->orWhere('serial_number', 'like', "%{$search}%"));
            });
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($productId = $request->query('product_id') ?: $request->query('productId')) {
            $query->where('product_id', $productId);
        }
        if ($type = $request->query('check_type') ?: $request->query('checkType')) {
            $query->where('check_type', $type);
        }
        if ($from = $request->query('date_from') ?: $request->query('from')) {
            $query->whereDate('scheduled_date', '>=', $from);
        }
        if ($to = $request->query('date_to') ?: $request->query('to')) {
            $query->whereDate('scheduled_date', '<=', $to);
        }

        $page = $query->paginate($perPage)->through(
            fn (EquipmentCheck $check) => $this->checks->transform($check)
        );

        return $this->success($page, 'Checks retrieved successfully.');
    }

    public function show(EquipmentCheck $check): JsonResponse
    {
        return $this->success($this->checks->transform($check), 'Check retrieved successfully.');
    }

    public function store(StoreCheckRequest $request): JsonResponse
    {
        try {
            $check = $this->checks->create($request->validated());

            return $this->success($this->checks->transform($check), 'Check created successfully.', 201);
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to create check. Please try again.', 500);
        }
    }

    public function update(UpdateCheckRequest $request, EquipmentCheck $check): JsonResponse
    {
        try {
            $updated = $this->checks->update($check, $request->validated());

            return $this->success($this->checks->transform($updated), 'Check updated successfully.');
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update check. Please try again.', 500);
        }
    }

    public function complete(Request $request, EquipmentCheck $check): JsonResponse
    {
        try {
            $updated = $this->checks->complete($check, $request->all());

            return $this->success($this->checks->transform($updated), 'Check completed successfully.');
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to complete check. Please try again.', 500);
        }
    }

    public function destroy(EquipmentCheck $check): JsonResponse
    {
        try {
            $this->checks->delete($check);

            return $this->success(null, 'Check deleted successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to delete check. Please try again.', 500);
        }
    }
}
