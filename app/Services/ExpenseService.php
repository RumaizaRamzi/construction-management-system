<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\ExpensePayment;
use App\Models\Product;
use App\Models\Supplier;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class ExpenseService
{
    public function paymentStatus(float $paid, float $amount, ?string $dueDate = null): string
    {
        $paid = round($paid, 2);
        $amount = round($amount, 2);

        if ($amount > 0 && $paid >= $amount) {
            return 'Paid';
        }

        $isPastDue = $dueDate && Carbon::parse($dueDate)->startOfDay()->lt(Carbon::today());

        if ($paid > 0 && $paid < $amount) {
            return $isPastDue ? 'Overdue' : 'Partial';
        }

        if ($paid <= 0) {
            return $isPastDue ? 'Overdue' : 'Pending';
        }

        return 'Pending';
    }

    public function nextReference(): string
    {
        $latest = Expense::query()->orderByDesc('id')->value('reference');
        $next = 1;
        if ($latest && preg_match('/EXP-(\d+)/i', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return 'EXP-'.str_pad((string) $next, 3, '0', STR_PAD_LEFT);
    }

    public function syncTotals(Expense $expense): Expense
    {
        $paid = round((float) $expense->payments()->sum('amount'), 2);
        $amount = round((float) $expense->amount, 2);
        $expense->paid_amount = $paid;
        $expense->balance = round(max(0, $amount - $paid), 2);
        $expense->status = $this->paymentStatus(
            $paid,
            $amount,
            optional($expense->due_date)?->toDateString()
        );

        $latest = $expense->payments()->orderByDesc('payment_date')->orderByDesc('id')->first();
        if ($latest?->payment_method) {
            $expense->payment_method = $latest->payment_method;
        }

        $expense->save();

        return $expense;
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function create(array $data): Expense
    {
        return DB::transaction(function () use ($data) {
            $amount = round((float) ($data['amount'] ?? 0), 2);
            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'amount' => ['Amount must be greater than zero.'],
                ]);
            }

            $supplierId = isset($data['supplier_id']) ? (int) $data['supplier_id'] : null;
            if ($supplierId && ! Supplier::query()->whereKey($supplierId)->exists()) {
                throw ValidationException::withMessages([
                    'supplier_id' => ['Supplier not found.'],
                ]);
            }

            $productId = isset($data['product_id']) ? (int) $data['product_id'] : null;
            if ($productId && ! Product::query()->whereKey($productId)->exists()) {
                throw ValidationException::withMessages([
                    'product_id' => ['Product not found.'],
                ]);
            }

            $initialPayment = round((float) ($data['payment_amount'] ?? $data['paid_amount'] ?? $data['initial_payment'] ?? 0), 2);
            if ($initialPayment < 0) {
                throw ValidationException::withMessages([
                    'payment_amount' => ['Payment amount cannot be negative.'],
                ]);
            }
            if ($initialPayment > $amount + 0.009) {
                throw ValidationException::withMessages([
                    'payment_amount' => ['Payment amount cannot exceed the remaining balance.'],
                ]);
            }

            $date = (string) ($data['date'] ?? $data['expense_date'] ?? now()->toDateString());
            $method = $data['payment_method'] ?? null;

            $expense = Expense::query()->create([
                'reference' => $data['reference'] ?? $data['expense_number'] ?? $this->nextReference(),
                'date' => $date,
                'category' => $data['category'] ?? 'Other Expense',
                'supplier_id' => $supplierId ?: null,
                'product_id' => $productId ?: null,
                'branch_id' => $data['branch_id'] ?? null,
                'amount' => $amount,
                'paid_amount' => 0,
                'balance' => $amount,
                'payment_method' => $method,
                'status' => 'Pending',
                'due_date' => $data['due_date'] ?? null,
                'description' => $data['description'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            if ($initialPayment > 0) {
                ExpensePayment::query()->create([
                    'expense_id' => $expense->id,
                    'payment_date' => $data['payment_date'] ?? $date,
                    'amount' => $initialPayment,
                    'payment_method' => $method,
                    'reference' => $data['payment_reference'] ?? $data['reference_number'] ?? null,
                    'notes' => $data['payment_notes'] ?? 'Initial payment',
                ]);
            }

            $this->syncTotals($expense->fresh());

            return $expense->fresh(['supplier', 'product', 'payments']);
        });
    }

    public function update(Expense $expense, array $data): Expense
    {
        return DB::transaction(function () use ($expense, $data) {
            $expense = Expense::query()->lockForUpdate()->findOrFail($expense->id);

            $amount = array_key_exists('amount', $data)
                ? round((float) $data['amount'], 2)
                : (float) $expense->amount;

            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'amount' => ['Amount must be greater than zero.'],
                ]);
            }

            $paid = (float) $expense->payments()->sum('amount');
            if ($amount + 0.009 < $paid) {
                throw ValidationException::withMessages([
                    'amount' => ['Amount cannot be less than payments already recorded ('.$paid.').'],
                ]);
            }

            $supplierId = array_key_exists('supplier_id', $data)
                ? ($data['supplier_id'] ? (int) $data['supplier_id'] : null)
                : $expense->supplier_id;

            $productId = array_key_exists('product_id', $data)
                ? ($data['product_id'] ? (int) $data['product_id'] : null)
                : $expense->product_id;

            $expense->update([
                'date' => $data['date'] ?? $data['expense_date'] ?? $expense->date,
                'category' => $data['category'] ?? $expense->category,
                'supplier_id' => $supplierId,
                'product_id' => $productId,
                'branch_id' => array_key_exists('branch_id', $data) ? $data['branch_id'] : $expense->branch_id,
                'amount' => $amount,
                'payment_method' => $data['payment_method'] ?? $expense->payment_method,
                'due_date' => array_key_exists('due_date', $data) ? $data['due_date'] : $expense->due_date,
                'description' => array_key_exists('description', $data) ? $data['description'] : $expense->description,
                'notes' => array_key_exists('notes', $data) ? $data['notes'] : $expense->notes,
            ]);

            $this->syncTotals($expense->fresh());

            return $expense->fresh(['supplier', 'product', 'payments']);
        });
    }

    public function delete(Expense $expense): void
    {
        DB::transaction(function () use ($expense) {
            $expense->payments()->delete();
            $expense->delete();
        });
    }

    public function addPayment(Expense $expense, array $data): ExpensePayment
    {
        return DB::transaction(function () use ($expense, $data) {
            $expense = Expense::query()->lockForUpdate()->findOrFail($expense->id);
            $amount = round((float) ($data['amount'] ?? 0), 2);
            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'amount' => ['Payment amount must be greater than zero.'],
                ]);
            }

            $balance = round((float) $expense->balance, 2);
            if ($amount > $balance + 0.009) {
                throw ValidationException::withMessages([
                    'amount' => ['Payment amount cannot exceed the remaining balance.'],
                ]);
            }

            $payment = ExpensePayment::query()->create([
                'expense_id' => $expense->id,
                'payment_date' => $data['payment_date'] ?? now()->toDateString(),
                'amount' => $amount,
                'payment_method' => $data['payment_method'] ?? $expense->payment_method,
                'reference' => $data['reference'] ?? $data['reference_number'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            $this->syncTotals($expense);

            return $payment->fresh();
        });
    }

    public function updatePayment(Expense $expense, ExpensePayment $payment, array $data): ExpensePayment
    {
        return DB::transaction(function () use ($expense, $payment, $data) {
            $expense = Expense::query()->lockForUpdate()->findOrFail($expense->id);
            $payment = ExpensePayment::query()->where('expense_id', $expense->id)->lockForUpdate()->findOrFail($payment->id);

            $amount = array_key_exists('amount', $data)
                ? round((float) $data['amount'], 2)
                : (float) $payment->amount;

            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'amount' => ['Payment amount must be greater than zero.'],
                ]);
            }

            $otherPaid = (float) $expense->payments()->where('id', '!=', $payment->id)->sum('amount');
            $total = (float) $expense->amount;
            if ($otherPaid + $amount > $total + 0.009) {
                throw ValidationException::withMessages([
                    'amount' => ['Payment amount cannot exceed the remaining balance.'],
                ]);
            }

            $payment->update([
                'payment_date' => $data['payment_date'] ?? $payment->payment_date,
                'amount' => $amount,
                'payment_method' => $data['payment_method'] ?? $payment->payment_method,
                'reference' => array_key_exists('reference', $data) || array_key_exists('reference_number', $data)
                    ? ($data['reference'] ?? $data['reference_number'])
                    : $payment->reference,
                'notes' => array_key_exists('notes', $data) ? $data['notes'] : $payment->notes,
            ]);

            $this->syncTotals($expense);

            return $payment->fresh();
        });
    }

    public function deletePayment(Expense $expense, ExpensePayment $payment): void
    {
        DB::transaction(function () use ($expense, $payment) {
            $expense = Expense::query()->lockForUpdate()->findOrFail($expense->id);
            $payment = ExpensePayment::query()->where('expense_id', $expense->id)->lockForUpdate()->findOrFail($payment->id);
            $payment->delete();
            $this->syncTotals($expense);
        });
    }

    public function transform(Expense $expense): array
    {
        $expense->loadMissing(['supplier', 'product', 'payments']);
        $supplier = $expense->supplier;
        $product = $expense->product;

        return [
            'id' => $expense->id,
            'reference' => $expense->reference,
            'expense_number' => $expense->reference,
            'date' => optional($expense->date)?->toDateString(),
            'expense_date' => optional($expense->date)?->toDateString(),
            'category' => $expense->category,
            'supplier_id' => $expense->supplier_id,
            'supplier' => $supplier ? [
                'id' => $supplier->id,
                'name' => $supplier->name,
                'supplier_code' => $supplier->supplier_code,
            ] : null,
            'supplier_name' => $supplier?->name,
            'product_id' => $expense->product_id,
            'branch_id' => $expense->branch_id,
            'product' => $product ? [
                'id' => $product->id,
                'serial_number' => $product->serial_number,
                'name' => $product->name,
            ] : null,
            'product_name' => $product?->name,
            'amount' => (float) $expense->amount,
            'paid_amount' => (float) $expense->paid_amount,
            'balance' => (float) $expense->balance,
            'balance_amount' => (float) $expense->balance,
            'payment_method' => $expense->payment_method,
            'status' => $expense->status,
            'payment_status' => $expense->status,
            'due_date' => optional($expense->due_date)?->toDateString(),
            'description' => $expense->description,
            'notes' => $expense->notes,
            'payments' => $expense->payments->map(fn (ExpensePayment $p) => [
                'id' => $p->id,
                'expense_id' => $p->expense_id,
                'payment_date' => optional($p->payment_date)?->toDateString(),
                'amount' => (float) $p->amount,
                'payment_method' => $p->payment_method,
                'reference' => $p->reference,
                'reference_number' => $p->reference,
                'notes' => $p->notes,
            ])->values()->all(),
            'created_at' => optional($expense->created_at)?->toIso8601String(),
            'updated_at' => optional($expense->updated_at)?->toIso8601String(),
        ];
    }
}
