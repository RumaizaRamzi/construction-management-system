<?php

namespace App\Console\Commands;

use App\Services\ActivityLogService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Removes demo/test business records so a development database can receive real client data.
 * Users, roles, permissions, auth tokens, settings, migrations and the schema are never touched.
 */
class ClearDemoDataCommand extends Command
{
    protected $signature = 'buildtrack:clear-demo-data
        {--confirm : Skip the interactive prompt and delete immediately}
        {--dry-run : Only show what would be deleted}';

    protected $description = 'Delete demo/test business data (development only). Preserves users, roles, permissions, settings and schema.';

    /**
     * Business tables in foreign-key-safe deletion order (children before parents).
     * RESTRICT links: items/stock/checks/maintenance → products; sales/rentals/bookings → customers;
     * attendances/staff_assignments → staff.
     *
     * @var array<string, string>
     */
    public const BUSINESS_TABLES = [
        'attendances' => 'Staff attendance',
        'staff_assignments' => 'Staff assignments',
        'staff' => 'Staff',
        'cheques' => 'Cheques',
        'rental_return_items' => 'Rental return items',
        'rental_returns' => 'Rental returns',
        'rental_payments' => 'Rental payments',
        'sale_payments' => 'Sale payments',
        'sale_items' => 'Sale items',
        'booking_items' => 'Booking items',
        'bookings' => 'Bookings',
        'equipment_checks' => 'Equipment checks',
        'maintenance_records' => 'Maintenance records',
        'reminders' => 'Reminders',
        'stock_movements' => 'Stock movements',
        'rental_items' => 'Rental items',
        'rentals' => 'Rentals',
        'sales' => 'Sales',
        'income_payments' => 'Income payments',
        'income' => 'Income',
        'expense_payments' => 'Expense payments',
        'expenses' => 'Expenses',
        'purchase_items' => 'Purchase items',
        'purchases' => 'Purchases',
        'vehicle_maintenance' => 'Vehicle maintenance',
        'vehicle_rentals' => 'Vehicle rentals',
        'vehicles' => 'Vehicles',
        'notifications' => 'Notifications',
        'products' => 'Products',
        'categories' => 'Categories',
        'customers' => 'Customers',
        'suppliers' => 'Suppliers',
        'activity_logs' => 'Activity logs',
        'audit_logs' => 'Audit logs',
    ];

    /** @var list<string> */
    public const PRESERVED_TABLES = [
        'users', 'roles', 'permissions', 'role_permissions', 'personal_access_tokens',
        'password_reset_tokens', 'sessions', 'settings', 'migrations', 'staff_roles', 'branches',
        'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs',
    ];

    public function handle(ActivityLogService $logs): int
    {
        if (app()->environment('production')) {
            $this->error('Refusing to run: APP_ENV is production. This command is for development databases only.');

            return self::FAILURE;
        }

        $counts = [];
        foreach (self::BUSINESS_TABLES as $table => $label) {
            if (Schema::hasTable($table)) {
                $counts[$table] = DB::table($table)->count();
            }
        }

        $this->warn('Database: '.DB::connection()->getDatabaseName().' ('.config('database.default').')');
        $this->line('The following business/test records will be DELETED:');
        $this->table(
            ['Data', 'Table', 'Records'],
            collect($counts)->map(fn ($n, $t) => [self::BUSINESS_TABLES[$t], $t, $n])->values()->all()
        );
        $this->line('Total: '.array_sum($counts).' record(s).');
        $this->info('Preserved: '.implode(', ', self::PRESERVED_TABLES).' and the database schema.');

        if ($this->option('dry-run')) {
            $this->info('Dry run only. Nothing was deleted.');

            return self::SUCCESS;
        }

        if (array_sum($counts) === 0) {
            $this->info('No business data found. Nothing to delete.');

            return self::SUCCESS;
        }

        if (! $this->option('confirm')
            && ! $this->confirm('Permanently delete these records? Make sure you have a database backup.', false)) {
            $this->info('Cancelled. Nothing was deleted.');

            return self::FAILURE;
        }

        try {
            DB::transaction(function () use ($counts) {
                foreach (array_keys($counts) as $table) {
                    DB::table($table)->delete();
                }
            });
        } catch (Throwable $e) {
            report($e);
            $this->error('Cleanup failed and was rolled back. No records were deleted.');

            return self::FAILURE;
        }

        Cache::forget('categories.index.first');

        $logs->record(
            'cleared',
            'system',
            'Demo/test business data cleared via console ('.array_sum($counts).' records)',
            null,
            null,
            ['deleted' => $counts]
        );

        $this->info('Done. Deleted '.array_sum($counts).' business record(s). Users, roles, permissions and settings were kept.');

        return self::SUCCESS;
    }
}
