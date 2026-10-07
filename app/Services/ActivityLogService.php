<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\AuditLog;
use App\Models\Booking;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Cheque;
use App\Models\Customer;
use App\Models\EquipmentCheck;
use App\Models\Expense;
use App\Models\ExpensePayment;
use App\Models\Income;
use App\Models\IncomePayment;
use App\Models\MaintenanceRecord;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Staff;
use App\Models\StaffAssignment;
use App\Models\StaffRole;
use App\Models\Reminder;
use App\Models\Role;
use App\Models\Rental;
use App\Models\RentalPayment;
use App\Models\RentalReturn;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleMaintenance;
use App\Models\VehicleRental;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Throwable;

/**
 * Central writer for Activity History (human-readable business events)
 * and Audit Logs (field-level old/new values).
 */
class ActivityLogService
{
    /** Model class => [module key, label, label attribute]. */
    public const TRACKED = [
        Product::class => ['products', 'Product', 'name'],
        Category::class => ['categories', 'Category', 'name'],
        Customer::class => ['customers', 'Customer', 'name'],
        Supplier::class => ['suppliers', 'Supplier', 'name'],
        Sale::class => ['sales', 'Sale', 'invoice_number'],
        SalePayment::class => ['payments', 'Sale payment', 'reference'],
        Rental::class => ['rentals', 'Rental', 'rental_number'],
        RentalPayment::class => ['payments', 'Rental payment', 'reference'],
        RentalReturn::class => ['rentals', 'Rental return', null],
        Booking::class => ['bookings', 'Booking', 'booking_number'],
        Income::class => ['income', 'Income', 'reference'],
        IncomePayment::class => ['payments', 'Income payment', 'reference'],
        Expense::class => ['expenses', 'Expense', 'reference'],
        ExpensePayment::class => ['payments', 'Expense payment', 'reference'],
        EquipmentCheck::class => ['checks', 'Check', 'check_number'],
        Cheque::class => ['cheques', 'Cheque', 'cheque_number'],
        MaintenanceRecord::class => ['maintenance', 'Maintenance', 'maintenance_number'],
        Reminder::class => ['reminders', 'Reminder', 'title'],
        StockMovement::class => ['stock', 'Stock movement', null],
        User::class => ['users', 'User', 'name'],
        Role::class => ['users', 'Role', 'name'],
        Branch::class => ['branches', 'Branch', 'name'],
        Purchase::class => ['purchases', 'Purchase', 'purchase_number'],
        Vehicle::class => ['vehicles', 'Vehicle', 'name'],
        VehicleRental::class => ['vehicles', 'Vehicle rental', 'rental_number'],
        VehicleMaintenance::class => ['vehicles', 'Vehicle maintenance', 'maintenance_number'],
        Staff::class => ['staff', 'Staff', 'full_name'],
        StaffRole::class => ['staff', 'Staff role', 'name'],
        StaffAssignment::class => ['staff', 'Staff assignment', null],
    ];

    /** Never persisted in logs. */
    private const SENSITIVE = [
        'password', 'remember_token', 'token', 'api_key', 'secret', 'two_factor_secret',
        'two_factor_recovery_codes', 'current_password', 'password_confirmation',
        'id_number', 'id_photo_path', 'photo_path', 'receipt_path', 'nic', 'photo',
    ];

    /** Bookkeeping columns ignored when diffing. */
    private const IGNORED = ['created_at', 'updated_at', 'last_login_at', 'email_verified_at'];

    /** Derived columns kept in the audit trail but not worth a separate activity entry. */
    private const DERIVED = [
        'available_quantity', 'rented_quantity', 'paid_amount', 'balance', 'payment_status',
        'total_paid', 'amount_paid', 'outstanding',
    ];

    public function modelCreated(Model $model): void
    {
        $this->safely(function () use ($model) {
            $new = $this->clean($model->getAttributes());
            $this->writeAudit('created', $model, null, $new);
            $this->writeActivity('created', $model, $this->createdDescription($model));
        });
    }

    public function modelUpdated(Model $model): void
    {
        $this->safely(function () use ($model) {
            $changes = $this->clean($model->getChanges());
            if ($changes === []) {
                return;
            }
            $old = [];
            foreach (array_keys($changes) as $key) {
                $old[$key] = $model->getOriginal($key);
            }
            $old = $this->clean($old);
            $this->writeAudit('updated', $model, $old, $changes);

            $meaningful = array_diff(array_keys($changes), self::DERIVED);
            if ($meaningful === []) {
                return;
            }
            $this->writeActivity(
                array_key_exists('status', $changes) ? 'status_changed' : 'updated',
                $model,
                $this->updatedDescription($model, $old, $changes, $meaningful)
            );
        });
    }

    public function modelDeleted(Model $model): void
    {
        $this->safely(function () use ($model) {
            $old = $this->clean($model->getAttributes());
            $this->writeAudit('deleted', $model, $old, null);
            $this->writeActivity('deleted', $model, 'Deleted '.$this->describe($model));
        });
    }

    /**
     * Explicit business events not tied to a single model write (login, settings, etc.).
     *
     * @param  array<string, mixed>|null  $old
     * @param  array<string, mixed>|null  $new
     */
    public function record(
        string $action,
        string $module,
        string $description,
        ?Model $subject = null,
        ?array $old = null,
        ?array $new = null,
        ?User $actor = null
    ): void {
        $this->safely(function () use ($action, $module, $description, $subject, $old, $new, $actor) {
            $user = $actor ?? Auth::user();
            $request = request();

            ActivityLog::query()->create([
                'user_id' => $user?->id,
                'user_name' => $user?->name,
                'action' => $action,
                'module' => $module,
                'subject_type' => $subject ? class_basename($subject) : null,
                'subject_id' => $subject?->getKey(),
                'subject_label' => $subject ? $this->label($subject) : null,
                'description' => mb_substr($description, 0, 500),
                'ip_address' => $request?->ip(),
            ]);

            if ($old !== null || $new !== null) {
                AuditLog::query()->create([
                    'user_id' => $user?->id,
                    'user_name' => $user?->name,
                    'action' => $action,
                    'auditable_type' => $subject ? class_basename($subject) : ucfirst($module),
                    'auditable_id' => $subject?->getKey(),
                    'auditable_label' => $subject ? $this->label($subject) : null,
                    'old_values' => $old !== null ? $this->clean($old) : null,
                    'new_values' => $new !== null ? $this->clean($new) : null,
                    'ip_address' => $request?->ip(),
                    'user_agent' => mb_substr((string) $request?->userAgent(), 0, 500),
                ]);
            }
        });
    }

    private function writeAudit(string $action, Model $model, ?array $old, ?array $new): void
    {
        $user = Auth::user();
        $request = request();

        AuditLog::query()->create([
            'user_id' => $user?->id,
            'user_name' => $user?->name,
            'action' => $action,
            'auditable_type' => class_basename($model),
            'auditable_id' => $model->getKey(),
            'auditable_label' => $this->label($model),
            'old_values' => $old,
            'new_values' => $new,
            'ip_address' => $request?->ip(),
            'user_agent' => mb_substr((string) $request?->userAgent(), 0, 500),
        ]);
    }

    private function writeActivity(string $action, Model $model, string $description): void
    {
        $user = Auth::user();
        [$module] = self::TRACKED[$model::class] ?? ['system'];

        ActivityLog::query()->create([
            'user_id' => $user?->id,
            'user_name' => $user?->name,
            'action' => $action,
            'module' => $module,
            'subject_type' => class_basename($model),
            'subject_id' => $model->getKey(),
            'subject_label' => $this->label($model),
            'description' => mb_substr($description, 0, 500),
            'ip_address' => request()?->ip(),
        ]);
    }

    private function createdDescription(Model $model): string
    {
        if ($model instanceof StockMovement) {
            $product = Product::query()->find($model->product_id);
            $qty = (int) $model->quantity;

            return sprintf(
                'Stock %s: %s%d × %s (%d → %d)%s',
                strtolower(str_replace('_', ' ', (string) $model->movement_type)),
                $qty > 0 ? '+' : '',
                $qty,
                $product?->name ?? 'product #'.$model->product_id,
                (int) $model->previous_quantity,
                (int) $model->new_quantity,
                $model->reason ? ' — '.$model->reason : ''
            );
        }

        if ($model instanceof SalePayment || $model instanceof RentalPayment || $model instanceof IncomePayment || $model instanceof ExpensePayment) {
            $parent = match (true) {
                $model instanceof SalePayment => Sale::query()->find($model->sale_id)?->invoice_number,
                $model instanceof RentalPayment => Rental::query()->find($model->rental_id)?->rental_number,
                $model instanceof IncomePayment => Income::query()->find($model->income_id)?->reference,
                default => Expense::query()->find($model->expense_id)?->reference,
            };

            return sprintf('Payment of %s added%s', number_format((float) $model->amount, 2), $parent ? ' to '.$parent : '');
        }

        if ($model instanceof RentalReturn) {
            $rental = Rental::query()->find($model->rental_id);

            return sprintf(
                'Rental %s returned: %d returned, %d damaged, %d missing',
                $rental?->rental_number ?? '#'.$model->rental_id,
                (int) $model->returned_quantity,
                (int) $model->damaged_quantity,
                (int) $model->missing_quantity
            );
        }

        return 'Created '.$this->describe($model);
    }

    /**
     * @param  array<string, mixed>  $old
     * @param  array<string, mixed>  $new
     * @param  array<int, string>  $meaningful
     */
    private function updatedDescription(Model $model, array $old, array $new, array $meaningful): string
    {
        if (array_key_exists('status', $new)) {
            return sprintf('%s status: %s → %s', $this->describe($model), $old['status'] ?? '—', $new['status'] ?? '—');
        }

        $fields = implode(', ', array_map(fn ($f) => str_replace('_', ' ', $f), array_slice(array_values($meaningful), 0, 6)));

        return sprintf('Updated %s (%s)', $this->describe($model), $fields);
    }

    private function describe(Model $model): string
    {
        [, $label] = self::TRACKED[$model::class] ?? [null, class_basename($model)];
        $name = $this->label($model);

        return $name ? sprintf('%s "%s"', $label, $name) : $label.' #'.$model->getKey();
    }

    private function label(Model $model): ?string
    {
        $attr = self::TRACKED[$model::class][2] ?? null;
        $value = $attr ? $model->getAttribute($attr) : null;

        return $value !== null && $value !== '' ? mb_substr((string) $value, 0, 255) : null;
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function clean(array $values): array
    {
        $out = [];
        foreach ($values as $key => $value) {
            if (in_array($key, self::IGNORED, true) || in_array($key, self::SENSITIVE, true)) {
                continue;
            }
            if (str_contains($key, 'password') || str_contains($key, 'token') || str_contains($key, 'secret')) {
                continue;
            }
            $out[$key] = $value instanceof \DateTimeInterface ? $value->format('Y-m-d H:i:s') : $value;
        }

        return $out;
    }

    private function safely(callable $callback): void
    {
        try {
            $callback();
        } catch (Throwable $e) {
            report($e);
        }
    }
}
