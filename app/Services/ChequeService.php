<?php

namespace App\Services;

use App\Models\Cheque;
use App\Models\Expense;
use App\Models\Income;
use App\Models\Purchase;
use App\Models\Rental;
use App\Models\Sale;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ChequeService
{
    public function __construct(private readonly NotificationService $notifications)
    {
    }

    public function transform(Cheque $cheque): array
    {
        $today = Carbon::today();
        $date = $cheque->cheque_date;

        return [
            'id' => $cheque->id,
            'cheque_number' => $cheque->cheque_number,
            'bank' => $cheque->bank,
            'amount' => (float) $cheque->amount,
            'cheque_date' => $date?->toDateString(),
            'type' => $cheque->type,
            'customer_id' => $cheque->customer_id,
            'customer_name' => $cheque->customer?->name,
            'supplier_id' => $cheque->supplier_id,
            'supplier_name' => $cheque->supplier?->name,
            'party_name' => $cheque->customer?->name ?? $cheque->supplier?->name,
            'status' => $cheque->status,
            'status_changed_at' => $cheque->status_changed_at?->toIso8601String(),
            'notes' => $cheque->notes,
            'reference_type' => $cheque->reference_type,
            'reference_id' => $cheque->reference_id,
            'reference_label' => $this->referenceLabel($cheque->reference_type, $cheque->reference_id),
            'reference_url' => $this->referenceUrl($cheque->reference_type, $cheque->reference_id),
            'payment_type' => $cheque->payment_type,
            'payment_id' => $cheque->payment_id,
            'is_overdue' => $cheque->status === Cheque::STATUS_PENDING && $date && $date->lt($today),
            'days_until' => $date ? (int) $today->diffInDays($date, false) : null,
            'created_by_name' => $cheque->creator?->name,
            'created_at' => $cheque->created_at?->toIso8601String(),
            'updated_at' => $cheque->updated_at?->toIso8601String(),
        ];
    }

    /** Shared filters for the list and the report. */
    public function filtered(Request $request): Builder
    {
        $query = Cheque::query()->with(['customer:id,name', 'supplier:id,name', 'creator:id,name']);

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('cheque_number', 'like', "%{$search}%")
                    ->orWhere('bank', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%")
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('supplier', fn ($s) => $s->where('name', 'like', "%{$search}%"));
            });
        }
        if (($status = $request->query('status')) && $status !== 'all') {
            if ($status === 'Overdue') {
                $query->where('status', Cheque::STATUS_PENDING)->whereDate('cheque_date', '<', Carbon::today());
            } else {
                $query->where('status', $status);
            }
        }
        if (($type = $request->query('type')) && in_array($type, Cheque::TYPES, true)) {
            $query->where('type', $type);
        }
        if ($customerId = $request->integer('customer_id')) {
            $query->where('customer_id', $customerId);
        }
        if ($supplierId = $request->integer('supplier_id')) {
            $query->where('supplier_id', $supplierId);
        }
        if ($from = $request->query('from')) {
            $query->whereDate('cheque_date', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $query->whereDate('cheque_date', '<=', $to);
        }

        return $query;
    }

    public function summary(): array
    {
        $today = Carbon::today();
        $sum = fn (Builder $q) => ['count' => (clone $q)->count(), 'amount' => (float) (clone $q)->sum('amount')];

        return [
            'pending' => $sum(Cheque::query()->where('status', Cheque::STATUS_PENDING)),
            'deposited' => $sum(Cheque::query()->where('status', Cheque::STATUS_DEPOSITED)),
            'cleared' => $sum(Cheque::query()->where('status', Cheque::STATUS_CLEARED)),
            'bounced' => $sum(Cheque::query()->where('status', Cheque::STATUS_BOUNCED)),
            'overdue' => $sum(Cheque::query()->where('status', Cheque::STATUS_PENDING)->whereDate('cheque_date', '<', $today)),
            'due_this_week' => $sum(Cheque::query()->where('status', Cheque::STATUS_PENDING)
                ->whereBetween('cheque_date', [$today->toDateString(), $today->copy()->addDays(7)->toDateString()])),
        ];
    }

    public function create(array $data): Cheque
    {
        return DB::transaction(function () use ($data) {
            $fields = $this->fields($data);
            $this->applyReference($fields);
            $this->assertUnique($fields);

            $cheque = Cheque::query()->create([
                ...$fields,
                'status' => $data['status'] ?? Cheque::STATUS_PENDING,
                'status_changed_at' => now(),
                'created_by' => Auth::id(),
            ]);

            return $cheque->fresh(['customer', 'supplier', 'creator']);
        });
    }

    public function update(Cheque $cheque, array $data): Cheque
    {
        return DB::transaction(function () use ($cheque, $data) {
            $cheque = Cheque::query()->lockForUpdate()->findOrFail($cheque->id);
            $fields = array_merge(
                $cheque->only(['cheque_number', 'bank', 'amount', 'cheque_date', 'type', 'customer_id', 'supplier_id', 'notes', 'reference_type', 'reference_id']),
                $this->fields($data)
            );
            $fields['cheque_date'] = Carbon::parse($fields['cheque_date'])->toDateString();
            $this->applyReference($fields);
            $this->assertUnique($fields, $cheque->id);

            if ($cheque->payment_id && $cheque->status !== Cheque::STATUS_PENDING
                && round((float) $fields['amount'], 2) !== round((float) $cheque->amount, 2)) {
                throw ValidationException::withMessages([
                    'amount' => ['The amount of a deposited, cleared or bounced cheque linked to a payment cannot be changed.'],
                ]);
            }

            $cheque->fill($fields);
            if (! empty($data['status']) && $data['status'] !== $cheque->status) {
                $this->applyStatus($cheque, $data['status']);
            }
            $cheque->save();

            return $cheque->fresh(['customer', 'supplier', 'creator']);
        });
    }

    public function updateStatus(Cheque $cheque, string $status, ?string $note = null): Cheque
    {
        return DB::transaction(function () use ($cheque, $status, $note) {
            $cheque = Cheque::query()->lockForUpdate()->findOrFail($cheque->id);
            if ($status === $cheque->status) {
                throw ValidationException::withMessages(['status' => ["This cheque is already {$status}."]]);
            }
            $this->applyStatus($cheque, $status);
            if ($note) {
                $line = now()->format('Y-m-d').' '.$status.': '.$note;
                $cheque->notes = trim(($cheque->notes ? $cheque->notes."\n" : '').$line);
            }
            $cheque->save();

            return $cheque->fresh(['customer', 'supplier', 'creator']);
        });
    }

    public function delete(Cheque $cheque): void
    {
        if ($cheque->payment_id && $cheque->status !== Cheque::STATUS_PENDING) {
            throw ValidationException::withMessages([
                'cheque' => ['This cheque is linked to a payment and is no longer pending, so it cannot be deleted.'],
            ]);
        }
        $cheque->delete();
    }

    /**
     * Called by the payment observer: link (or create) the cheque for a payment recorded with the "Cheque" method.
     */
    public function syncFromPayment(Model $payment, string $paymentType): void
    {
        [, $parentType, $parentKey, $chequeType] = Cheque::PAYMENT_TYPES[$paymentType];
        $linked = Cheque::query()->where('payment_type', $paymentType)->where('payment_id', $payment->id)->first();

        if (strcasecmp(trim((string) $payment->payment_method), 'Cheque') !== 0) {
            if ($linked) {
                $linked->forceFill(['payment_type' => null, 'payment_id' => null])->save();
            }

            return;
        }

        $number = trim((string) $payment->reference) ?: null;
        $parentId = (int) $payment->{$parentKey};

        if ($linked) {
            if ($linked->status === Cheque::STATUS_PENDING) {
                $linked->fill([
                    'amount' => $payment->amount,
                    'cheque_number' => $number ?? $linked->cheque_number,
                ])->save();
            }

            return;
        }

        $existing = $number ? Cheque::query()
            ->whereNull('payment_id')
            ->where('type', $chequeType)
            ->where('cheque_number', $number)
            ->where(fn ($q) => $q->whereNull('reference_type')
                ->orWhere(fn ($r) => $r->where('reference_type', $parentType)->where('reference_id', $parentId)))
            ->orderBy('id')
            ->first() : null;

        $fields = [
            'type' => $chequeType,
            'reference_type' => $parentType,
            'reference_id' => $parentId,
            'customer_id' => null,
            'supplier_id' => null,
        ];
        $this->applyReference($fields);

        if ($existing) {
            $existing->forceFill([
                'payment_type' => $paymentType,
                'payment_id' => $payment->id,
                'reference_type' => $existing->reference_type ?? $parentType,
                'reference_id' => $existing->reference_id ?? $parentId,
                'customer_id' => $existing->customer_id ?? $fields['customer_id'],
                'supplier_id' => $existing->supplier_id ?? $fields['supplier_id'],
            ])->save();

            return;
        }

        $date = $payment->payment_date ?? null;

        Cheque::query()->create([
            ...$fields,
            'cheque_number' => $number,
            'amount' => $payment->amount,
            'cheque_date' => $date ? Carbon::parse($date)->toDateString() : Carbon::today()->toDateString(),
            'status' => Cheque::STATUS_PENDING,
            'status_changed_at' => now(),
            'notes' => $number ? null : 'Created from a cheque payment without a cheque number. Please add the cheque number and bank.',
            'payment_type' => $paymentType,
            'payment_id' => $payment->id,
            'created_by' => Auth::id(),
        ]);
    }

    public function unlinkPayment(Model $payment, string $paymentType): void
    {
        Cheque::query()->where('payment_type', $paymentType)->where('payment_id', $payment->id)
            ->update(['payment_type' => null, 'payment_id' => null]);
    }

    /** Records a cheque can be linked to, for the form's search box. */
    public function linkOptions(string $type, string $search = ''): array
    {
        $like = "%{$search}%";
        $map = fn ($rows, callable $label) => $rows->map(fn ($r) => [
            'id' => $r->id,
            'label' => $label($r),
            'customer_id' => $r->customer_id ?? null,
            'supplier_id' => $r->supplier_id ?? null,
            'balance' => isset($r->balance) ? (float) $r->balance : null,
        ])->values()->all();

        return match ($type) {
            'sale' => $map(Sale::query()->with('customer:id,name')
                ->when($search !== '', fn ($q) => $q->where('invoice_number', 'like', $like)->orWhereHas('customer', fn ($c) => $c->where('name', 'like', $like)))
                ->latest('id')->limit(20)->get(), fn ($r) => trim(($r->invoice_number ?: 'Sale #'.$r->id).' · '.($r->customer?->name ?? ''), ' ·')),
            'rental' => $map(Rental::query()->with('customer:id,name')
                ->when($search !== '', fn ($q) => $q->where('rental_number', 'like', $like)->orWhereHas('customer', fn ($c) => $c->where('name', 'like', $like)))
                ->latest('id')->limit(20)->get(), fn ($r) => trim(($r->rental_number ?: 'Rental #'.$r->id).' · '.($r->customer?->name ?? ''), ' ·')),
            'income' => $map(Income::query()
                ->when($search !== '', fn ($q) => $q->where('reference', 'like', $like)->orWhere('source', 'like', $like))
                ->latest('id')->limit(20)->get(), fn ($r) => trim(($r->reference ?: 'Income #'.$r->id).' · '.($r->source ?? ''), ' ·')),
            'expense' => $map(Expense::query()->with('supplier:id,name')
                ->when($search !== '', fn ($q) => $q->where('reference', 'like', $like)->orWhere('category', 'like', $like))
                ->latest('id')->limit(20)->get(), fn ($r) => trim(($r->reference ?: 'Expense #'.$r->id).' · '.($r->supplier?->name ?? $r->category ?? ''), ' ·')),
            'purchase' => $map(Purchase::query()->with('supplier:id,name')
                ->when($search !== '', fn ($q) => $q->where('purchase_number', 'like', $like)->orWhere('bill_number', 'like', $like))
                ->latest('id')->limit(20)->get(), fn ($r) => trim(($r->purchase_number ?: 'Purchase #'.$r->id).' · '.($r->supplier?->name ?? ''), ' ·')),
            default => [],
        };
    }

    public function report(Request $request): array
    {
        $today = Carbon::today();
        $rows = $this->filtered($request)->orderBy('cheque_date')->orderBy('id')->get();
        $group = fn (string $status) => $rows->where('status', $status);
        $totals = fn ($set) => ['count' => $set->count(), 'amount' => round((float) $set->sum('amount'), 2)];

        $upcoming = $rows->filter(fn (Cheque $c) => $c->status === Cheque::STATUS_PENDING && $c->cheque_date->gte($today));
        $overdue = $rows->filter(fn (Cheque $c) => $c->status === Cheque::STATUS_PENDING && $c->cheque_date->lt($today));

        return [
            'summary' => [
                'total' => $totals($rows),
                'pending' => $totals($group(Cheque::STATUS_PENDING)),
                'deposited' => $totals($group(Cheque::STATUS_DEPOSITED)),
                'cleared' => $totals($group(Cheque::STATUS_CLEARED)),
                'bounced' => $totals($group(Cheque::STATUS_BOUNCED)),
                'upcoming' => $totals($upcoming),
                'overdue' => $totals($overdue),
                'received' => $totals($rows->where('type', Cheque::TYPE_RECEIVED)),
                'issued' => $totals($rows->where('type', Cheque::TYPE_ISSUED)),
            ],
            'cheques' => $rows->map(fn (Cheque $c) => $this->transform($c))->values()->all(),
        ];
    }

    public function notifyBounced(Cheque $cheque): void
    {
        $this->notifications->createNotification([
            'type' => 'Cheque Bounced',
            'title' => 'Cheque Bounced',
            'message' => $this->describe($cheque).' has bounced.'
                .($cheque->payment_id ? ' The linked payment is still recorded; reverse it if the amount is unpaid.' : ''),
            'priority' => 'Critical',
            'related_type' => 'cheque',
            'related_id' => $cheque->id,
        ], true);
    }

    public function describe(Cheque $cheque): string
    {
        $number = $cheque->cheque_number ? "Cheque {$cheque->cheque_number}" : "Cheque #{$cheque->id}";
        $bank = $cheque->bank ? " ({$cheque->bank})" : '';
        $party = $cheque->customer?->name ?? $cheque->supplier?->name;
        $direction = $cheque->type === Cheque::TYPE_ISSUED ? 'to' : 'from';

        return $number.$bank.($party ? " {$direction} {$party}" : '').' for LKR '.number_format((float) $cheque->amount, 2);
    }

    private function applyStatus(Cheque $cheque, string $status): void
    {
        $cheque->status = $status;
        $cheque->status_changed_at = now();
        if ($status === Cheque::STATUS_BOUNCED) {
            DB::afterCommit(fn () => $this->notifyBounced($cheque->fresh(['customer', 'supplier'])));
        }
    }

    /** Fills customer/supplier from the linked record when not given, and validates the link exists. */
    private function applyReference(array &$fields): void
    {
        $type = $fields['reference_type'] ?? null;
        $id = $fields['reference_id'] ?? null;
        if (! $type || ! $id) {
            $fields['reference_type'] = null;
            $fields['reference_id'] = null;

            return;
        }

        $class = Cheque::REFERENCE_TYPES[$type] ?? null;
        $record = $class ? $class::query()->find($id) : null;
        if (! $record) {
            throw ValidationException::withMessages(['reference_id' => ['The selected record to link no longer exists.']]);
        }

        if (empty($fields['customer_id']) && ! empty($record->customer_id)) {
            $fields['customer_id'] = $record->customer_id;
        }
        if (empty($fields['supplier_id']) && ! empty($record->supplier_id)) {
            $fields['supplier_id'] = $record->supplier_id;
        }
    }

    private function assertUnique(array $fields, ?int $ignoreId = null): void
    {
        if (empty($fields['cheque_number'])) {
            return;
        }
        $duplicate = Cheque::query()
            ->where('type', $fields['type'] ?? Cheque::TYPE_RECEIVED)
            ->where('cheque_number', $fields['cheque_number'])
            ->where(fn ($q) => empty($fields['bank']) ? $q->whereNull('bank') : $q->where('bank', $fields['bank']))
            ->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'cheque_number' => ['A cheque with this number already exists for this bank.'],
            ]);
        }
    }

    private function fields(array $data): array
    {
        $fields = [];
        foreach (['cheque_number', 'bank', 'amount', 'cheque_date', 'type', 'customer_id', 'supplier_id', 'notes', 'reference_type', 'reference_id'] as $key) {
            if (array_key_exists($key, $data)) {
                $value = $data[$key];
                $fields[$key] = is_string($value) ? (trim($value) === '' ? null : trim($value)) : $value;
            }
        }
        if (array_key_exists('amount', $fields)) {
            $fields['amount'] = round((float) $fields['amount'], 2);
        }

        return $fields;
    }

    /** @var array<string, Model|null> */
    private array $referenceCache = [];

    private function referenceLabel(?string $type, ?int $id): ?string
    {
        $class = Cheque::REFERENCE_TYPES[$type] ?? null;
        if (! $class || ! $id) {
            return null;
        }
        $record = $this->referenceCache["{$type}:{$id}"] ??= $class::query()->find($id);

        return match ($type) {
            'sale' => 'Invoice '.($record?->invoice_number ?: '#'.$id),
            'rental' => 'Rental '.($record?->rental_number ?: '#'.$id),
            'income' => 'Income '.($record?->reference ?: '#'.$id),
            'expense' => 'Expense '.($record?->reference ?: '#'.$id),
            'purchase' => 'Purchase '.($record?->purchase_number ?: '#'.$id),
            default => null,
        };
    }

    private function referenceUrl(?string $type, ?int $id): ?string
    {
        if (! $type || ! $id) {
            return null;
        }

        return match ($type) {
            'sale' => "/sales/{$id}",
            'rental' => "/rentals/{$id}",
            'income' => "/income/{$id}",
            'expense' => "/expenses/{$id}",
            'purchase' => "/purchases/{$id}",
            default => null,
        };
    }
}
