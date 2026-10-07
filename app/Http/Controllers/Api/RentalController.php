<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Rental;
use App\Models\RentalPayment;
use App\Services\RentalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Throwable;

class RentalController extends Controller
{
    public function __construct(private readonly RentalService $rentals)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->query('per_page', 50)));

        $query = Rental::query()
            ->with(['customer:id,name,customer_code,phone,email,address', 'items.product:id,serial_number,name,image,condition,category_id', 'items.product.category:id,name', 'payments', 'returns'])
            ->orderByDesc('start_date')
            ->orderByDesc('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('rental_number', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%")
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('items.product', fn ($p) => $p->where('name', 'like', "%{$search}%"));
            });
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($paymentStatus = $request->query('payment_status')) {
            $query->where('payment_status', $paymentStatus);
        }

        if ($customerId = $request->query('customer_id')) {
            $query->where('customer_id', $customerId);
        }

        if ($from = $request->query('start_date_from')) {
            $query->whereDate('start_date', '>=', $from);
        }
        if ($to = $request->query('start_date_to')) {
            $query->whereDate('start_date', '<=', $to);
        }

        if ($request->boolean('overdue')) {
            $query->where(function ($q) {
                $q->where('status', 'Overdue')
                    ->orWhere(function ($q2) {
                        $q2->whereIn('status', ['Active', 'Confirmed'])
                            ->whereDate('expected_return_date', '<', now()->toDateString());
                    });
            });
        }

        $page = $query->paginate($perPage)->through(fn (Rental $rental) => $this->rentals->transform($rental));

        return $this->success($page, 'Rentals retrieved successfully.');
    }

    public function show(Rental $rental): JsonResponse
    {
        return $this->success(
            $this->rentals->transform($rental),
            'Rental retrieved successfully.'
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'start_date' => ['required', 'date'],
            'expected_return_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'expected_return' => ['nullable', 'date', 'after_or_equal:start_date'],
            'items' => ['nullable', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1'],
            'items.*.rental_rate' => ['nullable', 'numeric', 'min:0'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'rental_rate' => ['nullable', 'numeric', 'min:0'],
            'rate' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'deposit' => ['nullable', 'numeric', 'min:0'],
            'deposit_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_amount' => ['nullable', 'numeric', 'min:0'],
            'amount_paid' => ['nullable', 'numeric', 'min:0'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'string', 'max:100'],
            'payment_date' => ['nullable', 'date'],
            'reference' => ['nullable', 'string', 'max:255'],
            'reference_number' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'max:50'],
            'rental_status' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'rental_number' => ['nullable', 'string', 'max:50', 'unique:rentals,rental_number'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        $data = $validator->validated();
        if (empty($data['expected_return_date']) && ! empty($data['expected_return'])) {
            $data['expected_return_date'] = $data['expected_return'];
        }

        try {
            $rental = $this->rentals->create($data);

            return $this->success(
                $this->rentals->transform($rental),
                'Rental created successfully.',
                201
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to create rental. Please try again.', 500);
        }
    }

    public function update(Request $request, Rental $rental): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => ['sometimes', 'integer', 'exists:customers,id'],
            'start_date' => ['sometimes', 'date'],
            'expected_return_date' => ['nullable', 'date'],
            'expected_return' => ['nullable', 'date'],
            'items' => ['nullable', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1'],
            'items.*.rental_rate' => ['nullable', 'numeric', 'min:0'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'rental_rate' => ['nullable', 'numeric', 'min:0'],
            'rate' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'deposit' => ['nullable', 'numeric', 'min:0'],
            'deposit_amount' => ['nullable', 'numeric', 'min:0'],
            'late_fee' => ['nullable', 'numeric', 'min:0'],
            'damage_fee' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', 'max:50'],
            'rental_status' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        $data = $validator->validated();
        if (empty($data['expected_return_date']) && ! empty($data['expected_return'])) {
            $data['expected_return_date'] = $data['expected_return'];
        }

        try {
            $updated = $this->rentals->update($rental, $data);

            return $this->success(
                $this->rentals->transform($updated),
                'Rental updated successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update rental. Please try again.', 500);
        }
    }

    public function destroy(Rental $rental): JsonResponse
    {
        try {
            $this->rentals->delete($rental);

            return $this->success(null, 'Rental deleted successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to delete rental. Please try again.', 500);
        }
    }

    public function paymentsIndex(Rental $rental): JsonResponse
    {
        $payments = $rental->payments()->orderByDesc('payment_date')->orderByDesc('id')->get();

        return $this->success(
            $payments->map(fn (RentalPayment $p) => [
                'id' => $p->id,
                'rental_id' => $p->rental_id,
                'payment_date' => optional($p->payment_date)?->toDateString(),
                'amount' => (float) $p->amount,
                'payment_method' => $p->payment_method,
                'reference' => $p->reference,
                'reference_number' => $p->reference,
                'notes' => $p->notes,
            ])->values()->all(),
            'Rental payments retrieved successfully.'
        );
    }

    public function paymentsStore(Request $request, Rental $rental): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'string', 'max:100'],
            'reference' => ['nullable', 'string', 'max:255'],
            'reference_number' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        try {
            $payment = $this->rentals->addPayment($rental, $validator->validated());
            $fresh = $this->rentals->transform($rental->fresh());

            return $this->success([
                'payment' => [
                    'id' => $payment->id,
                    'rental_id' => $payment->rental_id,
                    'payment_date' => optional($payment->payment_date)?->toDateString(),
                    'amount' => (float) $payment->amount,
                    'payment_method' => $payment->payment_method,
                    'reference' => $payment->reference,
                    'reference_number' => $payment->reference,
                    'notes' => $payment->notes,
                ],
                'rental' => $fresh,
            ], 'Payment recorded successfully.', 201);
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to record payment. Please try again.', 500);
        }
    }

    public function paymentsUpdate(Request $request, Rental $rental, RentalPayment $payment): JsonResponse
    {
        if ((int) $payment->rental_id !== (int) $rental->id) {
            return $this->error('Payment not found for this rental.', 404);
        }

        $validator = Validator::make($request->all(), [
            'amount' => ['sometimes', 'numeric', 'min:0.01'],
            'payment_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'string', 'max:100'],
            'reference' => ['nullable', 'string', 'max:255'],
            'reference_number' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        try {
            $updated = $this->rentals->updatePayment($rental, $payment, $validator->validated());
            $fresh = $this->rentals->transform($rental->fresh());

            return $this->success([
                'payment' => [
                    'id' => $updated->id,
                    'rental_id' => $updated->rental_id,
                    'payment_date' => optional($updated->payment_date)?->toDateString(),
                    'amount' => (float) $updated->amount,
                    'payment_method' => $updated->payment_method,
                    'reference' => $updated->reference,
                    'reference_number' => $updated->reference,
                    'notes' => $updated->notes,
                ],
                'rental' => $fresh,
            ], 'Payment updated successfully.');
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update payment. Please try again.', 500);
        }
    }

    public function paymentsDestroy(Rental $rental, RentalPayment $payment): JsonResponse
    {
        if ((int) $payment->rental_id !== (int) $rental->id) {
            return $this->error('Payment not found for this rental.', 404);
        }

        try {
            $this->rentals->deletePayment($rental, $payment);
            $fresh = $this->rentals->transform($rental->fresh());

            return $this->success(['rental' => $fresh], 'Payment deleted successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to delete payment. Please try again.', 500);
        }
    }

    public function returnShow(Rental $rental): JsonResponse
    {
        $transformed = $this->rentals->transform($rental);

        return $this->success([
            'rental' => $transformed,
            'returns' => $transformed['returns'] ?? [],
            'return' => ($transformed['returns'][count($transformed['returns'] ?? []) - 1] ?? null),
        ], 'Rental return retrieved successfully.');
    }

    public function returnStore(Request $request, Rental $rental): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'return_date' => ['nullable', 'date'],
            'actual_return_date' => ['nullable', 'date'],
            'returned_quantity' => ['nullable', 'integer', 'min:0'],
            'returned_qty' => ['nullable', 'integer', 'min:0'],
            'damaged_quantity' => ['nullable', 'integer', 'min:0'],
            'damaged_qty' => ['nullable', 'integer', 'min:0'],
            'missing_quantity' => ['nullable', 'integer', 'min:0'],
            'missing_qty' => ['nullable', 'integer', 'min:0'],
            'condition' => ['nullable', 'string', 'max:100'],
            'late_fee' => ['nullable', 'numeric', 'min:0'],
            'damage_fee' => ['nullable', 'numeric', 'min:0'],
            'damage_description' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'send_to_maintenance' => ['nullable', 'boolean'],
            'items' => ['nullable', 'array'],
            'items.*.rental_item_id' => ['required_without:items.*.product_id', 'nullable', 'integer'],
            'items.*.product_id' => ['required_without:items.*.rental_item_id', 'nullable', 'integer'],
            'items.*.returned_quantity' => ['nullable', 'integer', 'min:0'],
            'items.*.damaged_quantity' => ['nullable', 'integer', 'min:0'],
            'items.*.missing_quantity' => ['nullable', 'integer', 'min:0'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        try {
            $updated = $this->rentals->processReturn($rental, $validator->validated());

            return $this->success(
                $this->rentals->transform($updated),
                'Rental return processed successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to process return. Please try again.', 500);
        }
    }
}
