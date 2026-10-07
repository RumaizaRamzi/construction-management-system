<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Products\AdjustStockRequest;
use App\Http\Requests\Products\StoreProductRequest;
use App\Http\Requests\Products\TransferProductToSaleRequest;
use App\Http\Requests\Products\UpdateProductRequest;
use App\Models\Product;
use App\Services\ProductService;
use App\Services\StockMovementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;

class ProductController extends Controller
{
    public function __construct(
        private readonly ProductService $products,
        private readonly StockMovementService $stockMovements
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->query('per_page', 50)));

        $query = Product::query()
            ->with(['category:id,name', 'supplier:id,name,supplier_code'])
            ->orderBy('name');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('serial_number', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($categoryId = $request->query('category_id')) {
            $query->where('category_id', $categoryId);
        }
        if ($supplierId = $request->query('supplier_id')) {
            $query->where('supplier_id', $supplierId);
        }
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $page = $query->paginate($perPage)->through(
            fn (Product $product) => $this->products->transform($product)
        );

        return $this->success($page, 'Products retrieved successfully.');
    }

    public function show(Product $product): JsonResponse
    {
        $product->load([
            'category',
            'supplier',
            'equipmentChecks',
            'maintenanceRecords',
            'stockMovements' => fn ($q) => $q->with('user:id,name')->latest()->limit(50),
        ]);

        $payload = $this->products->transform($product);
        $payload['equipment_checks'] = $product->equipmentChecks;
        $payload['maintenance_records'] = $product->maintenanceRecords;
        $payload['stock_movements'] = $product->stockMovements
            ->map(fn ($m) => $this->stockMovements->transform($m))
            ->values()
            ->all();

        return $this->success($payload, 'Product retrieved successfully.');
    }

    public function store(StoreProductRequest $request): JsonResponse
    {
        try {
            $product = $this->products->create($request->validated());

            return $this->success(
                $this->products->transform($product),
                'Product created successfully.',
                201
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to create product. Please try again.', 500);
        }
    }

    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        try {
            $updated = $this->products->update($product, $request->validated());

            return $this->success(
                $this->products->transform($updated),
                'Product updated successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update product. Please try again.', 500);
        }
    }

    public function destroy(Product $product): JsonResponse
    {
        try {
            $result = $this->products->delete($product);

            if ($result['deactivated']) {
                return $this->success(
                    $this->products->transform($result['product']),
                    'Product has related transactions and was deactivated instead of deleted.'
                );
            }

            return $this->success(null, 'Product deleted successfully.');
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to delete product. Please try again.', 500);
        }
    }

    public function transferToSale(TransferProductToSaleRequest $request, Product $product): JsonResponse
    {
        try {
            $updated = $this->products->transferToSale($product, $request->validated());

            return $this->success(
                $this->products->transform($updated),
                'Product transferred to sales inventory.'
            );
        } catch (ValidationException $e) {
            return $this->error('Unable to transfer product.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to transfer product. Please try again.', 500);
        }
    }

    public function adjustStock(AdjustStockRequest $request, Product $product): JsonResponse
    {
        try {
            $updated = $this->stockMovements->adjust($product, $request->validated());

            return $this->success(
                $this->products->transform($updated),
                'Stock adjusted successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to adjust stock. Please try again.', 500);
        }
    }
}
