<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Income;
use App\Models\IncomePayment;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class IncomeService
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
        $latest = Income::query()->orderByDesc('id')->value('reference');
        $next = 1;
        if ($latest && preg_match('/INC-(\d+)/i', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return 'INC-'.str_pad((string) $next, 3, '0', STR_PAD_LEFT);
    }

    public function syncTotals(Income $income): Income
    {
        $paid = round((float) $income->payments()->sum('amount'), 2);
        $amount = round((float) $income->amount, 2);
        $income->paid_amount = $paid;
        $income->balance = round(max(0, $amount - $paid), 2);
        $income->status = $this->paymentStatus(
            $paid,
            $amount,
            optional($income->due_date)?->toDateString()
        );

        $latest = $income->payments()->orderByDesc('payment_date')->orderByDesc('id')->first();
        if ($latest?->payment_method) {
            $income->payment_method = $latest->payment_method;
        }

        $income->save();

        return $income;
    }

    public function resolveRelated(array $data): array
    {
        $relatedType = $data['related_type'] ?? null;
        $relatedId = isset($data['related_id']) ? (int) $data['related_id'] : null;

        if (! empty($data['sale_id'])) {
            $relatedType = 'Sale';
            $relatedId = (int) $data['sale_id'];
        } elseif (! empty($data['rental_id'])) {
            $relatedType = 'Rental';
            $relatedId = (int) $data['rental_id'];
        } elseif (! empty($data['booking_id'])) {
            $relatedType = 'Booking';
            $relatedId = (int) $data['booking_id'];
        }

        if ($relatedType && ! in_array($relatedType, ['Sale', 'Rental', 'Booking', 'Other'], true)) {
            $relatedType = ucfirst(strtolower((string) $relatedType));
        }

        return [$relatedType, $relatedId];
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function create(array $data): Income
    {
        return DB::transaction(function () use ($data) {
            $amount = round((float) ($data['amount'] ?? 0), 2);
            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'amount' => ['Amount must be greater than zero.'],
                ]);
            }

            $customerId = isset($data['customer_id']) ? (int) $data['customer_id'] : null;
            if ($customerId) {
                if (! Customer::query()->whereKey($customerId)->exists()) {
                    throw ValidationException::withMessages([
                        'customer_id' => ['Customer not found.'],
                    ]);
                }
            }

            [$relatedType, $relatedId] = $this->resolveRelated($data);
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

            $date = (string) ($data['date'] ?? $data['income_date'] ?? now()->toDateString());
            $dueDate = $data['due_date'] ?? null;
            $method = $data['payment_method'] ?? null;

            $income = Income::query()->create([
                'reference' => $data['reference'] ?? $data['income_number'] ?? $this->nextReference(),
                'date' => $date,
                'source' => $data['source'] ?? $data['source_type'] ?? 'Other',
                'category' => $data['category'] ?? 'Other Income',
                'customer_id' => $customerId ?: null,
                'amount' => $amount,
                'paid_amount' => 0,
                'balance' => $amount,
                'payment_method' => $method,
                'status' => 'Pending',
                'due_date' => $dueDate,
                'related_type' => $relatedType,
                'related_id' => $relatedId,
                'description' => $data['description'] ?? null,
                'notes' => $data['notes'] ?? null,
                'branch_id' => $data['branch_id'] ?? null,
            ]);

            if ($initialPayment > 0) {
                IncomePayment::query()->create([
                    'income_id' => $income->id,
                    'payment_date' => $data['payment_date'] ?? $date,
                    'amount' => $initialPayment,
                    'payment_method' => $method,
                    'reference' => $data['payment_reference'] ?? $data['reference_number'] ?? null,
                    'notes' => $data['payment_notes'] ?? 'Initial payment',
                ]);
            }

            $this->syncTotals($income->fresh());

            return $income->fresh(['customer', 'payments']);
        });
    }

    public function update(Income $income, array $data): Income
    {
        return DB::transaction(function () use ($income, $data) {
            $income = Income::query()->lockForUpdate()->findOrFail($income->id);

            $amount = array_key_exists('amount', $data)
                ? round((float) $data['amount'], 2)
                : (float) $income->amount;

            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'amount' => ['Amount must be greater than zero.'],
                ]);
            }

            $paid = (float) $income->payments()->sum('amount');
            if ($amount + 0.009 < $paid) {
                throw ValidationException::withMessages([
                    'amount' => ['Amount cannot be less than payments already recorded ('.$paid.').'],
                ]);
            }

            $customerId = array_key_exists('customer_id', $data)
                ? ($data['customer_id'] ? (int) $data['customer_id'] : null)
                : $income->customer_id;

            [$relatedType, $relatedId] = $this->resolveRelated(array_merge([
                'related_type' => $income->related_type,
                'related_id' => $income->related_id,
            ], $data));

            $income->update([
                'date' => $data['date'] ?? $data['income_date'] ?? $income->date,
                'source' => $data['source'] ?? $data['source_type'] ?? $income->source,
                'category' => $data['category'] ?? $income->category,
                'customer_id' => $customerId,
                'amount' => $amount,
                'payment_method' => $data['payment_method'] ?? $income->payment_method,
                'due_date' => array_key_exists('due_date', $data) ? $data['due_date'] : $income->due_date,
                'related_type' => $relatedType,
                'related_id' => $relatedId,
                'description' => array_key_exists('description', $data) ? $data['description'] : $income->description,
                'notes' => array_key_exists('notes', $data) ? $data['notes'] : $income->notes,
                'branch_id' => array_key_exists('branch_id', $data) ? $data['branch_id'] : $income->branch_id,
            ]);

            $this->syncTotals($income->fresh());

            return $income->fresh(['customer', 'payments']);
        });
    }

    public function delete(Income $income): void
    {
        DB::transaction(function () use ($income) {
            $income->payments()->delete();
            $income->delete();
        });
    }

    public function addPayment(Income $income, array $data): IncomePayment
    {
        return DB::transaction(function () use ($income, $data) {
            $income = Income::query()->lockForUpdate()->findOrFail($income->id);
            $amount = round((float) ($data['amount'] ?? 0), 2);
            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'amount' => ['Payment amount must be greater than zero.'],
                ]);
            }

            $balance = round((float) $income->balance, 2);
            if ($amount > $balance + 0.009) {
                throw ValidationException::withMessages([
                    'amount' => ['Payment amount cannot exceed the remaining balance.'],
                ]);
            }

            $payment = IncomePayment::query()->create([
                'income_id' => $income->id,
                'payment_date' => $data['payment_date'] ?? now()->toDateString(),
                'amount' => $amount,
                'payment_method' => $data['payment_method'] ?? $income->payment_method,
                'reference' => $data['reference'] ?? $data['reference_number'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            $this->syncTotals($income);

            return $payment->fresh();
        });
    }

    public function updatePayment(Income $income, IncomePayment $payment, array $data): IncomePayment
    {
        return DB::transaction(function () use ($income, $payment, $data) {
            $income = Income::query()->lockForUpdate()->findOrFail($income->id);
            $payment = IncomePayment::query()->where('income_id', $income->id)->lockForUpdate()->findOrFail($payment->id);

            $amount = array_key_exists('amount', $data)
                ? round((float) $data['amount'], 2)
                : (float) $payment->amount;

            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'amount' => ['Payment amount must be greater than zero.'],
                ]);
            }

            $otherPaid = (float) $income->payments()->where('id', '!=', $payment->id)->sum('amount');
            $total = (float) $income->amount;
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

            $this->syncTotals($income);

            return $payment->fresh();
        });
    }

    public function deletePayment(Income $income, IncomePayment $payment): void
    {
        DB::transaction(function () use ($income, $payment) {
            $income = Income::query()->lockForUpdate()->findOrFail($income->id);
            $payment = IncomePayment::query()->where('income_id', $income->id)->lockForUpdate()->findOrFail($payment->id);
            $payment->delete();
            $this->syncTotals($income);
        });
    }

    public function transform(Income $income): array
    {
        $income->loadMissing(['customer', 'payments']);
        $customer = $income->customer;

        return [
            'id' => $income->id,
            'reference' => $income->reference,
            'income_number' => $income->reference,
            'date' => optional($income->date)?->toDateString(),
            'income_date' => optional($income->date)?->toDateString(),
            'source' => $income->source,
            'source_type' => $income->source,
            'category' => $income->category,
            'customer_id' => $income->customer_id,
            'customer' => $customer ? [
                'id' => $customer->id,
                'name' => $customer->name,
                'customer_code' => $customer->customer_code,
                'phone' => $customer->phone,
                'email' => $customer->email,
            ] : null,
            'customer_name' => $customer?->name,
            'branch_id' => $income->branch_id,
            'amount' => (float) $income->amount,
            'paid_amount' => (float) $income->paid_amount,
            'balance' => (float) $income->balance,
            'balance_amount' => (float) $income->balance,
            'payment_method' => $income->payment_method,
            'status' => $income->status,
            'payment_status' => $income->status,
            'due_date' => optional($income->due_date)?->toDateString(),
            'related_type' => $income->related_type,
            'related_id' => $income->related_id,
            'sale_id' => $income->related_type === 'Sale' ? $income->related_id : null,
            'rental_id' => $income->related_type === 'Rental' ? $income->related_id : null,
            'booking_id' => $income->related_type === 'Booking' ? $income->related_id : null,
            'description' => $income->description,
            'notes' => $income->notes,
            'payments' => $income->payments->map(fn (IncomePayment $p) => [
                'id' => $p->id,
                'income_id' => $p->income_id,
                'payment_date' => optional($p->payment_date)?->toDateString(),
                'amount' => (float) $p->amount,
                'payment_method' => $p->payment_method,
                'reference' => $p->reference,
                'reference_number' => $p->reference,
                'notes' => $p->notes,
            ])->values()->all(),
            'created_at' => optional($income->created_at)?->toIso8601String(),
            'updated_at' => optional($income->updated_at)?->toIso8601String(),
        ];
    }
}
