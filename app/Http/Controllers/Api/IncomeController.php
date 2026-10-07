<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Income;
use App\Models\IncomePayment;
use App\Services\IncomeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Throwable;

class IncomeController extends Controller
{
    public function __construct(private readonly IncomeService $incomeService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->query('per_page', 50)));

        $query = Income::query()
            ->with(['customer:id,name,customer_code,phone,email', 'payments'])
            ->orderByDesc('date')
            ->orderByDesc('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('reference', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('source', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%")
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }

        if ($status = $request->query('status') ?: $request->query('payment_status')) {
            $query->where('status', $status);
        }
        if ($source = $request->query('source')) {
            $query->where('source', $source);
        }
        if ($category = $request->query('category')) {
            $query->where('category', $category);
        }
        if ($customerId = $request->query('customer_id')) {
            $query->where('customer_id', $customerId);
        }

        $page = $query->paginate($perPage)->through(
            fn (Income $income) => $this->incomeService->transform($income)
        );

        return $this->success($page, 'Income records retrieved successfully.');
    }

    public function show(Income $income): JsonResponse
    {
        return $this->success(
            $this->incomeService->transform($income),
            'Income record retrieved successfully.'
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'reference' => ['nullable', 'string', 'max:50', 'unique:income,reference'],
            'income_number' => ['nullable', 'string', 'max:50', 'unique:income,reference'],
            'date' => ['nullable', 'date'],
            'income_date' => ['nullable', 'date'],
            'source' => ['nullable', 'string', 'max:100'],
            'source_type' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:100'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_amount' => ['nullable', 'numeric', 'min:0'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'initial_payment' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'string', 'max:100'],
            'payment_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'related_type' => ['nullable', 'string', 'max:50'],
            'related_id' => ['nullable', 'integer'],
            'sale_id' => ['nullable', 'integer'],
            'rental_id' => ['nullable', 'integer'],
            'booking_id' => ['nullable', 'integer'],
            'description' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'payment_reference' => ['nullable', 'string', 'max:255'],
            'reference_number' => ['nullable', 'string', 'max:255'],
            'payment_notes' => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        try {
            $income = $this->incomeService->create($validator->validated());

            return $this->success(
                $this->incomeService->transform($income),
                'Income created successfully.',
                201
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to create income. Please try again.', 500);
        }
    }

    public function update(Request $request, Income $income): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'date' => ['nullable', 'date'],
            'income_date' => ['nullable', 'date'],
            'source' => ['nullable', 'string', 'max:100'],
            'source_type' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:100'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'amount' => ['sometimes', 'numeric', 'min:0.01'],
            'payment_method' => ['nullable', 'string', 'max:100'],
            'due_date' => ['nullable', 'date'],
            'related_type' => ['nullable', 'string', 'max:50'],
            'related_id' => ['nullable', 'integer'],
            'sale_id' => ['nullable', 'integer'],
            'rental_id' => ['nullable', 'integer'],
            'booking_id' => ['nullable', 'integer'],
            'description' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        try {
            $updated = $this->incomeService->update($income, $validator->validated());

            return $this->success(
                $this->incomeService->transform($updated),
                'Income updated successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update income. Please try again.', 500);
        }
    }

    public function destroy(Income $income): JsonResponse
    {
        try {
            $this->incomeService->delete($income);

            return $this->success(null, 'Income deleted successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to delete income. Please try again.', 500);
        }
    }

    public function paymentsIndex(Income $income): JsonResponse
    {
        $transformed = $this->incomeService->transform($income);

        return $this->success($transformed['payments'] ?? [], 'Income payments retrieved successfully.');
    }

    public function paymentsStore(Request $request, Income $income): JsonResponse
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
            $payment = $this->incomeService->addPayment($income, $validator->validated());
            $fresh = $this->incomeService->transform($income->fresh());

            return $this->success([
                'payment' => collect($fresh['payments'])->firstWhere('id', $payment->id),
                'income' => $fresh,
            ], 'Payment recorded successfully.', 201);
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to record payment. Please try again.', 500);
        }
    }

    public function paymentsUpdate(Request $request, Income $income, IncomePayment $payment): JsonResponse
    {
        if ((int) $payment->income_id !== (int) $income->id) {
            return $this->error('Payment not found for this income record.', 404);
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
            $updated = $this->incomeService->updatePayment($income, $payment, $validator->validated());
            $fresh = $this->incomeService->transform($income->fresh());

            return $this->success([
                'payment' => collect($fresh['payments'])->firstWhere('id', $updated->id),
                'income' => $fresh,
            ], 'Payment updated successfully.');
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update payment. Please try again.', 500);
        }
    }

    public function paymentsDestroy(Income $income, IncomePayment $payment): JsonResponse
    {
        if ((int) $payment->income_id !== (int) $income->id) {
            return $this->error('Payment not found for this income record.', 404);
        }

        try {
            $this->incomeService->deletePayment($income, $payment);
            $fresh = $this->incomeService->transform($income->fresh());

            return $this->success(['income' => $fresh], 'Payment deleted successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to delete payment. Please try again.', 500);
        }
    }
}
