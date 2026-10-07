<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\StockMovementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockMovementController extends Controller
{
    public function __construct(private readonly StockMovementService $movements)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->query('per_page', 25)));

        $page = $this->movements->paginate([
            'product_id' => $request->query('product_id'),
            'movement_type' => $request->query('movement_type') ?: $request->query('type'),
            'from' => $request->query('from') ?: $request->query('date_from'),
            'to' => $request->query('to') ?: $request->query('date_to'),
            'search' => $request->query('search'),
        ], $perPage);

        return $this->success($page, 'Stock movements retrieved successfully.');
    }

    public function summary(): JsonResponse
    {
        return $this->success($this->movements->productSummaries(), 'Stock movement summary retrieved successfully.');
    }

    public function productHistory(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'movement_type' => ['nullable', 'string', 'max:50'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        return $this->success(
            $this->movements->productHistory($product, [
                'movement_type' => $validated['movement_type'] ?? null,
                'from' => $validated['from'] ?? null,
                'to' => $validated['to'] ?? null,
            ], (int) ($validated['per_page'] ?? 25)),
            'Product stock history retrieved successfully.'
        );
    }
}
