<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Purchase;
use App\Models\Rental;
use App\Models\Sale;
use App\Models\StockMovement;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockMovementService
{
    public const TYPE_PURCHASE = 'PURCHASE';

    public const TYPE_SALE = 'SALE';

    public const TYPE_SALE_CANCEL = 'SALE_CANCEL';

    public const TYPE_SALE_ADJUST = 'SALE_ADJUST';

    public const TYPE_RENTAL_OUT = 'RENTAL_OUT';

    public const TYPE_RENTAL_RETURN = 'RENTAL_RETURN';

    public const TYPE_ADJUSTMENT = 'ADJUSTMENT';

    public const TYPE_RESTOCK = 'RESTOCK';

    public const TYPE_DAMAGE = 'DAMAGE';

    public const TYPE_MISSING = 'MISSING';

    public const TYPE_MAINTENANCE = 'MAINTENANCE';

    public const TYPE_TRANSFER = 'TRANSFER_TO_SALE';

    public const TYPE_PURCHASE_ADJUST = 'PURCHASE_ADJUST';

    public const TYPE_PURCHASE_CANCEL = 'PURCHASE_CANCEL';

    /**
     * Persist a stock movement row (caller must already have updated product stock).
     */
    public function record(
        Product $product,
        string $type,
        int $signedQuantity,
        int $previousAvailable,
        int $newAvailable,
        ?Model $reference = null,
        ?string $reason = null,
        ?int $userId = null
    ): StockMovement {
        return StockMovement::query()->create([
            'product_id' => $product->id,
            'movement_type' => $type,
            'quantity' => $signedQuantity,
            'previous_quantity' => $previousAvailable,
            'new_quantity' => $newAvailable,
            'reference_type' => $reference ? $reference::class : null,
            'reference_id' => $reference?->getKey(),
            'reason' => $reason,
            'user_id' => $userId ?? Auth::id(),
        ]);
    }

    public function syncProductStatus(Product $product): void
    {
        if (strcasecmp((string) $product->status, 'Maintenance') === 0) {
            return;
        }
        if (strcasecmp((string) $product->status, 'Inactive') === 0) {
            return;
        }

        if ((int) $product->available_quantity > 0) {
            $product->status = 'Available';
        } elseif ((int) $product->rented_quantity > 0) {
            $product->status = 'Rented';
        }
    }

    /**
     * Manual / opening stock adjustment against available + total quantity.
     *
     * @param  array{quantity_delta?:int, new_quantity?:int, reason?:string, movement_type?:string}  $data
     *
     * @throws ValidationException
     */
    public function adjust(Product $product, array $data): Product
    {
        return DB::transaction(function () use ($product, $data) {
            $product = Product::query()->lockForUpdate()->findOrFail($product->id);

            $rented = (int) $product->rented_quantity;
            $oldQty = (int) $product->quantity;
            $oldAvailable = (int) $product->available_quantity;

            if (array_key_exists('new_quantity', $data) && $data['new_quantity'] !== null) {
                $newQty = (int) $data['new_quantity'];
                $delta = $newQty - $oldQty;
            } else {
                $delta = (int) ($data['quantity_delta'] ?? $data['quantity'] ?? 0);
                $newQty = $oldQty + $delta;
            }

            if ($newQty < 0) {
                throw ValidationException::withMessages([
                    'quantity' => ['Stock quantity cannot be negative.'],
                ]);
            }

            if ($newQty < $rented) {
                throw ValidationException::withMessages([
                    'quantity' => ["Total quantity cannot be less than rented quantity ({$rented})."],
                ]);
            }

            $newAvailable = $oldAvailable + $delta;
            if ($newAvailable < 0) {
                throw ValidationException::withMessages([
                    'quantity' => ['Adjustment would result in negative available stock.'],
                ]);
            }

            $maxAvailable = $newQty - $rented;
            $newAvailable = min($newAvailable, $maxAvailable);

            $product->quantity = $newQty;
            $product->available_quantity = $newAvailable;
            $this->syncProductStatus($product);
            $product->save();

            $type = (string) ($data['movement_type'] ?? self::TYPE_ADJUSTMENT);
            if ($delta > 0 && $type === self::TYPE_ADJUSTMENT && empty($data['movement_type'])) {
                $type = self::TYPE_RESTOCK;
            }

            if ($delta !== 0) {
                $this->record(
                    $product,
                    $type,
                    $delta,
                    $oldAvailable,
                    $newAvailable,
                    null,
                    $data['reason'] ?? 'Manual stock adjustment',
                );
            }

            return $product->fresh(['category', 'supplier']);
        });
    }

    public function paginate(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        $query = StockMovement::query()
            ->with([
                'product:id,serial_number,name',
                'user:id,name,email',
            ])
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if (! empty($filters['product_id'])) {
            $query->where('product_id', (int) $filters['product_id']);
        }

        if (! empty($filters['movement_type']) && $filters['movement_type'] !== 'all') {
            $query->where('movement_type', $filters['movement_type']);
        }

        if (! empty($filters['from'])) {
            $query->whereDate('created_at', '>=', $filters['from']);
        }
        if (! empty($filters['to'])) {
            $query->whereDate('created_at', '<=', $filters['to']);
        }

        if ($search = trim((string) ($filters['search'] ?? ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('reason', 'like', "%{$search}%")
                    ->orWhere('movement_type', 'like', "%{$search}%")
                    ->orWhereHas('product', fn ($p) => $p->where('name', 'like', "%{$search}%")->orWhere('serial_number', 'like', "%{$search}%"))
                    ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$search}%"));
            });
        }

        return $query->paginate($perPage)->through(fn (StockMovement $m) => $this->transform($m));
    }

    /**
     * Per-product movement aggregates for the product-based Stock History list.
     *
     * @return list<array{product_id:int, movements_count:int, total_in:int, total_out:int, last_movement_at:?string}>
     */
    public function productSummaries(): array
    {
        return StockMovement::query()
            ->selectRaw('product_id, COUNT(*) as movements_count')
            ->selectRaw('COALESCE(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END), 0) as total_in')
            ->selectRaw('COALESCE(SUM(CASE WHEN quantity < 0 THEN -quantity ELSE 0 END), 0) as total_out')
            ->selectRaw('MAX(created_at) as last_movement_at')
            ->groupBy('product_id')
            ->get()
            ->map(fn ($row) => [
                'product_id' => (int) $row->product_id,
                'movements_count' => (int) $row->movements_count,
                'total_in' => (int) $row->total_in,
                'total_out' => (int) $row->total_out,
                'last_movement_at' => $row->last_movement_at
                    ? Carbon::parse($row->last_movement_at)->toIso8601String()
                    : null,
            ])
            ->values()
            ->all();
    }

    /**
     * One product's details, stock summary and paginated movements (newest first).
     *
     * @param  array{movement_type?:string|null, from?:string|null, to?:string|null}  $filters
     * @return array<string, mixed>
     */
    public function productHistory(Product $product, array $filters = [], int $perPage = 25): array
    {
        $product->loadMissing('category:id,name');

        $totals = StockMovement::query()
            ->where('product_id', $product->id)
            ->selectRaw('COUNT(*) as movements_count')
            ->selectRaw('COALESCE(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END), 0) as total_in')
            ->selectRaw('COALESCE(SUM(CASE WHEN quantity < 0 THEN -quantity ELSE 0 END), 0) as total_out')
            ->selectRaw('MAX(created_at) as last_movement_at')
            ->first();

        $page = $this->paginate([...$filters, 'product_id' => $product->id], $perPage);
        $rows = $this->withRelatedDocuments($page->getCollection()->all());
        $page->setCollection(collect($rows));

        return [
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'serial_number' => $product->serial_number,
                'category' => $product->category?->name,
                'unit' => $product->unit,
                'status' => $product->status,
                'quantity' => (int) $product->quantity,
                'available_quantity' => (int) $product->available_quantity,
                'rented_quantity' => (int) $product->rented_quantity,
                'minimum_stock' => (int) ($product->minimum_stock ?? 0),
            ],
            'summary' => [
                'current_stock' => (int) $product->quantity,
                'available_stock' => (int) $product->available_quantity,
                'rented_stock' => (int) $product->rented_quantity,
                'total_in' => (int) ($totals->total_in ?? 0),
                'total_out' => (int) ($totals->total_out ?? 0),
                'movements_count' => (int) ($totals->movements_count ?? 0),
                'last_movement_at' => $totals?->last_movement_at
                    ? Carbon::parse($totals->last_movement_at)->toIso8601String()
                    : null,
            ],
            'movements' => $page,
        ];
    }

    /**
     * Adds the related sale/rental document number to transformed movement rows.
     *
     * @param  list<array<string, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    private function withRelatedDocuments(array $rows): array
    {
        $idsFor = fn (string $class) => collect($rows)
            ->where('reference_type', $class)
            ->pluck('reference_id')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $sales = Sale::query()->whereIn('id', $idsFor(Sale::class))->pluck('invoice_number', 'id');
        $rentals = Rental::query()->whereIn('id', $idsFor(Rental::class))->pluck('rental_number', 'id');
        $purchases = Purchase::query()->whereIn('id', $idsFor(Purchase::class))->pluck('purchase_number', 'id');

        return array_map(function (array $row) use ($sales, $rentals, $purchases) {
            $sale = $row['reference_type'] === Sale::class && isset($sales[$row['reference_id']])
                ? ['id' => (int) $row['reference_id'], 'invoice_number' => $sales[$row['reference_id']]]
                : null;
            $rental = $row['reference_type'] === Rental::class && isset($rentals[$row['reference_id']])
                ? ['id' => (int) $row['reference_id'], 'rental_number' => $rentals[$row['reference_id']]]
                : null;

            $purchase = $row['reference_type'] === Purchase::class && isset($purchases[$row['reference_id']])
                ? ['id' => (int) $row['reference_id'], 'purchase_number' => $purchases[$row['reference_id']]]
                : null;

            return [
                ...$row,
                'reference_number' => $sale['invoice_number'] ?? $rental['rental_number'] ?? $purchase['purchase_number'] ?? null,
                'related_sale' => $sale,
                'related_rental' => $rental,
                'related_purchase' => $purchase,
                'notes' => $row['reason'],
            ];
        }, $rows);
    }

    public function transform(StockMovement $movement): array
    {
        $movement->loadMissing(['product:id,serial_number,name', 'user:id,name,email']);

        return [
            'id' => $movement->id,
            'product_id' => $movement->product_id,
            'product' => $movement->product?->name,
            'product_serial_number' => $movement->product?->serial_number,
            'movement_type' => $movement->movement_type,
            'type' => $this->labelForType($movement->movement_type),
            'quantity' => (int) $movement->quantity,
            'previous_quantity' => (int) $movement->previous_quantity,
            'new_quantity' => (int) $movement->new_quantity,
            'balance' => (int) $movement->new_quantity,
            'reference_type' => $movement->reference_type,
            'reference_id' => $movement->reference_id,
            'reference' => $this->referenceLabel($movement),
            'reason' => $movement->reason,
            'user_id' => $movement->user_id,
            'user' => $movement->user?->name ?? 'System',
            'date' => optional($movement->created_at)?->toDateString(),
            'created_at' => optional($movement->created_at)?->toIso8601String(),
        ];
    }

    public function labelForType(string $type): string
    {
        return match ($type) {
            self::TYPE_PURCHASE => 'Purchase',
            self::TYPE_SALE, self::TYPE_SALE_ADJUST => 'Sale',
            self::TYPE_SALE_CANCEL => 'Sale Cancelled',
            self::TYPE_RENTAL_OUT => 'Rental Out',
            self::TYPE_RENTAL_RETURN => 'Rental In',
            self::TYPE_RESTOCK => 'Restock',
            self::TYPE_DAMAGE => 'Damage',
            self::TYPE_MISSING => 'Missing',
            self::TYPE_MAINTENANCE => 'Maintenance',
            self::TYPE_TRANSFER => 'Transfer to Sale',
            self::TYPE_PURCHASE_ADJUST => 'Purchase Edited',
            self::TYPE_PURCHASE_CANCEL => 'Purchase Cancelled',
            default => 'Adjustment',
        };
    }

    private function referenceLabel(StockMovement $movement): string
    {
        if ($movement->reason) {
            return $movement->reason;
        }
        if ($movement->reference_type && $movement->reference_id) {
            $base = class_basename($movement->reference_type);

            return "{$base} #{$movement->reference_id}";
        }

        return '—';
    }
}
