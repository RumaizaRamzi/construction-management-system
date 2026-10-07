<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\StoreSalePaymentRequest;
use App\Http\Requests\Sales\StoreSaleRequest;
use App\Http\Requests\Sales\UpdateSaleRequest;
use App\Models\Sale;
use App\Services\SaleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;

class SaleController extends Controller
{
    public function __construct(private readonly SaleService $sales)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->query('per_page', 50)));

        $query = Sale::query()
            ->with([
                'customer:id,name,customer_code,phone,email,address',
                'items.product:id,serial_number,name,image,category_id',
                'items.product.category:id,name',
                'payments',
            ])
            ->orderByDesc('sale_date')
            ->orderByDesc('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%")
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('items.product', fn ($p) => $p->where('name', 'like', "%{$search}%"));
            });
        }

        if ($status = $request->query('sale_status') ?: $request->query('status')) {
            $query->where('sale_status', $status);
        }

        if ($paymentStatus = $request->query('payment_status')) {
            $query->where('payment_status', $paymentStatus);
        }

        if ($customerId = $request->query('customer_id')) {
            $query->where('customer_id', $customerId);
        }

        if ($from = $request->query('from') ?: $request->query('sale_date_from') ?: $request->query('date_from')) {
            $query->whereDate('sale_date', '>=', $from);
        }
        if ($to = $request->query('to') ?: $request->query('sale_date_to') ?: $request->query('date_to')) {
            $query->whereDate('sale_date', '<=', $to);
        }

        $page = $query->paginate($perPage)->through(
            fn (Sale $sale) => $this->sales->transform($sale)
        );

        return $this->success($page, 'Sales retrieved successfully.');
    }

    public function show(Sale $sale): JsonResponse
    {
        return $this->success(
            $this->sales->transform($sale),
            'Sale retrieved successfully.'
        );
    }

    public function store(StoreSaleRequest $request): JsonResponse
    {
        try {
            $sale = $this->sales->create($request->validated());

            return $this->success(
                $this->sales->transform($sale),
                'Sale created successfully.',
                201
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to create sale. Please try again.', 500);
        }
    }

    public function update(UpdateSaleRequest $request, Sale $sale): JsonResponse
    {
        try {
            $updated = $this->sales->update($sale, $request->validated());

            return $this->success(
                $this->sales->transform($updated),
                'Sale updated successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update sale. Please try again.', 500);
        }
    }

    public function destroy(Sale $sale): JsonResponse
    {
        try {
            $cancelled = $this->sales->cancel($sale);

            return $this->success(
                $this->sales->transform($cancelled),
                'Sale cancelled successfully. Inventory has been restored.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to cancel sale. Please try again.', 500);
        }
    }

    public function paymentsStore(StoreSalePaymentRequest $request, Sale $sale): JsonResponse
    {
        try {
            $updated = $this->sales->addPayment($sale, $request->validated());

            return $this->success(
                $this->sales->transform($updated),
                'Payment recorded successfully.',
                201
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to record payment. Please try again.', 500);
        }
    }
}
