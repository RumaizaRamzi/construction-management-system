<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Product;
use App\Models\Rental;
use App\Models\RentalItem;
use App\Models\RentalPayment;
use App\Models\RentalReturn;
use App\Models\RentalReturnItem;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class RentalService
{
    public const BLOCKING_STATUSES = ['Pending', 'Confirmed', 'Active', 'Overdue', 'Maintenance'];

    public const STOCK_OUT_STATUSES = ['Confirmed', 'Active', 'Overdue', 'Maintenance'];

    public const LATE_FEE_PER_DAY = 2500;

    /** Availability horizon for rentals saved without an expected return date. */
    public const OPEN_ENDED_UNTIL = '9999-12-31';

    public function __construct(
        private readonly EquipmentAvailabilityService $availability,
        private readonly StockMovementService $stockMovements
    ) {
    }

    private function optionalDate(mixed $value): ?string
    {
        $value = trim((string) ($value ?? ''));

        return $value === '' ? null : $value;
    }

    public function rentalDays(string $startDate, ?string $endDate): int
    {
        if ($endDate === null || $endDate === '') {
            return 1;
        }

        $start = Carbon::parse($startDate)->startOfDay();
        $end = Carbon::parse($endDate)->startOfDay();

        return max((int) $start->diffInDays($end), 1);
    }

    public function lateDays(?string $expectedReturn, ?string $actualReturn): int
    {
        if (! $expectedReturn || ! $actualReturn) {
            return 0;
        }

        $expected = Carbon::parse($expectedReturn)->startOfDay();
        $actual = Carbon::parse($actualReturn)->startOfDay();

        if ($actual->lte($expected)) {
            return 0;
        }

        return (int) $expected->diffInDays($actual);
    }

    public function lateFee(int $lateDays, int $quantity = 1, ?float $perDay = null): float
    {
        $perDay ??= (float) app(SettingService::class)->get('late_fee_per_day', self::LATE_FEE_PER_DAY);

        return max(0, $lateDays * $perDay * max(1, $quantity));
    }

    public function paymentStatus(float $paid, float $total, ?string $expectedReturn = null, ?string $rentalStatus = null): string
    {
        $paid = round($paid, 2);
        $total = round($total, 2);

        if ($paid <= 0 && $total <= 0) {
            return 'Paid';
        }

        if ($paid >= $total && $total > 0) {
            return 'Paid';
        }

        if ($paid <= 0) {
            $isPastDue = $expectedReturn
                && Carbon::parse($expectedReturn)->startOfDay()->lt(Carbon::today())
                && ! in_array($rentalStatus, ['Returned', 'Cancelled'], true);

            return $isPastDue ? 'Overdue' : 'Pending';
        }

        if ($paid < $total) {
            $isPastDue = $expectedReturn
                && Carbon::parse($expectedReturn)->startOfDay()->lt(Carbon::today())
                && ! in_array($rentalStatus, ['Returned', 'Cancelled'], true);

            return $isPastDue ? 'Overdue' : 'Partial';
        }

        return 'Paid';
    }

    /**
     * Units of a product already committed for overlapping date ranges
     * (active rentals + blocking bookings).
     */
    public function bookedQuantity(
        int $productId,
        string $startDate,
        string $endDate,
        ?int $excludeRentalId = null,
        ?int $excludeBookingId = null
    ): int {
        return $this->availability->bookedFromRentals($productId, $startDate, $endDate, $excludeRentalId)
            + $this->availability->bookedFromBookings($productId, $startDate, $endDate, $excludeBookingId);
    }

    public function availableQuantity(
        Product $product,
        string $startDate,
        string $endDate,
        ?int $excludeRentalId = null,
        ?int $excludeBookingId = null
    ): int {
        $snap = $this->availability->snapshot($product, $startDate, $endDate, $excludeBookingId, $excludeRentalId);

        return (int) $snap['available_quantity'];
    }

    /**
     * @param  array<int, array{product_id:int, quantity:int, rental_rate?:float|int|string}>  $items
     * @return array{days:int, subtotal:float, discount:float, late_fee:float, damage_fee:float, total:float, line_items:array}
     */
    public function calculateCharges(
        array $items,
        string $startDate,
        ?string $endDate,
        float $discount = 0,
        float $lateFee = 0,
        float $damageFee = 0
    ): array {
        $days = $this->rentalDays($startDate, $endDate);
        $lineItems = [];
        $subtotal = 0.0;

        foreach ($items as $row) {
            $qty = (int) ($row['quantity'] ?? 0);
            $rate = (float) ($row['rental_rate'] ?? 0);
            $lineTotal = round($rate * $qty * $days, 2);
            $subtotal += $lineTotal;
            $lineItems[] = [
                'product_id' => (int) $row['product_id'],
                'quantity' => $qty,
                'rental_rate' => round($rate, 2),
                'rental_days' => $days,
                'subtotal' => $lineTotal,
            ];
        }

        $subtotal = round($subtotal, 2);
        $discount = round(max(0, $discount), 2);
        $lateFee = round(max(0, $lateFee), 2);
        $damageFee = round(max(0, $damageFee), 2);
        $total = round(max(0, $subtotal - $discount + $lateFee + $damageFee), 2);

        return [
            'days' => $days,
            'subtotal' => $subtotal,
            'discount' => $discount,
            'late_fee' => $lateFee,
            'damage_fee' => $damageFee,
            'total' => $total,
            'line_items' => $lineItems,
        ];
    }

    /**
     * Normalize request items: prefer `items[]`, else single product fields.
     *
     * @return array<int, array{product_id:int, quantity:int, rental_rate:float}>
     */
    public function normalizeItems(array $data): array
    {
        if (! empty($data['items']) && is_array($data['items'])) {
            $items = [];
            foreach ($data['items'] as $row) {
                if (! is_array($row)) {
                    continue;
                }
                $items[] = [
                    'product_id' => (int) ($row['product_id'] ?? 0),
                    'quantity' => (int) ($row['quantity'] ?? 0),
                    'rental_rate' => (float) ($row['rental_rate'] ?? $row['rate'] ?? 0),
                ];
            }

            return $items;
        }

        if (! empty($data['product_id'])) {
            return [[
                'product_id' => (int) $data['product_id'],
                'quantity' => (int) ($data['quantity'] ?? 1),
                'rental_rate' => (float) ($data['rental_rate'] ?? $data['rate'] ?? 0),
            ]];
        }

        return [];
    }

    public function nextRentalNumber(): string
    {
        $year = now()->year;
        $prefix = "RNT-{$year}-";

        $latest = Rental::query()
            ->where('rental_number', 'like', $prefix.'%')
            ->orderByDesc('rental_number')
            ->value('rental_number');

        $next = 1;
        if ($latest && preg_match('/RNT-\d{4}-(\d+)/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 3, '0', STR_PAD_LEFT);
    }

    public function assertCustomerActive(int $customerId): Customer
    {
        $customer = Customer::query()->find($customerId);
        if (! $customer) {
            throw ValidationException::withMessages([
                'customer_id' => ['Customer not found.'],
            ]);
        }

        if (strcasecmp((string) $customer->status, 'Inactive') === 0) {
            throw ValidationException::withMessages([
                'customer_id' => ['This customer is inactive and cannot be used for rentals.'],
            ]);
        }

        return $customer;
    }

    /**
     * @param  array<int, array{product_id:int, quantity:int, rental_rate:float}>  $items
     */
    public function assertAvailability(
        array $items,
        string $startDate,
        string $endDate,
        ?int $excludeRentalId = null,
        ?int $excludeBookingId = null
    ): void {
        foreach ($items as $row) {
            $product = Product::query()->find($row['product_id']);
            if (! $product) {
                throw ValidationException::withMessages([
                    'items' => ["Product #{$row['product_id']} was not found."],
                ]);
            }

            $alreadyOnRental = $excludeRentalId !== null && RentalItem::query()
                ->where('rental_id', $excludeRentalId)
                ->where('product_id', $product->id)
                ->exists();

            if (! $product->isRentable() && ! $alreadyOnRental) {
                throw ValidationException::withMessages([
                    'items' => [$product->listing_type === Product::LISTING_NONE
                        ? "{$product->name} is not listed yet. List it for rent before renting it."
                        : "{$product->name} has been transferred to sales inventory and cannot be rented."],
                ]);
            }

            $available = $this->availableQuantity(
                $product,
                $startDate,
                $endDate,
                $excludeRentalId,
                $excludeBookingId
            );
            $requested = (int) $row['quantity'];

            if ($requested > $available) {
                $name = $product->name ?: 'this equipment';
                $unitWord = $available === 1 ? 'unit' : 'units';
                $verb = $available === 1 ? 'is' : 'are';
                throw ValidationException::withMessages([
                    'quantity' => [
                        "Only {$available} {$unitWord} of {$name} {$verb} available for the selected dates.",
                    ],
                    'items' => [
                        "Only {$available} {$unitWord} of {$name} {$verb} available for the selected dates.",
                    ],
                ]);
            }
        }
    }

    public function applyStockOut(Product $product, int $quantity, ?Rental $rental = null): void
    {
        $qty = max(0, $quantity);
        if ($qty <= 0) {
            return;
        }
        $previous = (int) $product->available_quantity;
        $product->rented_quantity = (int) $product->rented_quantity + $qty;
        $product->available_quantity = max(0, $previous - $qty);
        if ($product->available_quantity <= 0 && strcasecmp((string) $product->status, 'Maintenance') !== 0) {
            $product->status = 'Rented';
        }
        $product->save();

        $this->stockMovements->record(
            $product,
            StockMovementService::TYPE_RENTAL_OUT,
            -$qty,
            $previous,
            (int) $product->available_quantity,
            $rental,
            $rental ? 'Rental '.$rental->rental_number : 'Rental out'
        );
    }

    public function restoreStock(Product $product, int $quantity, ?Rental $rental = null): void
    {
        $qty = max(0, $quantity);
        if ($qty <= 0) {
            return;
        }
        $previous = (int) $product->available_quantity;
        $product->rented_quantity = max(0, (int) $product->rented_quantity - $qty);
        $product->available_quantity = min(
            (int) $product->quantity,
            $previous + $qty
        );
        if ($product->available_quantity > 0 && strcasecmp((string) $product->status, 'Maintenance') !== 0) {
            $product->status = 'Available';
        }
        $product->save();

        $this->stockMovements->record(
            $product,
            StockMovementService::TYPE_RENTAL_RETURN,
            $qty,
            $previous,
            (int) $product->available_quantity,
            $rental,
            $rental ? 'Rental '.$rental->rental_number.' restored' : 'Rental stock restored'
        );
    }

    public function applyReturnInventory(
        Product $product,
        int $returned,
        int $damaged,
        int $missing,
        bool $sendToMaintenance = false,
        ?Rental $rental = null
    ): void {
        $previous = (int) $product->available_quantity;
        $released = $returned + $damaged + $missing;
        $product->rented_quantity = max(0, (int) $product->rented_quantity - $released);

        if ($missing > 0) {
            $product->quantity = max(0, (int) $product->quantity - $missing);
        }

        // Only good returned units go back on the shelf; damaged units stay out of
        // available stock (held for repair) and missing units leave total quantity.
        $product->available_quantity = max(0, min(
            (int) $product->quantity - (int) $product->rented_quantity,
            (int) $product->available_quantity + max(0, $returned)
        ));

        if ($damaged > 0 || $sendToMaintenance) {
            $product->status = 'Maintenance';
        } elseif ((int) $product->available_quantity > 0) {
            $product->status = 'Available';
        } elseif ((int) $product->rented_quantity > 0) {
            $product->status = 'Rented';
        }

        $product->save();

        $label = $rental ? 'Rental '.$rental->rental_number.' return' : 'Rental return';
        if ($returned > 0) {
            $this->stockMovements->record(
                $product,
                StockMovementService::TYPE_RENTAL_RETURN,
                $returned,
                $previous,
                (int) $product->available_quantity,
                $rental,
                $label
            );
        }
        if ($missing > 0) {
            $this->stockMovements->record(
                $product,
                StockMovementService::TYPE_MISSING,
                -$missing,
                (int) $product->available_quantity,
                (int) $product->available_quantity,
                $rental,
                $label.' — missing'
            );
        }
        if ($damaged > 0) {
            $this->stockMovements->record(
                $product,
                StockMovementService::TYPE_DAMAGE,
                0,
                (int) $product->available_quantity,
                (int) $product->available_quantity,
                $rental,
                $label.' — damaged'
            );
        }
    }

    public function syncPaymentTotals(Rental $rental): Rental
    {
        $paid = round((float) $rental->payments()->sum('amount'), 2);
        $total = round((float) $rental->total_amount, 2);
        $rental->paid_amount = $paid;
        $rental->balance = round(max(0, $total - $paid), 2);
        $rental->payment_status = $this->paymentStatus(
            $paid,
            $total,
            optional($rental->expected_return_date)?->toDateString(),
            $rental->status
        );
        $rental->save();

        return $rental;
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function create(array $data): Rental
    {
        return DB::transaction(function () use ($data) {
            $customerId = (int) ($data['customer_id'] ?? 0);
            $this->assertCustomerActive($customerId);

            $startDate = (string) ($data['start_date'] ?? '');
            $endDate = $this->optionalDate($data['expected_return_date'] ?? $data['expected_return'] ?? null);

            if ($startDate === '') {
                throw ValidationException::withMessages([
                    'start_date' => ['Start date is required.'],
                ]);
            }

            if ($endDate !== null && Carbon::parse($endDate)->lt(Carbon::parse($startDate))) {
                throw ValidationException::withMessages([
                    'expected_return_date' => ['Return date must be on or after the start date.'],
                ]);
            }

            $items = $this->normalizeItems($data);
            if ($items === []) {
                throw ValidationException::withMessages([
                    'items' => ['At least one rental item is required.'],
                ]);
            }

            foreach ($items as $row) {
                if ($row['product_id'] <= 0 || $row['quantity'] <= 0) {
                    throw ValidationException::withMessages([
                        'items' => ['Each item needs a valid product and quantity greater than zero.'],
                    ]);
                }
                if ($row['rental_rate'] < 0) {
                    throw ValidationException::withMessages([
                        'rental_rate' => ['Rental rate cannot be negative.'],
                    ]);
                }
            }

            $this->assertAvailability(
                $items,
                $startDate,
                $endDate ?? self::OPEN_ENDED_UNTIL,
                null,
                isset($data['exclude_booking_id']) ? (int) $data['exclude_booking_id'] : null
            );

            $discount = (float) ($data['discount'] ?? 0);
            $charges = $this->calculateCharges($items, $startDate, $endDate, $discount, 0, 0);

            $status = (string) ($data['status'] ?? $data['rental_status'] ?? 'Confirmed');
            if (! in_array($status, ['Pending', 'Confirmed', 'Active', 'Overdue', 'Returned', 'Cancelled', 'Maintenance'], true)) {
                $status = 'Confirmed';
            }

            $deposit = round((float) ($data['deposit'] ?? $data['deposit_amount'] ?? 0), 2);
            $paymentAmount = round((float) ($data['payment_amount'] ?? $data['amount_paid'] ?? $data['paid_amount'] ?? 0), 2);
            $paymentMethod = $data['payment_method'] ?? null;

            $rental = Rental::query()->create([
                'rental_number' => $data['rental_number'] ?? $this->nextRentalNumber(),
                'customer_id' => $customerId,
                'start_date' => $startDate,
                'expected_return_date' => $endDate,
                'actual_return_date' => null,
                'subtotal' => $charges['subtotal'],
                'discount' => $charges['discount'],
                'deposit' => $deposit,
                'late_fee' => 0,
                'damage_fee' => 0,
                'total_amount' => $charges['total'],
                'paid_amount' => 0,
                'balance' => $charges['total'],
                'payment_status' => 'Pending',
                'payment_method' => $paymentMethod,
                'status' => $status,
                'notes' => $data['notes'] ?? null,
                'branch_id' => $data['branch_id'] ?? null,
            ]);

            foreach ($charges['line_items'] as $line) {
                RentalItem::query()->create([
                    'rental_id' => $rental->id,
                    'product_id' => $line['product_id'],
                    'quantity' => $line['quantity'],
                    'rental_rate' => $line['rental_rate'],
                    'rental_days' => $line['rental_days'],
                    'subtotal' => $line['subtotal'],
                ]);

                if (in_array($status, self::STOCK_OUT_STATUSES, true)) {
                    $product = Product::query()->lockForUpdate()->find($line['product_id']);
                    if ($product) {
                        $this->applyStockOut($product, $line['quantity'], $rental);
                    }
                }
            }

            if ($paymentAmount > 0) {
                if ($paymentAmount > $charges['total'] + 0.009) {
                    throw ValidationException::withMessages([
                        'payment_amount' => ['Payment amount cannot exceed the rental total.'],
                    ]);
                }

                RentalPayment::query()->create([
                    'rental_id' => $rental->id,
                    'payment_date' => $data['payment_date'] ?? $startDate,
                    'amount' => $paymentAmount,
                    'payment_method' => $paymentMethod,
                    'reference' => $data['reference'] ?? $data['reference_number'] ?? null,
                    'notes' => $data['payment_notes'] ?? null,
                ]);
            }

            $this->syncPaymentTotals($rental->fresh());

            return $rental->fresh(['customer', 'items.product.category', 'payments', 'returns']);
        });
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function update(Rental $rental, array $data): Rental
    {
        return DB::transaction(function () use ($rental, $data) {
            $rental = Rental::query()->lockForUpdate()->with(['items', 'payments', 'returns'])->findOrFail($rental->id);

            if (in_array($rental->status, ['Returned', 'Cancelled'], true) && empty($data['force'])) {
                throw ValidationException::withMessages([
                    'status' => ['Returned or cancelled rentals cannot be edited.'],
                ]);
            }

            $wasStockOut = in_array($rental->status, self::STOCK_OUT_STATUSES, true);

            // Restore previous stock before re-applying.
            if ($wasStockOut) {
                foreach ($rental->items as $item) {
                    $product = Product::query()->lockForUpdate()->find($item->product_id);
                    if ($product) {
                        $this->restoreStock($product, (int) $item->quantity, $rental);
                    }
                }
            }

            $customerId = (int) ($data['customer_id'] ?? $rental->customer_id);
            $this->assertCustomerActive($customerId);

            $startDate = (string) ($data['start_date'] ?? $rental->start_date->toDateString());
            $endDate = array_key_exists('expected_return_date', $data) || array_key_exists('expected_return', $data)
                ? $this->optionalDate($data['expected_return_date'] ?? $data['expected_return'] ?? null)
                : $rental->expected_return_date?->toDateString();

            if ($endDate !== null && Carbon::parse($endDate)->lt(Carbon::parse($startDate))) {
                throw ValidationException::withMessages([
                    'expected_return_date' => ['Return date must be on or after the start date.'],
                ]);
            }

            $items = $this->normalizeItems($data);
            if ($items === []) {
                $items = $rental->items->map(fn (RentalItem $i) => [
                    'product_id' => (int) $i->product_id,
                    'quantity' => (int) $i->quantity,
                    'rental_rate' => (float) $i->rental_rate,
                ])->all();
            }

            $this->assertAvailability($items, $startDate, $endDate ?? self::OPEN_ENDED_UNTIL, $rental->id);

            $discount = (float) ($data['discount'] ?? $rental->discount);
            $lateFee = (float) ($data['late_fee'] ?? $rental->late_fee);
            $damageFee = (float) ($data['damage_fee'] ?? $rental->damage_fee);
            $charges = $this->calculateCharges($items, $startDate, $endDate, $discount, $lateFee, $damageFee);

            $status = (string) ($data['status'] ?? $data['rental_status'] ?? $rental->status);
            $deposit = array_key_exists('deposit', $data) || array_key_exists('deposit_amount', $data)
                ? round((float) ($data['deposit'] ?? $data['deposit_amount'] ?? 0), 2)
                : (float) $rental->deposit;

            $rental->update([
                'customer_id' => $customerId,
                'start_date' => $startDate,
                'expected_return_date' => $endDate,
                'subtotal' => $charges['subtotal'],
                'discount' => $charges['discount'],
                'deposit' => $deposit,
                'late_fee' => $charges['late_fee'],
                'damage_fee' => $charges['damage_fee'],
                'total_amount' => $charges['total'],
                'payment_method' => $data['payment_method'] ?? $rental->payment_method,
                'status' => $status,
                'notes' => array_key_exists('notes', $data) ? $data['notes'] : $rental->notes,
                'branch_id' => array_key_exists('branch_id', $data) ? $data['branch_id'] : $rental->branch_id,
            ]);

            $rental->items()->delete();
            foreach ($charges['line_items'] as $line) {
                RentalItem::query()->create([
                    'rental_id' => $rental->id,
                    'product_id' => $line['product_id'],
                    'quantity' => $line['quantity'],
                    'rental_rate' => $line['rental_rate'],
                    'rental_days' => $line['rental_days'],
                    'subtotal' => $line['subtotal'],
                ]);

                if (in_array($status, self::STOCK_OUT_STATUSES, true)) {
                    $product = Product::query()->lockForUpdate()->find($line['product_id']);
                    if ($product) {
                        $this->applyStockOut($product, $line['quantity'], $rental);
                    }
                }
            }

            // Cancelled: stock already restored above and not re-applied.
            if ($status === 'Cancelled' && $wasStockOut === false) {
                // nothing
            }

            $this->syncPaymentTotals($rental->fresh());

            return $rental->fresh(['customer', 'items.product.category', 'payments', 'returns']);
        });
    }

    public function delete(Rental $rental): void
    {
        DB::transaction(function () use ($rental) {
            $rental = Rental::query()->lockForUpdate()->with('items')->findOrFail($rental->id);

            if (in_array($rental->status, self::STOCK_OUT_STATUSES, true)) {
                foreach ($rental->items as $item) {
                    $product = Product::query()->lockForUpdate()->find($item->product_id);
                    if ($product) {
                        $this->restoreStock($product, (int) $item->quantity, $rental);
                    }
                }
            }

            $rental->delete();
        });
    }

    public function addPayment(Rental $rental, array $data): RentalPayment
    {
        return DB::transaction(function () use ($rental, $data) {
            $rental = Rental::query()->lockForUpdate()->findOrFail($rental->id);

            $amount = round((float) ($data['amount'] ?? 0), 2);
            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'amount' => ['Payment amount must be greater than zero.'],
                ]);
            }

            $balance = round((float) $rental->balance, 2);
            if ($amount > $balance + 0.009) {
                throw ValidationException::withMessages([
                    'amount' => ["Payment exceeds the outstanding balance of {$balance}."],
                ]);
            }

            $payment = RentalPayment::query()->create([
                'rental_id' => $rental->id,
                'payment_date' => $data['payment_date'] ?? now()->toDateString(),
                'amount' => $amount,
                'payment_method' => $data['payment_method'] ?? $rental->payment_method,
                'reference' => $data['reference'] ?? $data['reference_number'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            if (! empty($data['payment_method'])) {
                $rental->payment_method = $data['payment_method'];
                $rental->save();
            }

            $this->syncPaymentTotals($rental);

            return $payment->fresh();
        });
    }

    public function updatePayment(Rental $rental, RentalPayment $payment, array $data): RentalPayment
    {
        return DB::transaction(function () use ($rental, $payment, $data) {
            $rental = Rental::query()->lockForUpdate()->findOrFail($rental->id);
            $payment = RentalPayment::query()->where('rental_id', $rental->id)->lockForUpdate()->findOrFail($payment->id);

            $amount = array_key_exists('amount', $data)
                ? round((float) $data['amount'], 2)
                : (float) $payment->amount;

            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'amount' => ['Payment amount must be greater than zero.'],
                ]);
            }

            $otherPaid = (float) $rental->payments()->where('id', '!=', $payment->id)->sum('amount');
            $total = (float) $rental->total_amount;
            if ($otherPaid + $amount > $total + 0.009) {
                throw ValidationException::withMessages([
                    'amount' => ['Payment would exceed the rental total.'],
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

            $this->syncPaymentTotals($rental);

            return $payment->fresh();
        });
    }

    public function deletePayment(Rental $rental, RentalPayment $payment): void
    {
        DB::transaction(function () use ($rental, $payment) {
            $rental = Rental::query()->lockForUpdate()->findOrFail($rental->id);
            $payment = RentalPayment::query()->where('rental_id', $rental->id)->lockForUpdate()->findOrFail($payment->id);
            $payment->delete();
            $this->syncPaymentTotals($rental);
        });
    }

    public function processReturn(Rental $rental, array $data): Rental
    {
        return DB::transaction(function () use ($rental, $data) {
            $rental = Rental::query()->lockForUpdate()->with(['items', 'returns.items'])->findOrFail($rental->id);

            if (in_array($rental->status, ['Returned', 'Cancelled'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['This rental has already been returned or cancelled.'],
                ]);
            }

            $returnDate = (string) ($data['return_date'] ?? $data['actual_return_date'] ?? now()->toDateString());
            $rentedQty = (int) $rental->items->sum('quantity');
            $outstanding = $this->outstandingByItem($rental);
            $allocation = ! empty($data['items']) && is_array($data['items'])
                ? $this->allocateExplicitReturn($rental, $outstanding, $data['items'])
                : $this->allocateAggregateReturn(
                    $outstanding,
                    (int) ($data['returned_quantity'] ?? $data['returned_qty'] ?? 0),
                    (int) ($data['damaged_quantity'] ?? $data['damaged_qty'] ?? 0),
                    (int) ($data['missing_quantity'] ?? $data['missing_qty'] ?? 0)
                );

            $returned = array_sum(array_column($allocation, 'returned'));
            $damaged = array_sum(array_column($allocation, 'damaged'));
            $missing = array_sum(array_column($allocation, 'missing'));

            if ($returned + $damaged + $missing <= 0) {
                throw ValidationException::withMessages([
                    'returned_quantity' => ['At least one unit must be accounted for on return.'],
                ]);
            }

            $already = $rentedQty - array_sum($outstanding);

            $lateDays = $this->lateDays(
                $rental->expected_return_date?->toDateString(),
                $returnDate
            );
            $lateFee = isset($data['late_fee'])
                ? round((float) $data['late_fee'], 2)
                : $this->lateFee($lateDays, max(1, $returned + $damaged + $missing));
            $damageFee = round((float) ($data['damage_fee'] ?? 0), 2);
            $condition = $data['condition'] ?? null;
            $sendToMaintenance = (bool) ($data['send_to_maintenance'] ?? false)
                || in_array($condition, ['Damaged', 'Needs Maintenance'], true);

            $deposit = (float) $rental->deposit;
            $depositRefund = max(0, $deposit - $damageFee - $lateFee);

            $notesParts = [];
            if (! empty($data['notes'])) {
                $notesParts[] = (string) $data['notes'];
            }
            if (! empty($data['damage_description'])) {
                $notesParts[] = 'Damage: '.$data['damage_description'];
            }
            $notesParts[] = 'Deposit refund: '.$depositRefund;

            $rentalReturn = RentalReturn::query()->create([
                'rental_id' => $rental->id,
                'return_date' => $returnDate,
                'returned_quantity' => $returned,
                'damaged_quantity' => $damaged,
                'missing_quantity' => $missing,
                'condition' => $condition,
                'late_days' => $lateDays,
                'late_fee' => $lateFee,
                'damage_fee' => $damageFee,
                'status' => $sendToMaintenance ? 'Maintenance' : 'Completed',
                'notes' => implode(' | ', $notesParts),
            ]);

            foreach ($allocation as $itemId => $qty) {
                if ($qty['returned'] + $qty['damaged'] + $qty['missing'] <= 0) {
                    continue;
                }
                $rentalReturn->items()->create([
                    'rental_item_id' => $itemId,
                    'product_id' => $rental->items->firstWhere('id', $itemId)?->product_id,
                    'returned_quantity' => $qty['returned'],
                    'damaged_quantity' => $qty['damaged'],
                    'missing_quantity' => $qty['missing'],
                ]);
            }

            $priorStatus = $rental->status;
            $wasStockOut = in_array($priorStatus, self::STOCK_OUT_STATUSES, true);

            if (! $rental->expected_return_date) {
                // Open-ended rentals are billed up to the actual return date.
                $days = $this->rentalDays($rental->start_date->toDateString(), $returnDate);
                $subtotal = 0.0;
                foreach ($rental->items as $item) {
                    $item->rental_days = $days;
                    $item->subtotal = round((float) $item->rental_rate * (int) $item->quantity * $days, 2);
                    $item->save();
                    $subtotal += (float) $item->subtotal;
                }
                $rental->subtotal = round($subtotal, 2);
            }

            $rental->late_fee = round((float) $rental->late_fee + $lateFee, 2);
            $rental->damage_fee = round((float) $rental->damage_fee + $damageFee, 2);
            $rental->total_amount = round(max(
                0,
                (float) $rental->subtotal - (float) $rental->discount + (float) $rental->late_fee + (float) $rental->damage_fee
            ), 2);
            $rental->actual_return_date = $returnDate;

            $processed = $already + $returned + $damaged + $missing;
            if ($processed >= $rentedQty) {
                $rental->status = $sendToMaintenance ? 'Maintenance' : 'Returned';
            }

            $rental->save();

            if ($wasStockOut) {
                foreach ($rental->items as $item) {
                    $qty = $allocation[$item->id] ?? null;
                    if (! $qty || $qty['returned'] + $qty['damaged'] + $qty['missing'] <= 0) {
                        continue;
                    }
                    $product = Product::query()->lockForUpdate()->find($item->product_id);
                    if ($product) {
                        $this->applyReturnInventory(
                            $product,
                            $qty['returned'],
                            $qty['damaged'],
                            $qty['missing'],
                            $sendToMaintenance && ($qty['damaged'] > 0 || $damaged === 0),
                            $rental
                        );
                    }
                }
            }

            $this->syncPaymentTotals($rental->fresh());

            return $rental->fresh(['customer', 'items.product.category', 'payments', 'returns']);
        });
    }

    /**
     * Units still out per rental item. Returns recorded before per-item tracking
     * existed are attributed to items in order, matching how they were entered.
     *
     * @return array<int, int> rental_item_id => outstanding units
     */
    private function outstandingByItem(Rental $rental): array
    {
        $outstanding = [];
        foreach ($rental->items as $item) {
            $outstanding[$item->id] = (int) $item->quantity;
        }

        foreach ($rental->returns as $ret) {
            if ($ret->items->isNotEmpty()) {
                foreach ($ret->items as $line) {
                    if (isset($outstanding[$line->rental_item_id])) {
                        $outstanding[$line->rental_item_id] = max(
                            0,
                            $outstanding[$line->rental_item_id]
                                - (int) $line->returned_quantity - (int) $line->damaged_quantity - (int) $line->missing_quantity
                        );
                    }
                }
                continue;
            }

            $legacy = (int) $ret->returned_quantity + (int) $ret->damaged_quantity + (int) $ret->missing_quantity;
            foreach ($outstanding as $itemId => $left) {
                if ($legacy <= 0) {
                    break;
                }
                $take = min($left, $legacy);
                $outstanding[$itemId] -= $take;
                $legacy -= $take;
            }
        }

        return $outstanding;
    }

    /**
     * @param  array<int, int>  $outstanding
     * @param  array<int, array<string, mixed>>  $lines
     * @return array<int, array{returned:int, damaged:int, missing:int}>
     */
    private function allocateExplicitReturn(Rental $rental, array $outstanding, array $lines): array
    {
        $allocation = [];
        foreach ($lines as $index => $line) {
            $item = ! empty($line['rental_item_id'])
                ? $rental->items->firstWhere('id', (int) $line['rental_item_id'])
                : $rental->items->firstWhere('product_id', (int) ($line['product_id'] ?? 0));

            if (! $item) {
                throw ValidationException::withMessages([
                    "items.$index" => ['This item does not belong to the rental.'],
                ]);
            }

            $qty = $allocation[$item->id] ?? ['returned' => 0, 'damaged' => 0, 'missing' => 0];
            $qty['returned'] += max(0, (int) ($line['returned_quantity'] ?? 0));
            $qty['damaged'] += max(0, (int) ($line['damaged_quantity'] ?? 0));
            $qty['missing'] += max(0, (int) ($line['missing_quantity'] ?? 0));

            if (array_sum($qty) > ($outstanding[$item->id] ?? 0)) {
                throw ValidationException::withMessages([
                    "items.$index" => [sprintf(
                        'Only %d unit(s) of this item are still out on rental.',
                        $outstanding[$item->id] ?? 0
                    )],
                ]);
            }

            $allocation[$item->id] = $qty;
        }

        return $allocation;
    }

    /**
     * Distributes whole-rental totals across items with units still out: returned
     * units first, then damaged, then missing.
     *
     * @param  array<int, int>  $outstanding
     * @return array<int, array{returned:int, damaged:int, missing:int}>
     */
    private function allocateAggregateReturn(array $outstanding, int $returned, int $damaged, int $missing): array
    {
        $total = max(0, $returned) + max(0, $damaged) + max(0, $missing);
        $available = array_sum($outstanding);

        if ($total > $available) {
            throw ValidationException::withMessages([
                'returned_quantity' => [$available === 0
                    ? 'All rented units have already been returned.'
                    : "Returned + damaged + missing must not exceed the {$available} unit(s) still out on rental."],
            ]);
        }

        $allocation = [];
        $remaining = $outstanding;
        foreach (['returned' => $returned, 'damaged' => $damaged, 'missing' => $missing] as $kind => $count) {
            $count = max(0, $count);
            foreach ($remaining as $itemId => $left) {
                $allocation[$itemId] ??= ['returned' => 0, 'damaged' => 0, 'missing' => 0];
                if ($count <= 0 || $left <= 0) {
                    continue;
                }
                $take = min($left, $count);
                $allocation[$itemId][$kind] += $take;
                $remaining[$itemId] -= $take;
                $count -= $take;
            }
        }

        return $allocation;
    }

    public function transform(Rental $rental): array
    {
        $rental->loadMissing(['customer', 'items.product.category', 'payments', 'returns.items']);

        $firstItem = $rental->items->first();
        $product = $firstItem?->product;
        $customer = $rental->customer;

        $depositRefund = null;
        $latestReturn = $rental->returns->sortByDesc('id')->first();
        if ($latestReturn) {
            $depositRefund = max(
                0,
                (float) $rental->deposit - (float) $rental->damage_fee - (float) $rental->late_fee
            );
        }

        return [
            'id' => $rental->id,
            'rental_number' => $rental->rental_number,
            'customer_id' => $rental->customer_id,
            'customer' => $customer ? [
                'id' => $customer->id,
                'name' => $customer->name,
                'customer_code' => $customer->customer_code,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'address' => $customer->address,
            ] : null,
            'start_date' => optional($rental->start_date)?->toDateString(),
            'expected_return_date' => optional($rental->expected_return_date)?->toDateString(),
            'actual_return_date' => optional($rental->actual_return_date)?->toDateString(),
            'branch_id' => $rental->branch_id,
            'subtotal' => (float) $rental->subtotal,
            'discount' => (float) $rental->discount,
            'deposit' => (float) $rental->deposit,
            'deposit_refund' => $depositRefund,
            'late_fee' => (float) $rental->late_fee,
            'damage_fee' => (float) $rental->damage_fee,
            'total_amount' => (float) $rental->total_amount,
            'paid_amount' => (float) $rental->paid_amount,
            'balance' => (float) $rental->balance,
            'payment_status' => $rental->payment_status,
            'payment_method' => $rental->payment_method,
            'status' => $rental->status,
            'notes' => $rental->notes,
            'rental_days' => $firstItem?->rental_days
                ?? $this->rentalDays(
                    (string) optional($rental->start_date)?->toDateString(),
                    (string) optional($rental->expected_return_date)?->toDateString()
                ),
            'items' => $rental->items->map(fn (RentalItem $item) => [
                'id' => $item->id,
                'rental_id' => $item->rental_id,
                'product_id' => $item->product_id,
                'quantity' => (int) $item->quantity,
                'rental_rate' => (float) $item->rental_rate,
                'rental_days' => (int) $item->rental_days,
                'subtotal' => (float) $item->subtotal,
                'product' => $item->product ? [
                    'id' => $item->product->id,
                    'serial_number' => $item->product->serial_number,
                    'name' => $item->product->name,
                    'image' => $item->product->image,
                    'condition' => $item->product->condition,
                    'category' => $item->product->category?->name,
                    'category_id' => $item->product->category_id,
                ] : null,
            ])->values()->all(),
            'payments' => $rental->payments->map(fn (RentalPayment $p) => [
                'id' => $p->id,
                'rental_id' => $p->rental_id,
                'payment_date' => optional($p->payment_date)?->toDateString(),
                'amount' => (float) $p->amount,
                'payment_method' => $p->payment_method,
                'reference' => $p->reference,
                'reference_number' => $p->reference,
                'notes' => $p->notes,
            ])->values()->all(),
            'returns' => $rental->returns->map(fn (RentalReturn $r) => [
                'id' => $r->id,
                'rental_id' => $r->rental_id,
                'return_date' => optional($r->return_date)?->toDateString(),
                'returned_quantity' => (int) $r->returned_quantity,
                'damaged_quantity' => (int) $r->damaged_quantity,
                'missing_quantity' => (int) $r->missing_quantity,
                'condition' => $r->condition,
                'late_days' => (int) $r->late_days,
                'late_fee' => (float) $r->late_fee,
                'damage_fee' => (float) $r->damage_fee,
                'deposit_refund' => max(0, (float) $rental->deposit - (float) $r->damage_fee - (float) $r->late_fee),
                'status' => $r->status,
                'notes' => $r->notes,
                'items' => $r->items->map(fn (RentalReturnItem $line) => [
                    'rental_item_id' => $line->rental_item_id,
                    'product_id' => $line->product_id,
                    'product_name' => $rental->items->firstWhere('id', $line->rental_item_id)?->product?->name,
                    'returned_quantity' => (int) $line->returned_quantity,
                    'damaged_quantity' => (int) $line->damaged_quantity,
                    'missing_quantity' => (int) $line->missing_quantity,
                ])->values()->all(),
            ])->values()->all(),
            // Convenience fields for current single-product UI
            'product_id' => $firstItem?->product_id,
            'quantity' => $firstItem ? (int) $firstItem->quantity : 0,
            'rental_rate' => $firstItem ? (float) $firstItem->rental_rate : 0,
            'product_name' => $product?->name,
            'product_serial_number' => $product?->serial_number,
            'product_image' => $product?->image,
            'product_condition' => $product?->condition,
            'product_category' => $product?->category?->name,
            'customer_name' => $customer?->name,
            'customer_phone' => $customer?->phone,
            'customer_email' => $customer?->email,
            'customer_address' => $customer?->address,
            'created_at' => optional($rental->created_at)?->toIso8601String(),
            'updated_at' => optional($rental->updated_at)?->toIso8601String(),
        ];
    }
}
