<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Customer;
use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class BookingService
{
    public const STATUSES = ['Pending', 'Confirmed', 'Active', 'Completed', 'Cancelled', 'Rejected'];

    /** @var array<string, list<string>> */
    public const TRANSITIONS = [
        'Pending' => ['Confirmed', 'Rejected', 'Cancelled'],
        'Confirmed' => ['Active', 'Cancelled', 'Completed'],
        'Active' => ['Completed', 'Cancelled'],
        'Completed' => [],
        'Cancelled' => [],
        'Rejected' => [],
    ];

    public function __construct(
        private readonly EquipmentAvailabilityService $availability,
        private readonly RentalService $rentals
    ) {
    }

    public function bookingDays(string $startDate, string $endDate): int
    {
        $start = Carbon::parse($startDate)->startOfDay();
        $end = Carbon::parse($endDate)->startOfDay();

        return max((int) $start->diffInDays($end), 1);
    }

    public function nextBookingNumber(): string
    {
        $year = now()->year;
        $prefix = "BKG-{$year}-";

        $latest = Booking::query()
            ->where('booking_number', 'like', $prefix.'%')
            ->orderByDesc('booking_number')
            ->value('booking_number');

        $next = 1;
        if ($latest && preg_match('/BKG-\d{4}-(\d+)/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 3, '0', STR_PAD_LEFT);
    }

    public function paymentStatus(float $paid, float $total): string
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
            return 'Pending';
        }

        return 'Partial';
    }

    /**
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

    /**
     * @param  array<int, array{product_id:int, quantity:int, rental_rate:float}>  $items
     * @return array{days:int, subtotal:float, discount:float, total:float, line_items:array}
     */
    public function calculateCharges(array $items, string $startDate, string $endDate, float $discount = 0): array
    {
        $days = $this->bookingDays($startDate, $endDate);
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
        $total = round(max(0, $subtotal - $discount), 2);

        return compact('days', 'subtotal', 'discount', 'total') + ['line_items' => $lineItems];
    }

    public function assertCustomer(int $customerId): Customer
    {
        $customer = Customer::query()->find($customerId);
        if (! $customer) {
            throw ValidationException::withMessages([
                'customer_id' => ['Customer not found.'],
            ]);
        }
        if (strcasecmp((string) $customer->status, 'Inactive') === 0) {
            throw ValidationException::withMessages([
                'customer_id' => ['This customer is inactive and cannot be used for bookings.'],
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
        ?int $excludeBookingId = null
    ): void {
        foreach ($items as $row) {
            $product = Product::query()->find($row['product_id']);
            if (! $product) {
                throw ValidationException::withMessages([
                    'items' => ["Product #{$row['product_id']} was not found."],
                ]);
            }

            if (! $product->isRentable()) {
                throw ValidationException::withMessages([
                    'items' => [$product->listing_type === Product::LISTING_NONE
                        ? "{$product->name} is not listed yet. List it for rent before booking it."
                        : "{$product->name} has been transferred to sales inventory and cannot be booked for rental."],
                ]);
            }

            $result = $this->availability->assertCanReserve(
                $product,
                (int) $row['quantity'],
                $startDate,
                $endDate,
                $excludeBookingId,
                null
            );

            if (! $result['ok']) {
                throw ValidationException::withMessages([
                    'quantity' => [$result['message']],
                    'items' => [$result['message']],
                ]);
            }
        }
    }

    public function checkAvailability(int $productId, string $startDate, string $endDate, ?int $excludeBookingId = null): array
    {
        $product = Product::query()->find($productId);
        if (! $product) {
            throw ValidationException::withMessages([
                'product_id' => ['Product not found.'],
            ]);
        }

        return $this->availability->snapshot($product, $startDate, $endDate, $excludeBookingId, null);
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function create(array $data): Booking
    {
        return DB::transaction(function () use ($data) {
            $customerId = (int) ($data['customer_id'] ?? 0);
            $this->assertCustomer($customerId);

            $startDate = (string) ($data['start_date'] ?? '');
            $endDate = (string) ($data['end_date'] ?? '');
            $bookingDate = (string) ($data['booking_date'] ?? now()->toDateString());

            if ($startDate === '' || $endDate === '') {
                throw ValidationException::withMessages([
                    'start_date' => ['Start date and end date are required.'],
                ]);
            }

            if (Carbon::parse($endDate)->lt(Carbon::parse($startDate))) {
                throw ValidationException::withMessages([
                    'end_date' => ['End date must be on or after the start date.'],
                ]);
            }

            $items = $this->normalizeItems($data);
            if ($items === []) {
                throw ValidationException::withMessages([
                    'items' => ['At least one booking item is required.'],
                ]);
            }

            foreach ($items as $row) {
                if ($row['product_id'] <= 0 || $row['quantity'] <= 0) {
                    throw ValidationException::withMessages([
                        'items' => ['Each item needs a valid product and quantity greater than zero.'],
                    ]);
                }
            }

            $this->assertAvailability($items, $startDate, $endDate);

            $discount = (float) ($data['discount'] ?? 0);
            $charges = $this->calculateCharges($items, $startDate, $endDate, $discount);
            $deposit = round((float) ($data['deposit'] ?? $data['deposit_amount'] ?? 0), 2);
            $paid = round((float) ($data['paid_amount'] ?? $data['payment_amount'] ?? $deposit), 2);
            if ($paid > $charges['total'] + 0.009) {
                $paid = $charges['total'];
            }

            $status = (string) ($data['status'] ?? $data['booking_status'] ?? 'Pending');
            if (! in_array($status, self::STATUSES, true)) {
                $status = 'Pending';
            }

            $booking = Booking::query()->create([
                'booking_number' => $data['booking_number'] ?? $this->nextBookingNumber(),
                'customer_id' => $customerId,
                'booking_date' => $bookingDate,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'subtotal' => $charges['subtotal'],
                'discount' => $charges['discount'],
                'deposit' => $deposit,
                'estimated_amount' => $charges['total'],
                'paid_amount' => $paid,
                'payment_status' => $this->paymentStatus($paid, $charges['total']),
                'status' => $status,
                'rental_id' => null,
                'notes' => $data['notes'] ?? null,
                'branch_id' => $data['branch_id'] ?? null,
            ]);

            foreach ($charges['line_items'] as $line) {
                BookingItem::query()->create([
                    'booking_id' => $booking->id,
                    'product_id' => $line['product_id'],
                    'quantity' => $line['quantity'],
                    'rental_rate' => $line['rental_rate'],
                    'rental_days' => $line['rental_days'],
                    'subtotal' => $line['subtotal'],
                ]);
            }

            return $booking->fresh(['customer', 'items.product.category', 'rental']);
        });
    }

    public function update(Booking $booking, array $data): Booking
    {
        return DB::transaction(function () use ($booking, $data) {
            $booking = Booking::query()->lockForUpdate()->with('items')->findOrFail($booking->id);

            if (in_array($booking->status, ['Completed', 'Cancelled', 'Rejected'], true) && empty($data['force'])) {
                throw ValidationException::withMessages([
                    'status' => ['This booking can no longer be edited.'],
                ]);
            }

            if ($booking->rental_id) {
                throw ValidationException::withMessages([
                    'status' => ['This booking has already been converted to a rental.'],
                ]);
            }

            $customerId = (int) ($data['customer_id'] ?? $booking->customer_id);
            $this->assertCustomer($customerId);

            $startDate = (string) ($data['start_date'] ?? $booking->start_date->toDateString());
            $endDate = (string) ($data['end_date'] ?? $booking->end_date->toDateString());

            if (Carbon::parse($endDate)->lt(Carbon::parse($startDate))) {
                throw ValidationException::withMessages([
                    'end_date' => ['End date must be on or after the start date.'],
                ]);
            }

            $items = $this->normalizeItems($data);
            if ($items === []) {
                $items = $booking->items->map(fn (BookingItem $i) => [
                    'product_id' => (int) $i->product_id,
                    'quantity' => (int) $i->quantity,
                    'rental_rate' => (float) $i->rental_rate,
                ])->all();
            }

            // Exclude self from availability so edits don't double-count.
            $this->assertAvailability($items, $startDate, $endDate, $booking->id);

            $discount = (float) ($data['discount'] ?? $booking->discount ?? 0);
            $charges = $this->calculateCharges($items, $startDate, $endDate, $discount);
            $deposit = array_key_exists('deposit', $data) || array_key_exists('deposit_amount', $data)
                ? round((float) ($data['deposit'] ?? $data['deposit_amount'] ?? 0), 2)
                : (float) $booking->deposit;

            $paid = array_key_exists('paid_amount', $data) || array_key_exists('payment_amount', $data)
                ? round((float) ($data['paid_amount'] ?? $data['payment_amount'] ?? 0), 2)
                : (float) ($booking->paid_amount ?? 0);

            $status = (string) ($data['status'] ?? $data['booking_status'] ?? $booking->status);
            if (! in_array($status, self::STATUSES, true)) {
                $status = $booking->status;
            }

            $booking->update([
                'customer_id' => $customerId,
                'booking_date' => $data['booking_date'] ?? $booking->booking_date,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'subtotal' => $charges['subtotal'],
                'discount' => $charges['discount'],
                'deposit' => $deposit,
                'estimated_amount' => $charges['total'],
                'paid_amount' => $paid,
                'payment_status' => $this->paymentStatus($paid, $charges['total']),
                'status' => $status,
                'notes' => array_key_exists('notes', $data) ? $data['notes'] : $booking->notes,
                'branch_id' => array_key_exists('branch_id', $data) ? $data['branch_id'] : $booking->branch_id,
            ]);

            $booking->items()->delete();
            foreach ($charges['line_items'] as $line) {
                BookingItem::query()->create([
                    'booking_id' => $booking->id,
                    'product_id' => $line['product_id'],
                    'quantity' => $line['quantity'],
                    'rental_rate' => $line['rental_rate'],
                    'rental_days' => $line['rental_days'],
                    'subtotal' => $line['subtotal'],
                ]);
            }

            return $booking->fresh(['customer', 'items.product.category', 'rental']);
        });
    }

    public function delete(Booking $booking): void
    {
        if ($booking->rental_id) {
            throw ValidationException::withMessages([
                'booking' => ['Cannot delete a booking that was converted to a rental. Cancel it instead.'],
            ]);
        }

        $booking->delete();
    }

    public function updateStatus(Booking $booking, string $status): Booking
    {
        $status = trim($status);
        if (! in_array($status, self::STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => ['Invalid booking status.'],
            ]);
        }

        $from = $booking->status;
        $allowed = self::TRANSITIONS[$from] ?? [];

        if ($from === $status) {
            return $booking->fresh(['customer', 'items.product.category', 'rental']);
        }

        if (! in_array($status, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => ["Cannot change status from {$from} to {$status}."],
            ]);
        }

        if ($booking->rental_id && $status !== 'Completed') {
            throw ValidationException::withMessages([
                'status' => ['This booking is linked to a rental and cannot be changed that way.'],
            ]);
        }

        $booking->update(['status' => $status]);

        return $booking->fresh(['customer', 'items.product.category', 'rental']);
    }

    /**
     * Convert a confirmed/active booking into a rental atomically.
     *
     * @throws ValidationException|Throwable
     */
    public function convertToRental(Booking $booking, array $overrides = []): array
    {
        return DB::transaction(function () use ($booking, $overrides) {
            $booking = Booking::query()->lockForUpdate()->with(['items', 'customer'])->findOrFail($booking->id);

            if ($booking->rental_id) {
                throw ValidationException::withMessages([
                    'booking' => ['This booking has already been converted to a rental.'],
                ]);
            }

            if (! in_array($booking->status, ['Confirmed', 'Active'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['Only Confirmed or Active bookings can be converted to a rental.'],
                ]);
            }

            $items = $booking->items->map(fn (BookingItem $i) => [
                'product_id' => (int) $i->product_id,
                'quantity' => (int) $i->quantity,
                'rental_rate' => (float) $i->rental_rate,
            ])->all();

            if ($items === []) {
                throw ValidationException::withMessages([
                    'items' => ['Booking has no items to convert.'],
                ]);
            }

            $startDate = $overrides['start_date'] ?? $booking->start_date->toDateString();
            $endDate = $overrides['expected_return_date'] ?? $overrides['end_date'] ?? $booking->end_date->toDateString();

            // Re-check availability excluding this booking (it will become the rental).
            $this->assertAvailability($items, $startDate, $endDate, $booking->id);

            $rentalPayload = [
                'customer_id' => $booking->customer_id,
                'start_date' => $startDate,
                'expected_return_date' => $endDate,
                'items' => $items,
                'discount' => (float) ($booking->discount ?? 0),
                'deposit' => (float) $booking->deposit,
                'payment_amount' => (float) ($booking->paid_amount ?? $booking->deposit ?? 0),
                'payment_method' => $overrides['payment_method'] ?? 'Cash',
                'status' => $overrides['rental_status'] ?? 'Confirmed',
                'notes' => trim(($booking->notes ? $booking->notes.' | ' : '').'Converted from '.$booking->booking_number),
                'exclude_booking_id' => $booking->id,
                'branch_id' => $booking->branch_id,
            ];

            $rental = $this->rentals->create($rentalPayload);

            $booking->update([
                'rental_id' => $rental->id,
                'status' => 'Completed',
            ]);

            return [
                'booking' => $booking->fresh(['customer', 'items.product.category', 'rental']),
                'rental' => $rental,
            ];
        });
    }

    public function transform(Booking $booking): array
    {
        $booking->loadMissing(['customer', 'items.product.category', 'rental']);

        $first = $booking->items->first();
        $product = $first?->product;
        $customer = $booking->customer;
        $days = $first?->rental_days
            ?? $this->bookingDays(
                (string) optional($booking->start_date)?->toDateString(),
                (string) optional($booking->end_date)?->toDateString()
            );

        $total = (float) $booking->estimated_amount;
        $paid = (float) ($booking->paid_amount ?? 0);
        $balance = max(0, $total - $paid);

        return [
            'id' => $booking->id,
            'booking_number' => $booking->booking_number,
            'customer_id' => $booking->customer_id,
            'customer' => $customer ? [
                'id' => $customer->id,
                'name' => $customer->name,
                'customer_code' => $customer->customer_code,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'address' => $customer->address,
            ] : null,
            'booking_date' => optional($booking->booking_date)?->toDateString(),
            'start_date' => optional($booking->start_date)?->toDateString(),
            'end_date' => optional($booking->end_date)?->toDateString(),
            'subtotal' => (float) ($booking->subtotal ?? $total),
            'discount' => (float) ($booking->discount ?? 0),
            'deposit' => (float) $booking->deposit,
            'deposit_amount' => (float) $booking->deposit,
            'estimated_amount' => $total,
            'total' => $total,
            'total_amount' => $total,
            'paid_amount' => $paid,
            'balance_amount' => $balance,
            'balance' => $balance,
            'payment_status' => $booking->payment_status ?? $this->paymentStatus($paid, $total),
            'status' => $booking->status,
            'booking_status' => $booking->status,
            'rental_id' => $booking->rental_id,
            'notes' => $booking->notes,
            'branch_id' => $booking->branch_id,
            'rental_days' => $days,
            'items' => $booking->items->map(fn (BookingItem $item) => [
                'id' => $item->id,
                'booking_id' => $item->booking_id,
                'product_id' => $item->product_id,
                'quantity' => (int) $item->quantity,
                'rental_rate' => (float) $item->rental_rate,
                'rental_days' => (int) ($item->rental_days ?? $days),
                'subtotal' => (float) ($item->subtotal ?? 0),
                'total' => (float) ($item->subtotal ?? 0),
                'product' => $item->product ? [
                    'id' => $item->product->id,
                    'serial_number' => $item->product->serial_number,
                    'name' => $item->product->name,
                    'image' => $item->product->image,
                    'category' => $item->product->category?->name,
                    'category_id' => $item->product->category_id,
                ] : null,
            ])->values()->all(),
            'product_id' => $first?->product_id,
            'quantity' => $first ? (int) $first->quantity : 0,
            'rental_rate' => $first ? (float) $first->rental_rate : 0,
            'product_name' => $product?->name,
            'product_serial_number' => $product?->serial_number,
            'product_image' => $product?->image,
            'product_category' => $product?->category?->name,
            'customer_name' => $customer?->name,
            'customer_phone' => $customer?->phone,
            'customer_email' => $customer?->email,
            'customer_address' => $customer?->address,
            'created_at' => optional($booking->created_at)?->toIso8601String(),
            'updated_at' => optional($booking->updated_at)?->toIso8601String(),
        ];
    }
}
