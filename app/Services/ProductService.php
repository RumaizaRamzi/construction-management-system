<?php

namespace App\Services;

use App\Models\BookingItem;
use App\Models\Category;
use App\Models\Product;
use App\Models\RentalItem;
use App\Models\SaleItem;
use App\Models\StockMovement;
use App\Models\Supplier;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class ProductService
{
    public function __construct(
        private readonly StockMovementService $stock,
        private readonly ActivityLogService $logs
    ) {
    }

    public function transform(Product $product): array
    {
        $product->loadMissing(['category:id,name', 'supplier:id,name,supplier_code']);

        return [
            'id' => $product->id,
            'category_id' => $product->category_id,
            'supplier_id' => $product->supplier_id,
            'serial_number' => $product->serial_number,
            'name' => $product->name,
            'description' => $product->description,
            'image' => $product->image,
            'quantity' => (int) $product->quantity,
            'available_quantity' => (int) $product->available_quantity,
            'rented_quantity' => (int) $product->rented_quantity,
            'minimum_stock' => (int) $product->minimum_stock,
            'purchase_price' => $product->purchase_price !== null ? (float) $product->purchase_price : null,
            'sale_price' => $product->sale_price !== null ? (float) $product->sale_price : null,
            'rental_price' => $product->rental_price !== null ? (float) $product->rental_price : null,
            'unit' => $product->unit,
            'condition' => $product->condition,
            'location' => $product->location,
            'branch_id' => $product->branch_id,
            'status' => $product->status,
            'listing_type' => $product->listing_type ?: Product::LISTING_BOTH,
            'category' => $product->category ? [
                'id' => $product->category->id,
                'name' => $product->category->name,
            ] : null,
            'supplier' => $product->supplier ? [
                'id' => $product->supplier->id,
                'name' => $product->supplier->name,
                'supplier_code' => $product->supplier->supplier_code,
            ] : null,
            'created_at' => optional($product->created_at)?->toIso8601String(),
            'updated_at' => optional($product->updated_at)?->toIso8601String(),
        ];
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function create(array $data): Product
    {
        return DB::transaction(function () use ($data) {
            $this->assertCategory($data['category_id'] ?? null);
            $this->assertSupplier($data['supplier_id'] ?? null);

            $qty = max(0, (int) ($data['quantity'] ?? $data['available_quantity'] ?? 0));
            $available = array_key_exists('available_quantity', $data)
                ? max(0, (int) $data['available_quantity'])
                : $qty;
            $available = min($available, $qty);

            $status = (string) ($data['status'] ?? 'Available');
            if (! in_array($status, ['Available', 'Rented', 'Maintenance', 'Inactive', 'Out of Stock'], true)) {
                $status = $available > 0 ? 'Available' : 'Available';
            }

            $product = Product::query()->create([
                'category_id' => $data['category_id'] ?? null,
                'supplier_id' => $data['supplier_id'] ?? null,
                'serial_number' => strtoupper(trim((string) $data['serial_number'])),
                'name' => trim((string) $data['name']),
                'description' => $data['description'] ?? null,
                'image' => $data['image'] ?? null,
                'quantity' => $qty,
                'available_quantity' => $available,
                'rented_quantity' => 0,
                'minimum_stock' => max(0, (int) ($data['minimum_stock'] ?? 0)),
                'purchase_price' => $data['purchase_price'] ?? null,
                'sale_price' => $data['sale_price'] ?? null,
                'rental_price' => $data['rental_price'] ?? null,
                'unit' => array_key_exists('unit', $data) ? $data['unit'] : 'Unit',
                'condition' => $data['condition'] ?? null,
                'location' => $data['location'] ?? null,
                'branch_id' => $data['branch_id'] ?? null,
                'status' => $status === 'Out of Stock' && $available > 0 ? 'Available' : $status,
                'listing_type' => in_array($data['listing_type'] ?? null, Product::LISTING_TYPES, true)
                    ? $data['listing_type']
                    : Product::LISTING_BOTH,
            ]);

            if ($available > 0) {
                $this->stock->record(
                    $product,
                    StockMovementService::TYPE_PURCHASE,
                    $available,
                    0,
                    $available,
                    null,
                    'Opening stock / product created'
                );
            }

            Cache::forget('categories.index.first');

            return $product->fresh(['category', 'supplier']);
        });
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function update(Product $product, array $data): Product
    {
        return DB::transaction(function () use ($product, $data) {
            $product = Product::query()->lockForUpdate()->findOrFail($product->id);

            if (array_key_exists('category_id', $data)) {
                $this->assertCategory($data['category_id']);
                $product->category_id = $data['category_id'];
            }
            if (array_key_exists('supplier_id', $data)) {
                $this->assertSupplier($data['supplier_id']);
                $product->supplier_id = $data['supplier_id'];
            }
            if (array_key_exists('serial_number', $data) && $data['serial_number']) {
                $product->serial_number = strtoupper(trim((string) $data['serial_number']));
            }
            if (array_key_exists('name', $data)) {
                $product->name = trim((string) $data['name']);
            }
            foreach (['description', 'image', 'unit', 'condition', 'location', 'branch_id'] as $field) {
                if (array_key_exists($field, $data)) {
                    $product->{$field} = $data[$field];
                }
            }
            foreach (['purchase_price', 'sale_price', 'rental_price'] as $field) {
                if (array_key_exists($field, $data)) {
                    $product->{$field} = $data[$field];
                }
            }
            if (array_key_exists('minimum_stock', $data)) {
                $product->minimum_stock = max(0, (int) $data['minimum_stock']);
            }
            if (array_key_exists('status', $data) && $data['status']) {
                $status = (string) $data['status'];
                if (in_array($status, ['Available', 'Rented', 'Maintenance', 'Inactive'], true)) {
                    $product->status = $status;
                }
            }

            $oldQty = (int) $product->quantity;
            $oldAvailable = (int) $product->available_quantity;
            $rented = (int) $product->rented_quantity;

            if (array_key_exists('quantity', $data)) {
                $newQty = max(0, (int) $data['quantity']);
                if ($newQty < $rented) {
                    throw ValidationException::withMessages([
                        'quantity' => ["Total quantity cannot be less than rented quantity ({$rented})."],
                    ]);
                }
                $delta = $newQty - $oldQty;
                $newAvailable = $oldAvailable + $delta;
                if ($newAvailable < 0) {
                    throw ValidationException::withMessages([
                        'quantity' => ['Updating quantity would result in negative available stock.'],
                    ]);
                }
                $product->quantity = $newQty;
                $product->available_quantity = min($newAvailable, $newQty - $rented);

                if ($delta !== 0) {
                    $this->stock->record(
                        $product,
                        $delta > 0 ? StockMovementService::TYPE_RESTOCK : StockMovementService::TYPE_ADJUSTMENT,
                        $delta,
                        $oldAvailable,
                        (int) $product->available_quantity,
                        null,
                        'Product quantity updated'
                    );
                }
            }

            if (strcasecmp((string) $product->status, 'Maintenance') !== 0
                && strcasecmp((string) $product->status, 'Inactive') !== 0) {
                $this->stock->syncProductStatus($product);
            }

            $product->save();
            Cache::forget('categories.index.first');

            return $product->fresh(['category', 'supplier']);
        });
    }

    /**
     * Moves a rental (or sale & rent) product into the sales inventory only.
     * The same record is updated in place; stock, prices and history are preserved.
     *
     * @throws ValidationException|Throwable
     */
    public function transferToSale(Product $product, array $data): Product
    {
        return DB::transaction(function () use ($product, $data) {
            $product = Product::query()->lockForUpdate()->findOrFail($product->id);

            if ($product->listing_type === Product::LISTING_SALE) {
                throw ValidationException::withMessages([
                    'product' => ["{$product->name} is already listed for sale."],
                ]);
            }

            $rented = (int) $product->rented_quantity;
            if ($rented > 0) {
                $units = $rented === 1 ? 'unit is' : 'units are';
                throw ValidationException::withMessages([
                    'product' => ["{$rented} {$units} still out on rental. Record the return before transferring to sale."],
                ]);
            }

            $openRentals = RentalItem::query()
                ->where('product_id', $product->id)
                ->whereHas('rental', fn ($q) => $q->whereIn('status', ['Pending', 'Confirmed', 'Active', 'Overdue']))
                ->exists();
            if ($openRentals) {
                throw ValidationException::withMessages([
                    'product' => ['This product is on an open rental. Complete or cancel the rental before transferring to sale.'],
                ]);
            }

            $openBookings = BookingItem::query()
                ->where('product_id', $product->id)
                ->whereHas('booking', function ($q) {
                    $q->whereIn('status', EquipmentAvailabilityService::BOOKING_BLOCKING)
                        ->where(fn ($q2) => $q2->whereNull('rental_id')->orWhere('rental_id', 0));
                })
                ->exists();
            if ($openBookings) {
                throw ValidationException::withMessages([
                    'product' => ['This product has upcoming bookings. Cancel or complete them before transferring to sale.'],
                ]);
            }

            $salePrice = array_key_exists('sale_price', $data) && $data['sale_price'] !== null && $data['sale_price'] !== ''
                ? round((float) $data['sale_price'], 2)
                : (float) $product->sale_price;
            if ($salePrice <= 0) {
                throw ValidationException::withMessages([
                    'sale_price' => ['Enter a sale price greater than zero before transferring to sale.'],
                ]);
            }

            $old = [
                'listing_type' => $product->listing_type,
                'sale_price' => $product->sale_price !== null ? (float) $product->sale_price : null,
                'status' => $product->status,
            ];

            $product->listing_type = Product::LISTING_SALE;
            $product->sale_price = $salePrice;
            $this->stock->syncProductStatus($product);
            $product->saveQuietly();

            $available = (int) $product->available_quantity;
            StockMovement::withoutEvents(fn () => $this->stock->record(
                $product,
                StockMovementService::TYPE_TRANSFER,
                0,
                $available,
                $available,
                null,
                'Transferred from rental inventory to sales inventory'
            ));

            $this->logs->record(
                'transferred_to_sale',
                'products',
                sprintf('Product "%s" transferred from rental to sales inventory', $product->name),
                $product,
                $old,
                [
                    'listing_type' => $product->listing_type,
                    'sale_price' => (float) $product->sale_price,
                    'status' => $product->status,
                ]
            );

            return $product->fresh(['category', 'supplier']);
        });
    }

    /**
     * Soft-deactivate when referenced; otherwise hard delete.
     *
     * @throws ValidationException|Throwable
     */
    public function delete(Product $product): array
    {
        return DB::transaction(function () use ($product) {
            $product = Product::query()->lockForUpdate()->findOrFail($product->id);

            $hasSales = SaleItem::query()->where('product_id', $product->id)->exists();
            $hasRentals = $product->rentalItems()->exists();
            $hasBookings = $product->bookingItems()->exists();
            $hasPurchases = $product->purchaseItems()->exists();
            $hasRented = (int) $product->rented_quantity > 0;

            if ($hasRented) {
                throw ValidationException::withMessages([
                    'product' => ['Cannot delete a product that still has rented units. Complete returns first.'],
                ]);
            }

            if ($hasSales || $hasRentals || $hasBookings || $hasPurchases) {
                $product->status = 'Inactive';
                $product->save();

                return [
                    'deactivated' => true,
                    'product' => $product->fresh(['category', 'supplier']),
                ];
            }

            $product->stockMovements()->delete();
            $product->delete();
            Cache::forget('categories.index.first');

            return [
                'deactivated' => false,
                'product' => null,
            ];
        });
    }

    private function assertCategory(mixed $categoryId): void
    {
        if ($categoryId === null || $categoryId === '') {
            return;
        }
        if (! Category::query()->whereKey((int) $categoryId)->exists()) {
            throw ValidationException::withMessages([
                'category_id' => ['The selected category is invalid.'],
            ]);
        }
    }

    private function assertSupplier(mixed $supplierId): void
    {
        if ($supplierId === null || $supplierId === '') {
            return;
        }
        if (! Supplier::query()->whereKey((int) $supplierId)->exists()) {
            throw ValidationException::withMessages([
                'supplier_id' => ['The selected supplier is invalid.'],
            ]);
        }
    }
}
