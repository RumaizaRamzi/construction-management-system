<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Purchase;
use App\Services\PurchaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class PurchaseController extends Controller
{
    public function __construct(private readonly PurchaseService $purchases)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->query('per_page', 50)));
        $query = Purchase::query()
            ->with(['supplier:id,name,supplier_code', 'creator:id,name', 'items.product:id,name,serial_number,listing_type,unit'])
            ->orderByDesc('purchase_date')
            ->orderByDesc('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('purchase_number', 'like', "%{$search}%")
                    ->orWhere('bill_number', 'like', "%{$search}%")
                    ->orWhereHas('supplier', fn ($s) => $s->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('items.product', fn ($p) => $p->where('name', 'like', "%{$search}%")->orWhere('serial_number', 'like', "%{$search}%"));
            });
        }
        if ($supplierId = $request->integer('supplier_id')) {
            $query->where('supplier_id', $supplierId);
        }
        if ($from = $request->query('from')) {
            $query->whereDate('purchase_date', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $query->whereDate('purchase_date', '<=', $to);
        }
        if (($paymentStatus = $request->query('payment_status')) && $paymentStatus !== 'all') {
            $query->where('payment_status', $paymentStatus);
        }
        if (($status = $request->query('status')) && $status !== 'all') {
            $query->where('status', $status);
        }

        $page = $query->paginate($perPage)->through(fn (Purchase $p) => $this->purchases->transform($p, false));

        return $this->success($page, 'Purchases retrieved successfully.');
    }

    public function show(Request $request, Purchase $purchase): JsonResponse
    {
        return $this->success([
            ...$this->purchases->transform($purchase),
            'cancel_blockers' => $this->purchases->cancelBlockers($purchase),
            'activity' => $this->purchases->activity($purchase, $request->user()),
        ], 'Purchase retrieved successfully.');
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), $this->rules(), $this->messages());
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        return $this->guard(function () use ($validator) {
            $purchase = $this->purchases->create($validator->validated());

            return $this->success($this->purchases->transform($purchase), 'Purchase saved and stock updated.', 201);
        }, 'Unable to save purchase. Please try again.');
    }

    public function update(Request $request, Purchase $purchase): JsonResponse
    {
        $validator = Validator::make($request->all(), $this->rules(), $this->messages());
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        return $this->guard(function () use ($purchase, $validator) {
            $updated = $this->purchases->update($purchase, $validator->validated());

            return $this->success($this->purchases->transform($updated), 'Purchase updated and stock adjusted.');
        }, 'Unable to update purchase. Please try again.');
    }

    public function cancel(Request $request, Purchase $purchase): JsonResponse
    {
        $validator = Validator::make($request->all(), ['reason' => ['nullable', 'string', 'max:500']]);
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        return $this->guard(function () use ($purchase, $validator) {
            $cancelled = $this->purchases->cancel($purchase, $validator->validated()['reason'] ?? null);

            return $this->success($this->purchases->transform($cancelled), 'Purchase cancelled and stock reversed.');
        }, 'Unable to cancel purchase. Please try again.');
    }

    private function rules(): array
    {
        return [
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'purchase_date' => ['required', 'date', 'before_or_equal:today'],
            'bill_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'payment_type' => ['required', Rule::in(Purchase::PAYMENT_TYPES)],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.mode' => ['required', Rule::in(['existing', 'new'])],
            'items.*.product_id' => ['nullable', 'required_if:items.*.mode,existing', 'integer', 'exists:products,id'],
            'items.*.name' => ['nullable', 'required_if:items.*.mode,new', 'string', 'max:255'],
            'items.*.serial_number' => ['nullable', 'required_if:items.*.mode,new', 'string', 'max:100', 'distinct:ignore_case', 'unique:products,serial_number'],
            'items.*.category_id' => ['nullable', 'required_if:items.*.mode,new', 'integer', 'exists:categories,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
            'items.*.listing_type' => ['nullable', Rule::in(Product::LISTING_TYPES)],
            'items.*.sale_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.rental_price' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    private function messages(): array
    {
        return [
            'supplier_id.required' => 'Please select a supplier.',
            'purchase_date.required' => 'Purchase date is required.',
            'purchase_date.before_or_equal' => 'Purchase date cannot be in the future.',
            'payment_type.required' => 'Please choose how this purchase was paid.',
            'items.required' => 'Add at least one item.',
            'items.min' => 'Add at least one item.',
            'items.*.product_id.required_if' => 'Select a product.',
            'items.*.name.required_if' => 'Product name is required.',
            'items.*.serial_number.required_if' => 'Serial number is required.',
            'items.*.serial_number.unique' => 'This serial number is already used by another product.',
            'items.*.serial_number.distinct' => 'Each new product needs a different serial number.',
            'items.*.category_id.required_if' => 'Category is required.',
            'items.*.quantity.required' => 'Quantity is required.',
            'items.*.quantity.min' => 'Quantity must be at least 1.',
            'items.*.unit_cost.required' => 'Unit cost is required.',
        ];
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
