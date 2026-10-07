<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\BookingItem;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseService
{
    public function __construct(
        private readonly ProductService $products,
        private readonly StockMovementService $stock,
        private readonly ActivityLogService $logs,
    ) {
    }

    public function transform(Purchase $purchase, bool $withItems = true): array
    {
        $purchase->loadMissing(['supplier:id,name,supplier_code', 'creator:id,name', 'items.product:id,name,serial_number,listing_type,unit']);

        $data = [
            'id' => $purchase->id,
            'purchase_number' => $purchase->purchase_number,
            'supplier_id' => $purchase->supplier_id,
            'supplier_name' => $purchase->supplier?->name,
            'purchase_date' => $purchase->purchase_date?->toDateString(),
            'bill_number' => $purchase->bill_number,
            'notes' => $purchase->notes,
            'branch_id' => $purchase->branch_id,
            'total_amount' => (float) $purchase->total_amount,
            'payment_type' => $purchase->payment_type,
            'paid_amount' => (float) $purchase->paid_amount,
            'balance' => (float) $purchase->balance,
            'payment_status' => $purchase->payment_status,
            'status' => $purchase->status,
            'cancelled_at' => $purchase->cancelled_at?->toIso8601String(),
            'cancel_reason' => $purchase->cancel_reason,
            'created_by_name' => $purchase->creator?->name,
            'items_count' => $purchase->items->count(),
            'total_quantity' => (int) $purchase->items->sum('quantity'),
            'product_names' => $purchase->items->map(fn (PurchaseItem $i) => $i->product?->name)->filter()->values(),
            'created_at' => $purchase->created_at?->toIso8601String(),
        ];

        if ($withItems) {
            $data['items'] = $purchase->items->map(fn (PurchaseItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_name' => $item->product?->name,
                'serial_number' => $item->product?->serial_number,
                'unit' => $item->product?->unit,
                'product_listing_type' => $item->product?->listing_type,
                'is_new_product' => (bool) $item->is_new_product,
                'quantity' => (int) $item->quantity,
                'unit_cost' => (float) $item->unit_cost,
                'line_total' => (float) $item->line_total,
                'listing_type' => $item->listing_type,
                'sale_price' => $item->sale_price !== null ? (float) $item->sale_price : null,
                'rental_price' => $item->rental_price !== null ? (float) $item->rental_price : null,
            ])->values();
        }

        return $data;
    }

    public function create(array $data): Purchase
    {
        return DB::transaction(function () use ($data) {
            $supplier = $this->activeSupplier((int) $data['supplier_id']);

            $purchase = new Purchase([
                'purchase_number' => $this->nextNumber(),
                'supplier_id' => $supplier->id,
                'purchase_date' => $data['purchase_date'] ?? now()->toDateString(),
                'bill_number' => $this->text($data['bill_number'] ?? null),
                'notes' => $this->text($data['notes'] ?? null),
                'branch_id' => $data['branch_id'] ?? null,
                'status' => Purchase::STATUS_COMPLETED,
                'created_by' => Auth::id(),
            ]);
            $purchase->saveQuietly();

            $lines = $this->resolveLines($data['items'], $purchase, $supplier, []);
            $reason = $this->reason($purchase, $supplier);
            foreach ($lines as $line) {
                $this->increase($line['product'], $line['quantity'], StockMovementService::TYPE_PURCHASE, $purchase, $reason);
                $this->applyProductDetails($line);
                $this->storeItem($purchase, $line);
            }

            $this->applyPayment($purchase, $data, $lines);
            $purchase->saveQuietly();

            $fresh = $purchase->fresh(['supplier', 'items.product']);
            $this->logs->record(
                'created',
                'purchases',
                sprintf(
                    'Purchase %s recorded from %s: %d item(s), total %s',
                    $fresh->purchase_number,
                    $supplier->name,
                    $fresh->items->count(),
                    number_format((float) $fresh->total_amount, 2)
                ),
                $fresh,
                null,
                $this->snapshot($fresh)
            );

            return $fresh;
        });
    }

    public function update(Purchase $purchase, array $data): Purchase
    {
        return DB::transaction(function () use ($purchase, $data) {
            $purchase = Purchase::query()->lockForUpdate()->with(['items', 'supplier'])->findOrFail($purchase->id);
            if ($purchase->status === Purchase::STATUS_CANCELLED) {
                throw ValidationException::withMessages(['purchase' => ['A cancelled purchase cannot be edited.']]);
            }
            $before = $this->snapshot($purchase);

            $supplier = (int) $data['supplier_id'] === (int) $purchase->supplier_id
                ? $purchase->supplier
                : $this->activeSupplier((int) $data['supplier_id']);

            $purchase->fill([
                'supplier_id' => $supplier->id,
                'purchase_date' => $data['purchase_date'] ?? $purchase->purchase_date,
                'bill_number' => $this->text($data['bill_number'] ?? null),
                'notes' => $this->text($data['notes'] ?? null),
                'branch_id' => $data['branch_id'] ?? null,
            ]);

            $createdByPurchase = $purchase->items->where('is_new_product', true)->pluck('product_id')->all();
            $oldQty = $purchase->items->groupBy('product_id')->map(fn ($rows) => (int) $rows->sum('quantity'));

            $lines = $this->resolveLines($data['items'], $purchase, $supplier, $createdByPurchase);
            $newQty = collect($lines)->mapWithKeys(fn ($l) => [$l['product']->id => $l['quantity']]);
            $reason = $this->reason($purchase, $supplier, 'edited');

            foreach ($oldQty->keys()->merge($newQty->keys())->unique() as $productId) {
                $delta = (int) ($newQty[$productId] ?? 0) - (int) ($oldQty[$productId] ?? 0);
                if ($delta === 0) {
                    continue;
                }
                $product = Product::query()->lockForUpdate()->findOrFail($productId);
                if ($delta < 0) {
                    $this->assertCanRemove($product, -$delta, $purchase, 'items', 'reduce');
                    $this->decrease($product, -$delta, StockMovementService::TYPE_PURCHASE_ADJUST, $purchase, $reason);
                } else {
                    $this->increase($product, $delta, StockMovementService::TYPE_PURCHASE_ADJUST, $purchase, $reason);
                }
            }

            $purchase->items()->delete();
            foreach ($lines as $line) {
                $line['product'] = Product::query()->findOrFail($line['product']->id);
                $this->applyProductDetails($line);
                $this->storeItem($purchase, $line);
            }

            $this->applyPayment($purchase, $data, $lines);
            $purchase->saveQuietly();

            $fresh = $purchase->fresh(['supplier', 'items.product']);
            $this->logs->record(
                'updated',
                'purchases',
                sprintf('Purchase %s edited', $fresh->purchase_number),
                $fresh,
                $before,
                $this->snapshot($fresh)
            );

            return $fresh;
        });
    }

    public function cancel(Purchase $purchase, ?string $reason = null): Purchase
    {
        return DB::transaction(function () use ($purchase, $reason) {
            $purchase = Purchase::query()->lockForUpdate()->with(['items', 'supplier'])->findOrFail($purchase->id);
            if ($purchase->status === Purchase::STATUS_CANCELLED) {
                throw ValidationException::withMessages(['purchase' => ['This purchase is already cancelled.']]);
            }
            $before = $this->snapshot($purchase);
            $stockReason = $this->reason($purchase, $purchase->supplier, 'cancelled');

            $quantities = $purchase->items->groupBy('product_id')->map(fn ($rows) => (int) $rows->sum('quantity'));
            $products = [];
            foreach ($quantities as $productId => $qty) {
                $products[$productId] = Product::query()->lockForUpdate()->findOrFail($productId);
                $this->assertCanRemove($products[$productId], $qty, $purchase, 'purchase', 'cancel');
            }
            foreach ($quantities as $productId => $qty) {
                $this->decrease($products[$productId], $qty, StockMovementService::TYPE_PURCHASE_CANCEL, $purchase, $stockReason);
            }

            $purchase->status = Purchase::STATUS_CANCELLED;
            $purchase->cancelled_at = now();
            $purchase->cancel_reason = $this->text($reason);
            $purchase->saveQuietly();

            $fresh = $purchase->fresh(['supplier', 'items.product']);
            $this->logs->record(
                'cancelled',
                'purchases',
                sprintf('Purchase %s cancelled and its stock reversed%s', $fresh->purchase_number, $fresh->cancel_reason ? ' — '.$fresh->cancel_reason : ''),
                $fresh,
                $before,
                $this->snapshot($fresh)
            );

            return $fresh;
        });
    }

    /**
     * Reasons a purchase cannot be cancelled right now (empty when it can).
     *
     * @return list<string>
     */
    public function cancelBlockers(Purchase $purchase): array
    {
        if ($purchase->status === Purchase::STATUS_CANCELLED) {
            return ['This purchase is already cancelled.'];
        }
        $messages = [];
        foreach ($purchase->items()->get()->groupBy('product_id') as $productId => $rows) {
            $product = Product::query()->find($productId);
            if (! $product) {
                continue;
            }
            try {
                $this->assertCanRemove($product, (int) $rows->sum('quantity'), $purchase, 'purchase', 'cancel');
            } catch (ValidationException $e) {
                $messages = [...$messages, ...collect($e->errors())->flatten()->all()];
            }
        }

        return $messages;
    }

    public function supplierSummary(Supplier $supplier): array
    {
        $purchases = $supplier->purchases()->with(['items.product:id,name', 'supplier:id,name'])->orderByDesc('purchase_date')->orderByDesc('id')->get();
        $active = $purchases->where('status', Purchase::STATUS_COMPLETED);

        return [
            'purchases' => $purchases->map(fn (Purchase $p) => $this->transform($p, false))->values(),
            'purchase_totals' => [
                'count' => $active->count(),
                'total_amount' => round((float) $active->sum('total_amount'), 2),
                'paid_amount' => round((float) $active->sum('paid_amount'), 2),
                'outstanding' => round((float) $active->sum('balance'), 2),
            ],
        ];
    }

    public function activity(Purchase $purchase, ?User $user): array
    {
        if (! $user?->hasPermission('activity.view')) {
            return [];
        }

        return ActivityLog::query()
            ->where('subject_type', 'Purchase')
            ->where('subject_id', $purchase->id)
            ->latest('id')
            ->limit(50)
            ->get()
            ->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'user_name' => $log->user_name ?? 'System',
                'action' => $log->action,
                'description' => $log->description,
                'created_at' => $log->created_at?->toIso8601String(),
            ])
            ->all();
    }

    /**
     * Validate rows against current products and create any new products (with zero stock).
     *
     * @param  list<int>  $createdByPurchase  products first created by this purchase
     * @return list<array<string, mixed>>
     */
    private function resolveLines(array $items, Purchase $purchase, Supplier $supplier, array $createdByPurchase): array
    {
        $lines = [];
        $seen = [];
        foreach (array_values($items) as $index => $item) {
            $isNew = ($item['mode'] ?? 'existing') === 'new';
            $row = $index + 1;

            if ($isNew) {
                $listing = $item['listing_type'] ?? Product::LISTING_NONE;
                $product = $this->products->create([
                    'name' => $item['name'],
                    'serial_number' => $item['serial_number'],
                    'category_id' => $item['category_id'],
                    'supplier_id' => $supplier->id,
                    'branch_id' => $purchase->branch_id,
                    'quantity' => 0,
                    'purchase_price' => $item['unit_cost'],
                    'listing_type' => $listing,
                ]);
                $product = Product::query()->lockForUpdate()->findOrFail($product->id);
            } else {
                $product = Product::query()->lockForUpdate()->find($item['product_id'] ?? null);
                if (! $product) {
                    throw ValidationException::withMessages(["items.{$index}.product_id" => ["Row {$row}: select a valid product."]]);
                }
                if (isset($seen[$product->id])) {
                    throw ValidationException::withMessages([
                        "items.{$index}.product_id" => ["Row {$row}: {$product->name} is already on this purchase. Combine the quantities in one row."],
                    ]);
                }
                $listing = $item['listing_type'] ?? null;
            }
            $seen[$product->id] = true;

            $finalListing = $listing ?? $product->listing_type;
            $salePrice = $this->price($item, 'sale_price');
            $rentalPrice = $this->price($item, 'rental_price');

            $quantity = (int) $item['quantity'];
            $unitCost = round((float) $item['unit_cost'], 2);
            $lines[] = [
                'product' => $product,
                'is_new' => $isNew || in_array($product->id, $createdByPurchase, true),
                'quantity' => $quantity,
                'unit_cost' => $unitCost,
                'line_total' => round($quantity * $unitCost, 2),
                'listing_type' => $listing,
                'sale_price' => in_array($finalListing, [Product::LISTING_SALE, Product::LISTING_BOTH], true) ? $salePrice : null,
                'rental_price' => in_array($finalListing, [Product::LISTING_RENT, Product::LISTING_BOTH], true) ? $rentalPrice : null,
            ];
        }

        return $lines;
    }

    private function applyProductDetails(array $line): void
    {
        /** @var Product $product */
        $product = $line['product'];
        $product->purchase_price = $line['unit_cost'];
        if ($line['listing_type'] !== null) {
            $product->listing_type = $line['listing_type'];
        }
        if ($line['sale_price'] !== null) {
            $product->sale_price = $line['sale_price'];
        }
        if ($line['rental_price'] !== null) {
            $product->rental_price = $line['rental_price'];
        }
        $product->save();
    }

    private function storeItem(Purchase $purchase, array $line): void
    {
        $purchase->items()->create([
            'product_id' => $line['product']->id,
            'is_new_product' => $line['is_new'],
            'quantity' => $line['quantity'],
            'unit_cost' => $line['unit_cost'],
            'line_total' => $line['line_total'],
            'listing_type' => $line['listing_type'],
            'sale_price' => $line['sale_price'],
            'rental_price' => $line['rental_price'],
        ]);
    }

    private function increase(Product $product, int $qty, string $type, Purchase $purchase, string $reason): void
    {
        $previous = (int) $product->available_quantity;
        $product->quantity = (int) $product->quantity + $qty;
        $product->available_quantity = $previous + $qty;
        $this->stock->syncProductStatus($product);
        $product->save();
        $this->stock->record($product, $type, $qty, $previous, (int) $product->available_quantity, $purchase, $reason);
    }

    private function decrease(Product $product, int $qty, string $type, Purchase $purchase, string $reason): void
    {
        $previous = (int) $product->available_quantity;
        $product->quantity = max(0, (int) $product->quantity - $qty);
        $product->available_quantity = $previous - $qty;
        $this->stock->syncProductStatus($product);
        $product->save();
        $this->stock->record($product, $type, -$qty, $previous, (int) $product->available_quantity, $purchase, $reason);
    }

    /**
     * Stock is interchangeable, so bought units count as used when fewer than that many are still
     * in stock, or when removing them would leave too few for upcoming bookings.
     */
    private function assertCanRemove(Product $product, int $qty, Purchase $purchase, string $key, string $verb): void
    {
        $available = (int) $product->available_quantity;
        $action = $verb === 'cancel' ? 'cancel this purchase' : 'reduce this quantity';

        if ($available < $qty) {
            throw ValidationException::withMessages([$key => [sprintf(
                'Cannot %s: only %d of the %d unit(s) of %s from %s are still in stock. The rest have been sold, rented out or adjusted.',
                $action,
                $available,
                $qty,
                $product->name,
                $purchase->purchase_number
            )]]);
        }

        $booked = (int) BookingItem::query()
            ->where('product_id', $product->id)
            ->whereHas('booking', function ($q) {
                $q->whereIn('status', EquipmentAvailabilityService::BOOKING_BLOCKING)
                    ->whereDate('end_date', '>=', now()->toDateString())
                    ->where(fn ($q2) => $q2->whereNull('rental_id')->orWhere('rental_id', 0));
            })
            ->sum('quantity');
        if ($booked > $available - $qty) {
            throw ValidationException::withMessages([$key => [sprintf(
                'Cannot %s: %d unit(s) of %s are reserved on upcoming bookings, so these units are still needed.',
                $action,
                $booked,
                $product->name
            )]]);
        }
    }

    private function applyPayment(Purchase $purchase, array $data, array $lines): void
    {
        $total = round(collect($lines)->sum('line_total'), 2);
        $type = $data['payment_type'] ?? 'Credit';
        $paid = array_key_exists('paid_amount', $data) && $data['paid_amount'] !== null && $data['paid_amount'] !== ''
            ? round((float) $data['paid_amount'], 2)
            : ($type === 'Paid' ? $total : 0.0);

        if ($paid > $total) {
            throw ValidationException::withMessages([
                'paid_amount' => ['Amount paid cannot be more than the purchase total of '.number_format($total, 2).'.'],
            ]);
        }

        $purchase->total_amount = $total;
        $purchase->payment_type = $type;
        $purchase->paid_amount = $paid;
        $purchase->balance = round($total - $paid, 2);
        $purchase->payment_status = match (true) {
            $paid >= $total => 'Paid',
            $paid > 0 => 'Partial',
            default => 'Unpaid',
        };
    }

    private function snapshot(Purchase $purchase): array
    {
        $purchase->loadMissing('items.product:id,name');

        return [
            'purchase_number' => $purchase->purchase_number,
            'supplier_id' => $purchase->supplier_id,
            'purchase_date' => $purchase->purchase_date?->toDateString(),
            'bill_number' => $purchase->bill_number,
            'branch_id' => $purchase->branch_id,
            'total_amount' => (float) $purchase->total_amount,
            'payment_type' => $purchase->payment_type,
            'paid_amount' => (float) $purchase->paid_amount,
            'balance' => (float) $purchase->balance,
            'payment_status' => $purchase->payment_status,
            'status' => $purchase->status,
            'items' => $purchase->items->map(fn (PurchaseItem $i) => sprintf(
                '%s × %d @ %s%s',
                $i->product?->name ?? '#'.$i->product_id,
                $i->quantity,
                number_format((float) $i->unit_cost, 2),
                $i->listing_type ? ' ('.$i->listing_type.')' : ''
            ))->values()->all(),
        ];
    }

    private function reason(Purchase $purchase, Supplier $supplier, ?string $event = null): string
    {
        return sprintf(
            'Purchase %s%s from %s%s',
            $purchase->purchase_number,
            $event ? " {$event}" : '',
            $supplier->name,
            $purchase->bill_number ? " (Bill: {$purchase->bill_number})" : ''
        );
    }

    private function activeSupplier(int $id): Supplier
    {
        $supplier = Supplier::query()->find($id);
        if (! $supplier) {
            throw ValidationException::withMessages(['supplier_id' => ['Please select a valid supplier.']]);
        }
        if (strcasecmp((string) $supplier->status, 'Inactive') === 0) {
            throw ValidationException::withMessages(['supplier_id' => ["{$supplier->name} is inactive. Reactivate the supplier or choose another one."]]);
        }

        return $supplier;
    }

    private function price(array $item, string $key): ?float
    {
        return array_key_exists($key, $item) && $item[$key] !== null && $item[$key] !== ''
            ? round((float) $item[$key], 2)
            : null;
    }

    private function text(mixed $value): ?string
    {
        $value = is_string($value) ? trim($value) : $value;

        return $value === '' ? null : $value;
    }

    private function nextNumber(): string
    {
        $prefix = 'PUR-'.now()->year.'-';
        $latest = Purchase::query()->where('purchase_number', 'like', $prefix.'%')->orderByDesc('purchase_number')->value('purchase_number');
        $next = $latest && preg_match('/-(\d+)$/', $latest, $m) ? ((int) $m[1]) + 1 : 1;

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
