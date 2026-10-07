<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Maintenance\StoreMaintenanceRequest;
use App\Http\Requests\Maintenance\UpdateMaintenanceRequest;
use App\Models\MaintenanceRecord;
use App\Services\MaintenanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;

class MaintenanceController extends Controller
{
    public function __construct(private readonly MaintenanceService $maintenance)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->query('per_page', 50)));

        $query = MaintenanceRecord::query()
            ->with(['product:id,serial_number,name,image,category_id,status', 'product.category:id,name', 'supplier:id,name,supplier_code'])
            ->orderByDesc('start_date')
            ->orderByDesc('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('maintenance_number', 'like', "%{$search}%")
                    ->orWhere('maintenance_type', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('technician', 'like', "%{$search}%")
                    ->orWhereHas('product', fn ($p) => $p->where('name', 'like', "%{$search}%")->orWhere('serial_number', 'like', "%{$search}%"));
            });
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($productId = $request->query('product_id') ?: $request->query('productId')) {
            $query->where('product_id', $productId);
        }
        if ($priority = $request->query('priority')) {
            $query->where('priority', $priority);
        }
        if ($type = $request->query('maintenance_type') ?: $request->query('maintenanceType')) {
            $query->where('maintenance_type', $type);
        }

        $page = $query->paginate($perPage)->through(
            fn (MaintenanceRecord $record) => $this->maintenance->transform($record)
        );

        return $this->success($page, 'Maintenance records retrieved successfully.');
    }

    public function show(MaintenanceRecord $maintenance): JsonResponse
    {
        return $this->success(
            $this->maintenance->transform($maintenance),
            'Maintenance record retrieved successfully.'
        );
    }

    public function store(StoreMaintenanceRequest $request): JsonResponse
    {
        try {
            $record = $this->maintenance->create($request->validated());

            return $this->success(
                $this->maintenance->transform($record),
                'Maintenance record created successfully.',
                201
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to create maintenance record. Please try again.', 500);
        }
    }

    public function update(UpdateMaintenanceRequest $request, MaintenanceRecord $maintenance): JsonResponse
    {
        try {
            $updated = $this->maintenance->update($maintenance, $request->validated());

            return $this->success(
                $this->maintenance->transform($updated),
                'Maintenance record updated successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update maintenance record. Please try again.', 500);
        }
    }

    public function complete(Request $request, MaintenanceRecord $maintenance): JsonResponse
    {
        try {
            $updated = $this->maintenance->complete($maintenance, $request->all());

            return $this->success(
                $this->maintenance->transform($updated),
                'Maintenance completed successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to complete maintenance. Please try again.', 500);
        }
    }

    public function cancel(Request $request, MaintenanceRecord $maintenance): JsonResponse
    {
        try {
            $updated = $this->maintenance->cancel($maintenance, $request->all());

            return $this->success(
                $this->maintenance->transform($updated),
                'Maintenance cancelled successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to cancel maintenance. Please try again.', 500);
        }
    }

    public function destroy(MaintenanceRecord $maintenance): JsonResponse
    {
        try {
            $this->maintenance->delete($maintenance);

            return $this->success(null, 'Maintenance record deleted successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to delete maintenance record. Please try again.', 500);
        }
    }
}
