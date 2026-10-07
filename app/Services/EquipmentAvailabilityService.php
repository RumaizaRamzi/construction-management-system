<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Product;
use App\Models\RentalItem;

/**
 * Unified equipment availability across bookings + rentals.
 * Prevents double-booking the same units for overlapping dates.
 */
class EquipmentAvailabilityService
{
    public const BOOKING_BLOCKING = ['Pending', 'Confirmed', 'Active'];

    public const RENTAL_BLOCKING = ['Pending', 'Confirmed', 'Active', 'Overdue', 'Maintenance'];

    public function snapshot(
        Product $product,
        string $startDate,
        string $endDate,
        ?int $excludeBookingId = null,
        ?int $excludeRentalId = null
    ): array {
        $total = (int) $product->quantity;
        if ($total <= 0) {
            $total = (int) $product->available_quantity + (int) $product->rented_quantity;
        }

        $booked = $this->bookedFromBookings($product->id, $startDate, $endDate, $excludeBookingId);
        $rented = $this->bookedFromRentals($product->id, $startDate, $endDate, $excludeRentalId);

        $maintenanceHold = 0;
        if (strcasecmp((string) $product->status, 'Maintenance') === 0) {
            $maintenanceHold = max(
                0,
                $total - (int) $product->available_quantity - (int) $product->rented_quantity
            );
        }

        $available = max(0, $total - $booked - $rented - $maintenanceHold);

        return [
            'product_id' => $product->id,
            'product_name' => $product->name,
            'total_quantity' => $total,
            'booked_quantity' => $booked,
            'rented_quantity' => $rented,
            'maintenance_quantity' => $maintenanceHold,
            'available_quantity' => $available,
            'start_date' => $startDate,
            'end_date' => $endDate,
        ];
    }

    public function bookedFromBookings(
        int $productId,
        string $startDate,
        string $endDate,
        ?int $excludeBookingId = null
    ): int {
        $query = BookingItem::query()
            ->where('product_id', $productId)
            ->whereHas('booking', function ($q) use ($startDate, $endDate, $excludeBookingId) {
                $q->whereIn('status', self::BOOKING_BLOCKING)
                    ->whereDate('start_date', '<=', $endDate)
                    ->whereDate('end_date', '>=', $startDate);

                if ($excludeBookingId) {
                    $q->where('id', '!=', $excludeBookingId);
                }

                // Exclude bookings already converted to a rental (counted via rentals).
                $q->where(function ($q2) {
                    $q2->whereNull('rental_id')->orWhere('rental_id', 0);
                });
            });

        return (int) $query->sum('quantity');
    }

    public function bookedFromRentals(
        int $productId,
        string $startDate,
        string $endDate,
        ?int $excludeRentalId = null
    ): int {
        $query = RentalItem::query()
            ->where('product_id', $productId)
            ->whereHas('rental', function ($q) use ($startDate, $endDate, $excludeRentalId) {
                $q->whereIn('status', self::RENTAL_BLOCKING)
                    ->whereDate('start_date', '<=', $endDate)
                    ->where(function ($q2) use ($startDate) {
                        $q2->whereNull('expected_return_date')
                            ->orWhereDate('expected_return_date', '>=', $startDate);
                    });

                if ($excludeRentalId) {
                    $q->where('id', '!=', $excludeRentalId);
                }
            });

        $items = $query->with(['rental.returns'])->get();
        $booked = 0;

        foreach ($items as $item) {
            $rented = (int) $item->quantity;
            $processed = 0;
            if ($item->rental && $item->rental->returns) {
                foreach ($item->rental->returns as $ret) {
                    $processed += (int) $ret->returned_quantity
                        + (int) $ret->damaged_quantity
                        + (int) $ret->missing_quantity;
                }
            }
            $booked += max(0, $rented - min($processed, $rented));
        }

        return $booked;
    }

    public function assertCanReserve(
        Product $product,
        int $quantity,
        string $startDate,
        string $endDate,
        ?int $excludeBookingId = null,
        ?int $excludeRentalId = null
    ): array {
        $snap = $this->snapshot($product, $startDate, $endDate, $excludeBookingId, $excludeRentalId);
        $available = (int) $snap['available_quantity'];
        $unitWord = $available === 1 ? 'unit' : 'units';
        $verb = $available === 1 ? 'is' : 'are';
        $name = $product->name ?: 'this equipment';

        if ($quantity > $available) {
            $snap['ok'] = false;
            $snap['message'] = "Only {$available} {$unitWord} of {$name} {$verb} available for the selected dates.";
        } else {
            $snap['ok'] = true;
            $snap['message'] = "{$available} {$unitWord} available for the selected dates.";
        }

        return $snap;
    }
}
