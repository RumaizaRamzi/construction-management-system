<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Suppliers\StoreSupplierRequest;
use App\Http\Requests\Suppliers\UpdateSupplierRequest;
use App\Models\Supplier;
use App\Services\PurchaseService;
use App\Services\SupplierService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;

class SupplierController extends Controller
{
    public function __construct(private readonly SupplierService $suppliers)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->query('per_page', 50)));

        $query = Supplier::query()
            ->withCount('products')
            ->orderBy('name');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('supplier_code', 'like', "%{$search}%")
                    ->orWhere('contact_person', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $page = $query->paginate($perPage)->through(
            fn (Supplier $s) => $this->suppliers->transform($s)
        );

        return $this->success($page, 'Suppliers retrieved successfully.');
    }

    public function show(Supplier $supplier): JsonResponse
    {
        $supplier->load(['expenses', 'products:id,supplier_id,serial_number,name,status']);
        $supplier->loadCount('products');

        $payload = $this->suppliers->transform($supplier);
        $payload['expenses'] = $supplier->expenses;
        $payload['products'] = $supplier->products;
        if (request()->user()?->hasPermission('purchases.view')) {
            $payload = [...$payload, ...app(PurchaseService::class)->supplierSummary($supplier)];
        }

        return $this->success($payload, 'Supplier retrieved successfully.');
    }

    public function store(StoreSupplierRequest $request): JsonResponse
    {
        try {
            $supplier = $this->suppliers->create($request->validated());
            $supplier->loadCount('products');

            return $this->success(
                $this->suppliers->transform($supplier),
                'Supplier created successfully.',
                201
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to create supplier. Please try again.', 500);
        }
    }

    public function update(UpdateSupplierRequest $request, Supplier $supplier): JsonResponse
    {
        try {
            $updated = $this->suppliers->update($supplier, $request->validated());
            $updated->loadCount('products');

            return $this->success(
                $this->suppliers->transform($updated),
                'Supplier updated successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update supplier. Please try again.', 500);
        }
    }

    public function destroy(Supplier $supplier): JsonResponse
    {
        try {
            $result = $this->suppliers->delete($supplier);

            if ($result['deactivated']) {
                return $this->success(
                    $this->suppliers->transform($result['supplier']),
                    $result['message']
                );
            }

            return $this->success(null, $result['message']);
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to delete supplier. Please try again.', 500);
        }
    }
}
