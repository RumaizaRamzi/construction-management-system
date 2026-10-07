<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Cheque;
use App\Models\EquipmentCheck;
use App\Models\Expense;
use App\Models\Income;
use App\Models\MaintenanceRecord;
use App\Models\Product;
use App\Models\Reminder;
use App\Models\Rental;
use App\Models\Sale;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Throwable;

class NotificationAlertService
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly SettingService $settings
    )
    {
    }

    /**
     * Scan active business records and create missing alerts.
     * Safe to run repeatedly — duplicate prevention lives in NotificationService.
     *
     * @return array{created:int, skipped:int, errors:int}
     */
    public function generate(?Carbon $today = null, int $windowDays = 1): array
    {
        $today = ($today ?: Carbon::today())->startOfDay();
        $created = 0;
        $skipped = 0;
        $errors = 0;

        if (! $this->settings->get('enable_notifications', true)) {
            return compact('created', 'skipped', 'errors');
        }

        $bump = function (?object $result) use (&$created, &$skipped) {
            if ($result) {
                $created++;
            } else {
                $skipped++;
            }
        };

        // [label, settings toggle (null = always on), generator]
        $generators = [
            ['low-stock', 'enable_low_stock_alerts', fn () => $this->generateLowStock($bump)],
            ['rental', 'enable_rental_reminders', fn () => $this->generateRentalAlerts($today, $windowDays, $bump)],
            ['payment', 'enable_payment_alerts', fn () => $this->generatePaymentAlerts($today, $bump)],
            ['maintenance', 'enable_maintenance_reminders', fn () => $this->generateMaintenanceAlerts($today, $windowDays, $bump)],
            ['check', null, fn () => $this->generateCheckAlerts($today, $windowDays, $bump)],
            ['cheque', 'enable_payment_alerts', fn () => $this->generateChequeAlerts($today, $bump)],
            ['reminder', null, fn () => $this->generateReminderAlerts($today, $bump)],
            ['booking', 'enable_booking_notifications', fn () => $this->generateBookingAlerts($today, $windowDays, $bump)],
        ];

        foreach ($generators as [$label, $toggle, $run]) {
            if ($toggle !== null && ! $this->settings->get($toggle, true)) {
                continue;
            }
            try {
                $run();
            } catch (Throwable $e) {
                $errors++;
                Log::warning("Notification {$label} generation failed: ".$e->getMessage());
            }
        }

        return compact('created', 'skipped', 'errors');
    }

    private function generateLowStock(callable $bump): void
    {
        Product::query()
            ->whereNotNull('minimum_stock')
            ->whereColumn('available_quantity', '<=', 'minimum_stock')
            ->orderBy('id')
            ->chunkById(100, function ($products) use ($bump) {
                foreach ($products as $product) {
                    $bump($this->notifications->createLowStockNotification($product));
                }
            });
    }

    private function generateRentalAlerts(Carbon $today, int $windowDays, callable $bump): void
    {
        Rental::query()
            ->whereNotNull('expected_return_date')
            ->whereNotIn('status', ['Returned', 'Cancelled', 'Completed'])
            ->whereDate('expected_return_date', '<=', $today->copy()->addDays($windowDays))
            ->orderBy('id')
            ->chunkById(100, function ($rentals) use ($today, $bump) {
                foreach ($rentals as $rental) {
                    $due = Carbon::parse($rental->expected_return_date)->startOfDay();
                    $delta = $today->diffInDays($due, false);

                    if ($delta < 0 || $rental->status === 'Overdue') {
                        $bump($this->notifications->createOverdueRentalNotification($rental));
                    } else {
                        $bump($this->notifications->createRentalReturnDueNotification($rental, (int) $delta));
                    }
                }
            });
    }

    private function generatePaymentAlerts(Carbon $today, callable $bump): void
    {
        Sale::query()
            ->where('balance', '>', 0)
            ->whereNotIn('payment_status', ['Paid'])
            ->orderBy('id')
            ->chunkById(100, function ($sales) use ($bump) {
                foreach ($sales as $sale) {
                    $overdue = in_array($sale->payment_status, ['Overdue'], true);
                    $bump($this->notifications->createPaymentDueNotification(
                        'sale',
                        (int) $sale->id,
                        'Invoice '.($sale->invoice_number ?: '#'.$sale->id),
                        (float) $sale->balance,
                        $overdue
                    ));
                }
            });

        Rental::query()
            ->where('balance', '>', 0)
            ->whereNotIn('payment_status', ['Paid'])
            ->whereNotIn('status', ['Cancelled'])
            ->orderBy('id')
            ->chunkById(100, function ($rentals) use ($bump) {
                foreach ($rentals as $rental) {
                    $overdue = in_array($rental->payment_status, ['Overdue'], true);
                    $bump($this->notifications->createPaymentDueNotification(
                        'rental',
                        (int) $rental->id,
                        'Rental '.($rental->rental_number ?: '#'.$rental->id),
                        (float) $rental->balance,
                        $overdue
                    ));
                }
            });

        Income::query()
            ->where('balance', '>', 0)
            ->whereNotIn('status', ['Paid'])
            ->orderBy('id')
            ->chunkById(100, function ($rows) use ($today, $bump) {
                foreach ($rows as $row) {
                    $overdue = $row->due_date && Carbon::parse($row->due_date)->startOfDay()->lt($today);
                    $bump($this->notifications->createPaymentDueNotification(
                        'income',
                        (int) $row->id,
                        'Income '.($row->reference ?: '#'.$row->id),
                        (float) $row->balance,
                        $overdue || $row->status === 'Overdue'
                    ));
                }
            });

        Expense::query()
            ->where('balance', '>', 0)
            ->whereNotIn('status', ['Paid'])
            ->orderBy('id')
            ->chunkById(100, function ($rows) use ($today, $bump) {
                foreach ($rows as $row) {
                    $overdue = $row->due_date && Carbon::parse($row->due_date)->startOfDay()->lt($today);
                    $bump($this->notifications->createPaymentDueNotification(
                        'expense',
                        (int) $row->id,
                        'Expense '.($row->reference ?: '#'.$row->id),
                        (float) $row->balance,
                        $overdue || $row->status === 'Overdue'
                    ));
                }
            });
    }

    private function generateMaintenanceAlerts(Carbon $today, int $windowDays, callable $bump): void
    {
        $until = $today->copy()->addDays($windowDays);

        MaintenanceRecord::query()
            ->whereNotIn('status', ['Completed', 'Cancelled'])
            ->where(function ($q) use ($today, $until) {
                $q->whereBetween('expected_completion', [$today->toDateString(), $until->toDateString()])
                    ->orWhereBetween('start_date', [$today->toDateString(), $until->toDateString()])
                    ->orWhereBetween('next_maintenance_date', [$today->toDateString(), $until->toDateString()])
                    ->orWhere(function ($q2) use ($today) {
                        $q2->whereNotNull('expected_completion')
                            ->whereDate('expected_completion', '<', $today->toDateString());
                    });
            })
            ->orderBy('id')
            ->chunkById(100, function ($rows) use ($bump) {
                foreach ($rows as $row) {
                    $bump($this->notifications->createMaintenanceDueNotification($row));
                }
            });
    }

    private function generateCheckAlerts(Carbon $today, int $windowDays, callable $bump): void
    {
        $until = $today->copy()->addDays($windowDays);

        EquipmentCheck::query()
            ->whereNotIn('status', ['Completed', 'Cancelled'])
            ->whereNotNull('scheduled_date')
            ->whereDate('scheduled_date', '<=', $until->toDateString())
            ->orderBy('id')
            ->chunkById(100, function ($rows) use ($bump) {
                foreach ($rows as $row) {
                    $bump($this->notifications->createCheckDueNotification($row));
                }
            });
    }

    /** Pending cheques: 3 days before (2–3 days, in case a run was missed), 1 day before, on the date, and overdue. */
    private function generateChequeAlerts(Carbon $today, callable $bump): void
    {
        $cheques = app(ChequeService::class);

        Cheque::query()
            ->with(['customer:id,name', 'supplier:id,name'])
            ->where('status', Cheque::STATUS_PENDING)
            ->whereDate('cheque_date', '<=', $today->copy()->addDays(3)->toDateString())
            ->orderBy('id')
            ->chunkById(100, function ($rows) use ($today, $bump, $cheques) {
                foreach ($rows as $cheque) {
                    $delta = (int) $today->diffInDays(Carbon::parse($cheque->cheque_date)->startOfDay(), false);
                    $bump($this->notifications->createChequeReminderNotification($cheque, $cheques->describe($cheque), $delta));
                }
            });
    }

    private function generateReminderAlerts(Carbon $today, callable $bump): void
    {
        Reminder::query()
            ->pending()
            ->whereDate('due_date', '<=', $today->toDateString())
            ->orderBy('id')
            ->chunkById(100, function ($rows) use ($bump) {
                foreach ($rows as $row) {
                    $bump($this->notifications->createReminderNotification($row));
                }
            });
    }

    private function generateBookingAlerts(Carbon $today, int $windowDays, callable $bump): void
    {
        $until = $today->copy()->addDays($windowDays);

        Booking::query()
            ->whereIn('status', ['Pending', 'Confirmed'])
            ->whereNotNull('start_date')
            ->whereDate('start_date', '>=', $today->toDateString())
            ->whereDate('start_date', '<=', $until->toDateString())
            ->orderBy('id')
            ->chunkById(100, function ($rows) use ($today, $bump) {
                foreach ($rows as $row) {
                    $start = Carbon::parse($row->start_date)->startOfDay();
                    $delta = (int) $today->diffInDays($start, false);
                    $bump($this->notifications->createBookingReminderNotification($row, $delta));
                }
            });
    }
}
