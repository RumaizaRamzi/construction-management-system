<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SalePayment;
use App\Models\StockMovement;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class SaleService
{
    public const STOCK_AFFECTING_STATUSES = ['Pending', 'Completed'];

    public function __construct(private readonly SettingService $settings)
    {
    }

    public function paymentStatus(float $paid, float $total, ?string $saleDate = null, ?string $saleStatus = null): string
    {
        $paid = round($paid, 2);
        $total = round($total, 2);

        if (in_array($saleStatus, ['Cancelled', 'Refunded'], true)) {
            return $saleStatus === 'Refunded' ? 'Refunded' : 'Pending';
        }

        if ($paid <= 0 && $total <= 0) {
            return 'Paid';
        }

        if ($paid >= $total && $total > 0) {
            return 'Paid';
        }

        if ($paid <= 0) {
            $isPastDue = $saleDate
                && Carbon::parse($saleDate)->startOfDay()->lt(Carbon::today())
                && ! in_array($saleStatus, ['Cancelled', 'Refunded'], true);

            return $isPastDue ? 'Overdue' : 'Pending';
        }

        if ($paid < $total) {
            $isPastDue = $saleDate
                && Carbon::parse($saleDate)->startOfDay()->lt(Carbon::today())
                && ! in_array($saleStatus, ['Cancelled', 'Refunded'], true);

            return $isPastDue ? 'Overdue' : 'Partial';
        }

        return 'Paid';
    }

    /**
     * Next invoice number as {invoice_prefix}{year}-NNN using the prefix configured in Settings.
     */
    public function nextInvoiceNumber(): string
    {
        $configured = trim((string) $this->settings->get('invoice_prefix', 'INV-'));
        $prefix = ($configured === '' ? 'INV-' : $configured).Carbon::now()->year.'-';
        $pattern = '/^'.preg_quote($prefix, '/').'(\d+)$/';

        $max = 0;
        foreach (Sale::query()->where('invoice_number', 'like', $prefix.'%')->pluck('invoice_number') as $number) {
            if (preg_match($pattern, (string) $number, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        do {
            $max++;
            $candidate = $prefix.str_pad((string) $max, 3, '0', STR_PAD_LEFT);
        } while (Sale::query()->where('invoice_number', $candidate)->exists());

        return $candidate;
    }

    /**
     * Tax rate implied by a saved sale, so edits keep the rate the sale was created with.
     */
    private function effectiveTaxRate(Sale $sale): float
    {
        $taxable = max(0, (float) $sale->subtotal - (float) $sale->discount);

        return $taxable > 0 ? round(((float) $sale->tax / $taxable) * 100, 6) : 0.0;
    }

    private function recordPayment(Sale $sale, float $amount, array $data, ?string $defaultNote = null): void
    {
        if ($amount <= 0) {
            return;
        }

        SalePayment::query()->create([
            'sale_id' => $sale->id,
            'payment_date' => $data['payment_date'] ?? Carbon::today()->toDateString(),
            'amount' => round($amount, 2),
            'payment_method' => $data['payment_method'] ?? $sale->payment_method,
            'reference' => $data['reference'] ?? null,
            'notes' => $data['payment_notes'] ?? $defaultNote,
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $rawItems
     * @return array<int, array{product_id:int, quantity:int, unit_price:float, discount:float}>
     */
    public function normalizeItems(array $rawItems): array
    {
        $normalized = [];

        foreach ($rawItems as $row) {
            $productId = (int) ($row['product_id'] ?? $row['productId'] ?? 0);
            $qty = (int) ($row['quantity'] ?? 0);
            $unitPrice = round((float) ($row['unit_price'] ?? $row['unitPrice'] ?? 0), 2);
            $discount = round((float) ($row['discount'] ?? 0), 2);

            if ($productId <= 0) {
                continue;
            }

            $normalized[] = [
                'product_id' => $productId,
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'discount' => $discount,
            ];
        }

        return $normalized;
    }

    /**
     * Backend-authoritative totals. Does not trust client line totals.
     *
     * @param  array<int, array{product_id:int, quantity:int, unit_price:float, discount:float}>  $items
     * @return array{subtotal:float, item_discount:float, discount:float, tax:float, total:float, line_items:array}
     */
    public function calculateTotals(array $items, float $orderDiscount = 0, ?float $taxRate = null, ?float $taxOverride = null): array
    {
        $subtotal = 0.0;
        $itemDiscount = 0.0;
        $lineItems = [];

        foreach ($items as $row) {
            $qty = max(0, (int) $row['quantity']);
            $unit = round((float) $row['unit_price'], 2);
            $lineDiscount = round((float) ($row['discount'] ?? 0), 2);
            $lineGross = round($qty * $unit, 2);
            if ($lineDiscount > $lineGross) {
                throw ValidationException::withMessages([
                    'items' => ['Item discount cannot exceed the line total.'],
                ]);
            }
            $lineNet = round($lineGross - $lineDiscount, 2);
            $subtotal += $lineGross;
            $itemDiscount += $lineDiscount;

            $lineItems[] = [
                'product_id' => (int) $row['product_id'],
                'quantity' => $qty,
                'unit_price' => $unit,
                'discount' => $lineDiscount,
                'subtotal' => $lineNet,
            ];
        }

        $orderDiscount = max(0, round($orderDiscount, 2));
        $discount = round($itemDiscount + $orderDiscount, 2);
        $taxable = max(0, round($subtotal - $discount, 2));

        if ($taxOverride !== null) {
            $tax = max(0, round($taxOverride, 2));
        } elseif ($taxRate !== null) {
            $tax = max(0, round($taxable * (max(0, $taxRate) / 100), 2));
        } else {
            $tax = 0.0;
        }

        $total = round($taxable + $tax, 2);

        return [
            'subtotal' => round($subtotal, 2),
            'item_discount' => round($itemDiscount, 2),
            'discount' => $discount,
            'tax' => $tax,
            'total' => $total,
            'line_items' => $lineItems,
        ];
    }

    public function assertCustomerActive(int $customerId): Customer
    {
        $customer = Customer::query()->find($customerId);
        if (! $customer) {
            throw ValidationException::withMessages([
                'customer_id' => ['The selected customer is invalid.'],
            ]);
        }

        if (strcasecmp((string) $customer->status, 'Inactive') === 0) {
            throw ValidationException::withMessages([
                'customer_id' => ['This customer is inactive and cannot be used for sales.'],
            ]);
        }

        return $customer;
    }

    /**
     * @param  array<int, array{product_id:int, quantity:int, unit_price?:float, discount?:float}>  $items
     * @param  array<int, int>  $creditByProduct  quantities already reserved by this sale (edit)
     */
    public function assertStockAvailable(array $items, array $creditByProduct = []): void
    {
        $needed = [];
        foreach ($items as $row) {
            $pid = (int) $row['product_id'];
            $needed[$pid] = ($needed[$pid] ?? 0) + (int) $row['quantity'];
        }

        foreach ($needed as $productId => $qty) {
            /** @var Product|null $product */
            $product = Product::query()->lockForUpdate()->find($productId);
            if (! $product) {
                throw ValidationException::withMessages([
                    'items' => ['One or more products could not be found.'],
                ]);
            }

            if (strcasecmp((string) $product->status, 'Inactive') === 0) {
                throw ValidationException::withMessages([
                    'items' => ["{$product->name} is inactive and cannot be sold."],
                ]);
            }

            if (strcasecmp((string) $product->status, 'Maintenance') === 0) {
                throw ValidationException::withMessages([
                    'items' => ["{$product->name} is under maintenance and cannot be sold."],
                ]);
            }

            if ($qty <= 0) {
                throw ValidationException::withMessages([
                    'items' => ['Quantity must be greater than zero.'],
                ]);
            }

            $credit = (int) ($creditByProduct[$productId] ?? 0);

            if ($credit === 0 && ! $product->isSellable()) {
                throw ValidationException::withMessages([
                    'items' => [$product->listing_type === Product::LISTING_NONE
                        ? "{$product->name} is not listed yet. List it for sale before selling it."
                        : "{$product->name} is listed for rent only. Use \"Transfer to Sale\" before selling it."],
                ]);
            }
            $available = (int) $product->available_quantity + $credit;

            if ($qty > $available) {
                $unitWord = $available === 1 ? 'unit' : 'units';
                $verb = $available === 1 ? 'is' : 'are';
                throw ValidationException::withMessages([
                    'items' => [
                        "Only {$available} {$unitWord} of {$product->name} {$verb} available in stock.",
                    ],
                    'stock' => [
                        "Only {$available} {$unitWord} of {$product->name} {$verb} available in stock.",
                    ],
                ]);
            }

            // Fill missing unit prices from catalog when client omits them
            // (handled by caller via defaults).
        }
    }

    /**
     * Deduct available stock for a sale (does not change total quantity — sold is derived).
     */
    public function deductStock(Product $product, int $quantity, Sale $sale, string $movementType = StockMovement::TYPE_SALE): void
    {
        $qty = max(0, $quantity);
        if ($qty <= 0) {
            return;
        }

        $previous = (int) $product->available_quantity;
        if ($qty > $previous) {
            throw ValidationException::withMessages([
                'stock' => [
                    "Insufficient stock for {$product->name}. Available: {$previous}.",
                ],
            ]);
        }

        $product->available_quantity = $previous - $qty;
        $this->syncProductStatus($product);
        $product->save();

        $this->recordMovement(
            $product,
            $movementType,
            -$qty,
            $previous,
            (int) $product->available_quantity,
            $sale,
            'Sale '.$sale->invoice_number
        );
    }

    public function restoreStock(Product $product, int $quantity, Sale $sale, string $movementType = StockMovement::TYPE_SALE_CANCEL): void
    {
        $qty = max(0, $quantity);
        if ($qty <= 0) {
            return;
        }

        $previous = (int) $product->available_quantity;
        $maxAvailable = max(0, (int) $product->quantity - (int) $product->rented_quantity);
        $product->available_quantity = min($maxAvailable, $previous + $qty);
        $this->syncProductStatus($product);
        $product->save();

        $this->recordMovement(
            $product,
            $movementType,
            $qty,
            $previous,
            (int) $product->available_quantity,
            $sale,
            'Sale '.$sale->invoice_number.' stock restored'
        );
    }

    public function syncProductStatus(Product $product): void
    {
        if (strcasecmp((string) $product->status, 'Maintenance') === 0) {
            return;
        }

        if ((int) $product->available_quantity > 0) {
            $product->status = 'Available';
        } elseif ((int) $product->rented_quantity > 0) {
            $product->status = 'Rented';
        }
    }

    public function recordMovement(
        Product $product,
        string $type,
        int $signedQuantity,
        int $previous,
        int $new,
        Sale $sale,
        ?string $reason = null
    ): void {
        StockMovement::query()->create([
            'product_id' => $product->id,
            'movement_type' => $type,
            'quantity' => $signedQuantity,
            'previous_quantity' => $previous,
            'new_quantity' => $new,
            'reference_type' => Sale::class,
            'reference_id' => $sale->id,
            'reason' => $reason,
            'user_id' => Auth::id(),
        ]);
    }

    public function saleAffectsInventory(?string $status): bool
    {
        return in_array($status, self::STOCK_AFFECTING_STATUSES, true);
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function create(array $data): Sale
    {
        return DB::transaction(function () use ($data) {
            $customerId = (int) ($data['customer_id'] ?? 0);
            $this->assertCustomerActive($customerId);

            $items = $this->normalizeItems($data['items'] ?? []);
            if ($items === []) {
                throw ValidationException::withMessages([
                    'items' => ['Add at least one product.'],
                ]);
            }

            foreach ($items as $i => $row) {
                if ($row['quantity'] <= 0) {
                    throw ValidationException::withMessages([
                        'items' => ['Quantity must be greater than zero.'],
                    ]);
                }
                if ($row['unit_price'] < 0 || $row['discount'] < 0) {
                    throw ValidationException::withMessages([
                        'items' => ['Price and discount cannot be negative.'],
                    ]);
                }

                // Default unit price from catalog when omitted / zero and product has sale_price
                if ($row['unit_price'] <= 0) {
                    $product = Product::query()->find($row['product_id']);
                    if ($product && (float) $product->sale_price > 0) {
                        $items[$i]['unit_price'] = round((float) $product->sale_price, 2);
                    }
                }
            }

            $saleStatus = (string) ($data['sale_status'] ?? 'Completed');
            if (! in_array($saleStatus, ['Pending', 'Completed', 'Cancelled', 'Refunded'], true)) {
                $saleStatus = 'Completed';
            }

            if ($this->saleAffectsInventory($saleStatus)) {
                $this->assertStockAvailable($items);
            }

            $orderDiscount = max(0, (float) ($data['discount'] ?? 0));

            $taxRate = array_key_exists('tax_rate', $data) && $data['tax_rate'] !== null ? (float) $data['tax_rate'] : null;
            $taxOverride = array_key_exists('tax', $data) && $taxRate === null
                ? (float) $data['tax']
                : null;
            if ($taxRate === null && $taxOverride === null) {
                $taxRate = max(0, (float) $this->settings->get('tax_rate', 0));
            }

            $charges = $this->calculateTotals($items, $orderDiscount, $taxRate, $taxOverride);

            $paid = round((float) ($data['paid_amount'] ?? $data['amount_paid'] ?? $data['payment_amount'] ?? 0), 2);
            if ($paid > $charges['total'] + 0.0001) {
                throw ValidationException::withMessages([
                    'paid_amount' => ['Paid amount cannot exceed the sale total.'],
                ]);
            }

            $saleDate = (string) ($data['sale_date'] ?? $data['date'] ?? Carbon::today()->toDateString());
            $balance = round(max(0, $charges['total'] - $paid), 2);
            $paymentStatus = $this->paymentStatus($paid, $charges['total'], $saleDate, $saleStatus);

            $sale = Sale::query()->create([
                'invoice_number' => $data['invoice_number'] ?? $this->nextInvoiceNumber(),
                'customer_id' => $customerId,
                'sale_date' => $saleDate,
                'subtotal' => $charges['subtotal'],
                'discount' => $charges['discount'],
                'tax' => $charges['tax'],
                'total_amount' => $charges['total'],
                'paid_amount' => $paid,
                'balance' => $balance,
                'payment_status' => $paymentStatus,
                'payment_method' => $data['payment_method'] ?? null,
                'payment_date' => $data['payment_date'] ?? ($paid > 0 ? $saleDate : null),
                'sale_status' => $saleStatus,
                'notes' => $data['notes'] ?? null,
                'branch_id' => $data['branch_id'] ?? null,
            ]);

            foreach ($charges['line_items'] as $line) {
                SaleItem::query()->create([
                    'sale_id' => $sale->id,
                    'product_id' => $line['product_id'],
                    'quantity' => $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'discount' => $line['discount'],
                    'subtotal' => $line['subtotal'],
                ]);
            }

            if ($this->saleAffectsInventory($saleStatus)) {
                foreach ($charges['line_items'] as $line) {
                    $product = Product::query()->lockForUpdate()->find($line['product_id']);
                    if ($product) {
                        $this->deductStock($product, (int) $line['quantity'], $sale, StockMovement::TYPE_SALE);
                    }
                }
            }

            $this->recordPayment($sale, $paid, [
                'payment_date' => $sale->payment_date?->toDateString() ?? $saleDate,
                'payment_method' => $data['payment_method'] ?? null,
            ], 'Payment at time of sale');

            return $sale->fresh(['customer', 'items.product.category', 'payments']);
        });
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function update(Sale $sale, array $data): Sale
    {
        return DB::transaction(function () use ($sale, $data) {
            $sale = Sale::query()->lockForUpdate()->with('items')->findOrFail($sale->id);

            if (in_array($sale->sale_status, ['Cancelled', 'Refunded'], true)) {
                throw ValidationException::withMessages([
                    'sale_status' => ['Cancelled or refunded sales cannot be edited.'],
                ]);
            }

            $oldStatus = $sale->sale_status;
            $oldItems = $sale->items->map(fn (SaleItem $i) => [
                'product_id' => (int) $i->product_id,
                'quantity' => (int) $i->quantity,
            ])->all();

            $oldByProduct = [];
            foreach ($oldItems as $row) {
                $oldByProduct[$row['product_id']] = ($oldByProduct[$row['product_id']] ?? 0) + $row['quantity'];
            }

            if (array_key_exists('customer_id', $data)) {
                $this->assertCustomerActive((int) $data['customer_id']);
                $sale->customer_id = (int) $data['customer_id'];
            }

            $items = array_key_exists('items', $data)
                ? $this->normalizeItems($data['items'] ?? [])
                : $sale->items->map(fn (SaleItem $i) => [
                    'product_id' => (int) $i->product_id,
                    'quantity' => (int) $i->quantity,
                    'unit_price' => (float) $i->unit_price,
                    'discount' => (float) $i->discount,
                ])->all();

            if ($items === []) {
                throw ValidationException::withMessages([
                    'items' => ['Add at least one product.'],
                ]);
            }

            foreach ($items as $i => $row) {
                if ($row['quantity'] <= 0) {
                    throw ValidationException::withMessages([
                        'items' => ['Quantity must be greater than zero.'],
                    ]);
                }
                if ($row['unit_price'] <= 0) {
                    $product = Product::query()->find($row['product_id']);
                    if ($product && (float) $product->sale_price > 0) {
                        $items[$i]['unit_price'] = round((float) $product->sale_price, 2);
                    }
                }
            }

            $saleStatus = array_key_exists('sale_status', $data)
                ? (string) $data['sale_status']
                : $sale->sale_status;
            if (! in_array($saleStatus, ['Pending', 'Completed', 'Cancelled', 'Refunded'], true)) {
                $saleStatus = $sale->sale_status;
            }

            // Cancelling via update → restore stock
            if (in_array($saleStatus, ['Cancelled', 'Refunded'], true) && $this->saleAffectsInventory($oldStatus)) {
                foreach ($oldByProduct as $productId => $qty) {
                    $product = Product::query()->lockForUpdate()->find($productId);
                    if ($product) {
                        $this->restoreStock($product, (int) $qty, $sale, StockMovement::TYPE_SALE_CANCEL);
                    }
                }

                $sale->sale_status = $saleStatus;
                $sale->payment_status = $saleStatus === 'Refunded' ? 'Refunded' : $sale->payment_status;
                $sale->save();

                return $sale->fresh(['customer', 'items.product.category']);
            }

            $credit = $this->saleAffectsInventory($oldStatus) ? $oldByProduct : [];

            if ($this->saleAffectsInventory($saleStatus)) {
                $this->assertStockAvailable($items, $credit);
            }

            $orderDiscount = array_key_exists('discount', $data)
                ? max(0, (float) $data['discount'])
                : max(0, (float) $sale->discount - array_sum(array_column(
                    $sale->items->map(fn (SaleItem $i) => ['discount' => (float) $i->discount])->all(),
                    'discount'
                )));

            $taxRate = array_key_exists('tax_rate', $data) && $data['tax_rate'] !== null ? (float) $data['tax_rate'] : null;
            $taxOverride = null;
            if (array_key_exists('tax', $data) && $taxRate === null) {
                $taxOverride = (float) $data['tax'];
            } elseif ($taxRate === null && ! array_key_exists('discount', $data) && ! array_key_exists('items', $data)) {
                $taxOverride = (float) $sale->tax;
            } elseif ($taxRate === null) {
                // Never pick up the current Settings rate on edit: keep the sale's own rate.
                $taxRate = $this->effectiveTaxRate($sale);
            }

            $charges = $this->calculateTotals($items, $orderDiscount, $taxRate, $taxOverride);

            $paid = array_key_exists('paid_amount', $data) || array_key_exists('amount_paid', $data) || array_key_exists('payment_amount', $data)
                ? round((float) ($data['paid_amount'] ?? $data['amount_paid'] ?? $data['payment_amount'] ?? 0), 2)
                : (float) $sale->paid_amount;

            if ($paid > $charges['total'] + 0.0001) {
                throw ValidationException::withMessages([
                    'paid_amount' => ['Paid amount cannot exceed the sale total.'],
                ]);
            }

            $oldPaid = round((float) $sale->paid_amount, 2);
            $recorded = round((float) $sale->payments()->sum('amount'), 2);
            if ($paid + 0.0001 < $recorded) {
                throw ValidationException::withMessages([
                    'paid_amount' => ['Paid amount cannot be less than the recorded payments ('.number_format($recorded, 2).').'],
                ]);
            }

            $saleDate = (string) ($data['sale_date'] ?? $data['date'] ?? optional($sale->sale_date)?->toDateString());

            // Inventory delta
            if ($this->saleAffectsInventory($oldStatus)) {
                foreach ($oldByProduct as $productId => $qty) {
                    $product = Product::query()->lockForUpdate()->find($productId);
                    if ($product) {
                        $this->restoreStock($product, (int) $qty, $sale, StockMovement::TYPE_SALE_ADJUST);
                    }
                }
            }

            if ($this->saleAffectsInventory($saleStatus)) {
                foreach ($charges['line_items'] as $line) {
                    $product = Product::query()->lockForUpdate()->find($line['product_id']);
                    if ($product) {
                        $this->deductStock($product, (int) $line['quantity'], $sale, StockMovement::TYPE_SALE_ADJUST);
                    }
                }
            }

            $sale->items()->delete();
            foreach ($charges['line_items'] as $line) {
                SaleItem::query()->create([
                    'sale_id' => $sale->id,
                    'product_id' => $line['product_id'],
                    'quantity' => $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'discount' => $line['discount'],
                    'subtotal' => $line['subtotal'],
                ]);
            }

            if (array_key_exists('invoice_number', $data) && $data['invoice_number']) {
                $sale->invoice_number = $data['invoice_number'];
            }

            $sale->sale_date = $saleDate;
            $sale->subtotal = $charges['subtotal'];
            $sale->discount = $charges['discount'];
            $sale->tax = $charges['tax'];
            $sale->total_amount = $charges['total'];
            $sale->paid_amount = $paid;
            $sale->balance = round(max(0, $charges['total'] - $paid), 2);
            $sale->payment_status = $this->paymentStatus($paid, $charges['total'], $saleDate, $saleStatus);
            $sale->sale_status = $saleStatus;
            if (array_key_exists('payment_method', $data)) {
                $sale->payment_method = $data['payment_method'];
            }
            if (array_key_exists('payment_date', $data)) {
                $sale->payment_date = $data['payment_date'];
            }
            if (array_key_exists('notes', $data)) {
                $sale->notes = $data['notes'];
            }
            if (array_key_exists('branch_id', $data)) {
                $sale->branch_id = $data['branch_id'];
            }
            $sale->save();

            if ($paid > $oldPaid + 0.0001) {
                $this->recordPayment($sale, $paid - $oldPaid, [
                    'payment_date' => $data['payment_date'] ?? Carbon::today()->toDateString(),
                    'payment_method' => $data['payment_method'] ?? $sale->payment_method,
                ], 'Payment recorded via sale edit');
            }

            return $sale->fresh(['customer', 'items.product.category', 'payments']);
        });
    }

    /**
     * Cancel sale and restore stock (preserves financial history).
     *
     * @throws ValidationException|Throwable
     */
    public function cancel(Sale $sale): Sale
    {
        return DB::transaction(function () use ($sale) {
            $sale = Sale::query()->lockForUpdate()->with('items')->findOrFail($sale->id);

            if ($sale->sale_status === 'Cancelled') {
                throw ValidationException::withMessages([
                    'sale_status' => ['This sale is already cancelled.'],
                ]);
            }

            if ($this->saleAffectsInventory($sale->sale_status)) {
                foreach ($sale->items as $item) {
                    $product = Product::query()->lockForUpdate()->find($item->product_id);
                    if ($product) {
                        $this->restoreStock($product, (int) $item->quantity, $sale, StockMovement::TYPE_SALE_CANCEL);
                    }
                }
            }

            $sale->sale_status = 'Cancelled';
            $sale->save();

            return $sale->fresh(['customer', 'items.product.category']);
        });
    }

    /**
     * Record an additional payment against the sale (updates paid_amount on sales row).
     *
     * @throws ValidationException|Throwable
     */
    public function addPayment(Sale $sale, array $data): Sale
    {
        return DB::transaction(function () use ($sale, $data) {
            $sale = Sale::query()->lockForUpdate()->findOrFail($sale->id);

            if (in_array($sale->sale_status, ['Cancelled', 'Refunded'], true)) {
                throw ValidationException::withMessages([
                    'amount' => ['Cannot record payment on a cancelled or refunded sale.'],
                ]);
            }

            $amount = round((float) ($data['amount'] ?? 0), 2);
            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'amount' => ['Payment amount must be greater than zero.'],
                ]);
            }

            $newPaid = round((float) $sale->paid_amount + $amount, 2);
            $total = round((float) $sale->total_amount, 2);

            if ($newPaid > $total + 0.0001) {
                throw ValidationException::withMessages([
                    'amount' => ['Payment would exceed the remaining balance of '.number_format((float) $sale->balance, 2).'.'],
                ]);
            }

            $sale->paid_amount = $newPaid;
            $sale->balance = round(max(0, $total - $newPaid), 2);
            $sale->payment_status = $this->paymentStatus(
                $newPaid,
                $total,
                optional($sale->sale_date)?->toDateString(),
                $sale->sale_status
            );
            if (! empty($data['payment_method'])) {
                $sale->payment_method = $data['payment_method'];
            }
            $sale->payment_date = $data['payment_date'] ?? Carbon::today()->toDateString();
            $sale->save();

            $this->recordPayment($sale, $amount, [
                'payment_date' => $sale->payment_date?->toDateString(),
                'payment_method' => $data['payment_method'] ?? $sale->payment_method,
                'reference' => $data['reference'] ?? null,
                'payment_notes' => $data['notes'] ?? null,
            ]);

            return $sale->fresh(['customer', 'items.product.category', 'payments']);
        });
    }

    public function transform(Sale $sale): array
    {
        $sale->loadMissing(['customer', 'items.product.category', 'payments']);
        $payments = $sale->payments->map(fn (SalePayment $p) => [
            'id' => $p->id,
            'sale_id' => $p->sale_id,
            'payment_date' => optional($p->payment_date)?->toDateString(),
            'amount' => (float) $p->amount,
            'payment_method' => $p->payment_method,
            'reference' => $p->reference,
            'notes' => $p->notes,
        ])->values()->all();
        $recordedPaid = round((float) $sale->payments->sum('amount'), 2);

        $customer = $sale->customer;
        $items = $sale->items->map(function (SaleItem $item) {
            $product = $item->product;

            return [
                'id' => $item->id,
                'sale_id' => $item->sale_id,
                'product_id' => $item->product_id,
                'quantity' => (int) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'discount' => (float) $item->discount,
                'subtotal' => (float) $item->subtotal,
                'total' => (float) $item->subtotal,
                'product_name' => $product?->name,
                'serial_number' => $product?->serial_number,
                'product' => $product ? [
                    'id' => $product->id,
                    'serial_number' => $product->serial_number,
                    'name' => $product->name,
                    'image' => $product->image,
                    'category' => $product->category?->name,
                    'category_id' => $product->category_id,
                ] : null,
            ];
        })->values()->all();

        $productNames = collect($items)->pluck('product_name')->filter()->implode(', ');
        $tax = (float) $sale->tax;
        $subtotal = (float) $sale->subtotal;
        $discount = (float) $sale->discount;
        $itemDiscount = (float) $sale->items->sum('discount');
        $orderDiscount = max(0, round($discount - $itemDiscount, 2));
        $taxable = max(0, $subtotal - $discount);
        $taxRate = $taxable > 0 ? round(($tax / $taxable) * 100, 4) : 0;

        return [
            'id' => $sale->id,
            'invoice_number' => $sale->invoice_number,
            'customer_id' => $sale->customer_id,
            'customer' => $customer ? [
                'id' => $customer->id,
                'name' => $customer->name,
                'customer_code' => $customer->customer_code,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'address' => $customer->address,
            ] : null,
            'sale_date' => optional($sale->sale_date)?->toDateString(),
            'subtotal' => $subtotal,
            'discount' => $discount,
            'order_discount' => $orderDiscount,
            'item_discount' => $itemDiscount,
            'tax' => $tax,
            'tax_rate' => $taxRate,
            'total_amount' => (float) $sale->total_amount,
            'paid_amount' => (float) $sale->paid_amount,
            'balance' => (float) $sale->balance,
            'balance_amount' => (float) $sale->balance,
            'payment_status' => $sale->payment_status,
            'payment_method' => $sale->payment_method,
            'payment_date' => optional($sale->payment_date)?->toDateString(),
            'sale_status' => $sale->sale_status,
            'notes' => $sale->notes,
            'branch_id' => $sale->branch_id,
            'products' => $productNames,
            'quantity' => (int) $sale->items->sum('quantity'),
            'items' => $items,
            'payments' => $payments,
            'unrecorded_paid_amount' => round(max(0, (float) $sale->paid_amount - $recordedPaid), 2),
            'created_at' => optional($sale->created_at)?->toIso8601String(),
            'updated_at' => optional($sale->updated_at)?->toIso8601String(),
        ];
    }
}
