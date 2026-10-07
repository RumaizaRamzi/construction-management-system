<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    public const LISTING_BOTH = 'both';

    public const LISTING_RENT = 'rent';

    public const LISTING_SALE = 'sale';

    /** Bought but not offered for sale or rent yet (e.g. recorded through a purchase). */
    public const LISTING_NONE = 'none';

    public const LISTING_TYPES = [self::LISTING_BOTH, self::LISTING_RENT, self::LISTING_SALE, self::LISTING_NONE];

    protected $attributes = [
        'listing_type' => self::LISTING_BOTH,
    ];

    protected $fillable = [
        'category_id',
        'supplier_id',
        'serial_number',
        'name',
        'description',
        'image',
        'quantity',
        'available_quantity',
        'rented_quantity',
        'minimum_stock',
        'purchase_price',
        'sale_price',
        'rental_price',
        'unit',
        'condition',
        'location',
        'status',
        'listing_type',
        'branch_id',
    ];

    public function isRentable(): bool
    {
        return ! in_array($this->listing_type, [self::LISTING_SALE, self::LISTING_NONE], true);
    }

    public function isSellable(): bool
    {
        return ! in_array($this->listing_type, [self::LISTING_RENT, self::LISTING_NONE], true);
    }

    public function purchaseItems(): HasMany
    {
        return $this->hasMany(PurchaseItem::class);
    }

    protected function casts(): array
    {
        return [
            'purchase_price' => 'decimal:2',
            'sale_price' => 'decimal:2',
            'rental_price' => 'decimal:2',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function saleItems(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function rentalItems(): HasMany
    {
        return $this->hasMany(RentalItem::class);
    }

    public function bookingItems(): HasMany
    {
        return $this->hasMany(BookingItem::class);
    }

    public function equipmentChecks(): HasMany
    {
        return $this->hasMany(EquipmentCheck::class);
    }

    public function maintenanceRecords(): HasMany
    {
        return $this->hasMany(MaintenanceRecord::class);
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }
}
