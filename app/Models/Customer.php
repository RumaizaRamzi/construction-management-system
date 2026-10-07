<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    protected $fillable = [
        'customer_code',
        'name',
        'phone',
        'email',
        'address',
        'city',
        'company_name',
        'customer_type',
        'status',
        'notes',
        'id_number',
    ];

    /** Storage paths stay server-side; the photo is only served through the authenticated endpoint. */
    protected $hidden = ['id_photo_path'];

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function rentals(): HasMany
    {
        return $this->hasMany(Rental::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function income(): HasMany
    {
        return $this->hasMany(Income::class);
    }

    public function vehicleRentals(): HasMany
    {
        return $this->hasMany(VehicleRental::class);
    }

    public function hasRelatedTransactions(): bool
    {
        return $this->sales()->exists()
            || $this->rentals()->exists()
            || $this->bookings()->exists()
            || $this->income()->exists()
            || $this->vehicleRentals()->exists();
    }
}
