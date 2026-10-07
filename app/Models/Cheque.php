<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Cheque extends Model
{
    public const STATUS_PENDING = 'Pending';

    public const STATUS_DEPOSITED = 'Deposited';

    public const STATUS_CLEARED = 'Cleared';

    public const STATUS_BOUNCED = 'Bounced';

    public const STATUSES = [self::STATUS_PENDING, self::STATUS_DEPOSITED, self::STATUS_CLEARED, self::STATUS_BOUNCED];

    /** Cheques still awaiting funds; these get date reminders. */
    public const OPEN_STATUSES = [self::STATUS_PENDING, self::STATUS_DEPOSITED];

    public const TYPE_RECEIVED = 'received';

    public const TYPE_ISSUED = 'issued';

    public const TYPES = [self::TYPE_RECEIVED, self::TYPE_ISSUED];

    /** reference_type => model class (sale = invoice). */
    public const REFERENCE_TYPES = [
        'sale' => Sale::class,
        'rental' => Rental::class,
        'income' => Income::class,
        'expense' => Expense::class,
        'purchase' => Purchase::class,
    ];

    /** payment_type => [model class, parent reference_type, parent foreign key, cheque type]. */
    public const PAYMENT_TYPES = [
        'sale_payment' => [SalePayment::class, 'sale', 'sale_id', self::TYPE_RECEIVED],
        'rental_payment' => [RentalPayment::class, 'rental', 'rental_id', self::TYPE_RECEIVED],
        'income_payment' => [IncomePayment::class, 'income', 'income_id', self::TYPE_RECEIVED],
        'expense_payment' => [ExpensePayment::class, 'expense', 'expense_id', self::TYPE_ISSUED],
    ];

    protected $fillable = [
        'cheque_number',
        'bank',
        'amount',
        'cheque_date',
        'type',
        'customer_id',
        'supplier_id',
        'status',
        'status_changed_at',
        'notes',
        'reference_type',
        'reference_id',
        'payment_type',
        'payment_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'cheque_date' => 'date',
            'status_changed_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function referenceRecord(): ?Model
    {
        $class = self::REFERENCE_TYPES[$this->reference_type] ?? null;

        return $class && $this->reference_id ? $class::query()->find($this->reference_id) : null;
    }

    public function scopeOpen($query)
    {
        return $query->whereIn('status', self::OPEN_STATUSES);
    }
}
