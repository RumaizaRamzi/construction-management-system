<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\ExpensePayment;
use App\Services\ExpenseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Throwable;

class ExpenseController extends Controller
{
    public function __construct(private readonly ExpenseService $expenseService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->query('per_page', 50)));

        $query = Expense::query()
            ->with(['supplier:id,name,supplier_code', 'product:id,serial_number,name', 'payments'])
            ->orderByDesc('date')
            ->orderByDesc('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('reference', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%")
                    ->orWhereHas('supplier', fn ($s) => $s->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('product', fn ($p) => $p->where('name', 'like', "%{$search}%"));
            });
        }

        if ($status = $request->query('status') ?: $request->query('payment_status')) {
            $query->where('status', $status);
        }
        if ($category = $request->query('category')) {
            $query->where('category', $category);
        }
        if ($supplierId = $request->query('supplier_id')) {
            $query->where('supplier_id', $supplierId);
        }

        $page = $query->paginate($perPage)->through(
            fn (Expense $expense) => $this->expenseService->transform($expense)
        );

        return $this->success($page, 'Expenses retrieved successfully.');
    }

    public function show(Expense $expense): JsonResponse
    {
        return $this->success(
            $this->expenseService->transform($expense),
            'Expense retrieved successfully.'
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'reference' => ['nullable', 'string', 'max:50', 'unique:expenses,reference'],
            'expense_number' => ['nullable', 'string', 'max:50', 'unique:expenses,reference'],
            'date' => ['nullable', 'date'],
            'expense_date' => ['nullable', 'date'],
            'category' => ['nullable', 'string', 'max:100'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_amount' => ['nullable', 'numeric', 'min:0'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'initial_payment' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'string', 'max:100'],
            'payment_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
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
            $expense = $this->expenseService->create($validator->validated());

            return $this->success(
                $this->expenseService->transform($expense),
                'Expense created successfully.',
                201
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to create expense. Please try again.', 500);
        }
    }

    public function update(Request $request, Expense $expense): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'date' => ['nullable', 'date'],
            'expense_date' => ['nullable', 'date'],
            'category' => ['nullable', 'string', 'max:100'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'amount' => ['sometimes', 'numeric', 'min:0.01'],
            'payment_method' => ['nullable', 'string', 'max:100'],
            'due_date' => ['nullable', 'date'],
            'description' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        try {
            $updated = $this->expenseService->update($expense, $validator->validated());

            return $this->success(
                $this->expenseService->transform($updated),
                'Expense updated successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update expense. Please try again.', 500);
        }
    }

    public function destroy(Expense $expense): JsonResponse
    {
        try {
            $this->expenseService->delete($expense);

            return $this->success(null, 'Expense deleted successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to delete expense. Please try again.', 500);
        }
    }

    public function paymentsIndex(Expense $expense): JsonResponse
    {
        $transformed = $this->expenseService->transform($expense);

        return $this->success($transformed['payments'] ?? [], 'Expense payments retrieved successfully.');
    }

    public function paymentsStore(Request $request, Expense $expense): JsonResponse
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
            $payment = $this->expenseService->addPayment($expense, $validator->validated());
            $fresh = $this->expenseService->transform($expense->fresh());

            return $this->success([
                'payment' => collect($fresh['payments'])->firstWhere('id', $payment->id),
                'expense' => $fresh,
            ], 'Payment recorded successfully.', 201);
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to record payment. Please try again.', 500);
        }
    }

    public function paymentsUpdate(Request $request, Expense $expense, ExpensePayment $payment): JsonResponse
    {
        if ((int) $payment->expense_id !== (int) $expense->id) {
            return $this->error('Payment not found for this expense.', 404);
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
            $updated = $this->expenseService->updatePayment($expense, $payment, $validator->validated());
            $fresh = $this->expenseService->transform($expense->fresh());

            return $this->success([
                'payment' => collect($fresh['payments'])->firstWhere('id', $updated->id),
                'expense' => $fresh,
            ], 'Payment updated successfully.');
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update payment. Please try again.', 500);
        }
    }

    public function paymentsDestroy(Expense $expense, ExpensePayment $payment): JsonResponse
    {
        if ((int) $payment->expense_id !== (int) $expense->id) {
            return $this->error('Payment not found for this expense.', 404);
        }

        try {
            $this->expenseService->deletePayment($expense, $payment);
            $fresh = $this->expenseService->transform($expense->fresh());

            return $this->success(['expense' => $fresh], 'Payment deleted successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to delete payment. Please try again.', 500);
        }
    }
}
