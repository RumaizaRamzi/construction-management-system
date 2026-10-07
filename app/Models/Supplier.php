<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Supplier extends Model
{
    protected $fillable = [
        'supplier_code',
        'name',
        'phone',
        'email',
        'address',
        'company_name',
        'contact_person',
        'products_supplied',
        'status',
        'outstanding',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'outstanding' => 'decimal:2',
        ];
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function purchases(): HasMany
    {
        return $this->hasMany(Purchase::class);
    }
}
