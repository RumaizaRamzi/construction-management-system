<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\EquipmentCheck;
use App\Models\Expense;
use App\Models\Income;
use App\Models\MaintenanceRecord;
use App\Models\Product;
use App\Models\Rental;
use App\Models\RentalItem;
use App\Models\Sale;
use App\Models\SaleItem;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class ReportService
{
    private const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    /**
     * @return array{from:string,to:string}
     */
    public function resolveDateRange(?string $from, ?string $to, ?string $preset = null): array
    {
        $today = Carbon::today();

        if ($preset && ! $from && ! $to) {
            [$from, $to] = match ($preset) {
                'today' => [$today->toDateString(), $today->toDateString()],
                'this_week' => [$today->copy()->startOfWeek(Carbon::MONDAY)->toDateString(), $today->toDateString()],
                'this_month' => [$today->copy()->startOfMonth()->toDateString(), $today->toDateString()],
                'last_month' => [
                    $today->copy()->subMonthNoOverflow()->startOfMonth()->toDateString(),
                    $today->copy()->subMonthNoOverflow()->endOfMonth()->toDateString(),
                ],
                'this_quarter' => [$today->copy()->firstOfQuarter()->toDateString(), $today->toDateString()],
                'this_year' => [$today->copy()->startOfYear()->toDateString(), $today->toDateString()],
                default => [$today->copy()->startOfMonth()->toDateString(), $today->toDateString()],
            };
        }

        $from = $from ?: $today->copy()->startOfMonth()->toDateString();
        $to = $to ?: $today->toDateString();

        try {
            $fromDate = Carbon::parse($from)->startOfDay();
            $toDate = Carbon::parse($to)->startOfDay();
        } catch (\Throwable) {
            throw ValidationException::withMessages([
                'from' => ['Invalid date range.'],
            ]);
        }

        if ($fromDate->gt($toDate)) {
            throw ValidationException::withMessages([
                'from' => ['The from date must be before or equal to the to date.'],
            ]);
        }

        return [
            'from' => $fromDate->toDateString(),
            'to' => $toDate->toDateString(),
        ];
    }

    public function dashboard(string $from, string $to): array
    {
        $sales = $this->salesInRange($from, $to);
        $rentals = $this->rentalsInRange($from, $to);
        $income = $this->incomeInRange($from, $to);
        $expenses = $this->expensesInRange($from, $to);

        $totalSales = round((float) $sales->sum('total_amount'), 2);
        $rentalIncome = round((float) $rentals->sum('total_amount'), 2);
        $totalIncome = round((float) $income->sum('amount'), 2);
        $totalExpenses = round((float) $expenses->sum('amount'), 2);
        $netCashFlow = round($totalIncome - $totalExpenses, 2);

        $products = Product::query()->with('category')->get();
        $lowStock = $products->filter(function (Product $p) {
            return (int) $p->available_quantity <= (int) ($p->minimum_stock ?? 0);
        })->values();

        $monthly = $this->monthlyCashFlow($from, $to, $income, $expenses);
        $salesVsRental = $this->monthlySalesVsRental($from, $to, $sales, $rentals);
        $productUsage = $this->topProductUsage(8);

        return [
            'range' => compact('from', 'to'),
            'summary' => [
                'total_sales' => $totalSales,
                'total_rental_income' => $rentalIncome,
                'total_income' => $totalIncome,
                'total_expenses' => $totalExpenses,
                'net_cash_flow' => $netCashFlow,
                'outstanding_income' => round((float) Income::query()->where('balance', '>', 0)->sum('balance'), 2),
                'outstanding_expenses' => round((float) Expense::query()->where('balance', '>', 0)->sum('balance'), 2),
                'total_customers' => Customer::query()->count(),
                'total_products' => $products->count(),
                'inventory_value' => round($products->sum(fn (Product $p) => (float) $p->purchase_price * (int) $p->quantity), 2),
                'active_rentals' => Rental::query()->whereIn('status', ['Active', 'Confirmed', 'Overdue'])->count(),
                'pending_bookings' => Booking::query()->where('status', 'Pending')->count(),
                'low_stock_count' => $lowStock->count(),
                'upcoming_checks' => EquipmentCheck::query()
                    ->whereNotIn('status', ['Completed', 'Cancelled'])
                    ->whereDate('scheduled_date', '>=', Carbon::today())
                    ->whereDate('scheduled_date', '<=', Carbon::today()->addDays(7))
                    ->count(),
            ],
            'low_stock' => $lowStock->take(10)->map(fn (Product $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'serial_number' => $p->serial_number,
                'available' => (int) $p->available_quantity,
                'minimum_stock' => (int) ($p->minimum_stock ?? 0),
            ])->all(),
            'charts' => [
                'sales_vs_rental' => $salesVsRental,
                'monthly_revenue' => collect($salesVsRental)->map(fn ($row) => [
                    'month' => $row['month'],
                    'revenue' => round(($row['sales'] ?? 0) + ($row['rental'] ?? 0), 2),
                ])->all(),
                'income_vs_expenses' => collect($monthly)->map(fn ($row) => [
                    'month' => $row['month'],
                    'income' => $row['income'],
                    'expenses' => $row['expenses'],
                ])->all(),
                'monthly_cash_flow' => $monthly,
                'income_by_source' => $this->incomeBySource($income),
                'expenses_by_category' => $this->expensesByCategory($expenses),
                'product_usage' => $productUsage,
                'rental_activity' => $this->rentalActivityWeek(),
            ],
            'recent_sales' => $sales->sortByDesc('sale_date')->take(5)->values()->map(fn (Sale $s) => $this->transformSale($s))->all(),
            'recent_rentals' => $rentals->sortByDesc('start_date')->take(5)->values()->map(fn (Rental $r) => $this->transformRental($r))->all(),
            'recent_activity' => $this->recentActivity(15),
        ];
    }

    public function summary(string $from, string $to): array
    {
        $dashboard = $this->dashboard($from, $to);
        $sales = $this->salesInRange($from, $to);
        $rentals = $this->rentalsInRange($from, $to);
        $income = $this->incomeInRange($from, $to);
        $expenses = $this->expensesInRange($from, $to);

        return [
            'range' => compact('from', 'to'),
            'total_sales' => $dashboard['summary']['total_sales'],
            'rental_income' => $dashboard['summary']['total_rental_income'],
            'total_income' => $dashboard['summary']['total_income'],
            'total_expenses' => $dashboard['summary']['total_expenses'],
            'net_cash_flow' => $dashboard['summary']['net_cash_flow'],
            'total_transactions' => $sales->count() + $rentals->count() + $income->count() + $expenses->count(),
            'outstanding_payments' => round(
                (float) Sale::query()->where('balance', '>', 0)->whereNotIn('sale_status', ['Cancelled', 'Refunded'])->sum('balance')
                + (float) Rental::query()->where('balance', '>', 0)->where('status', '!=', 'Cancelled')->sum('balance')
                + (float) Income::query()->where('balance', '>', 0)->sum('balance')
                + (float) Expense::query()->where('balance', '>', 0)->sum('balance'),
                2
            ),
            'outstanding' => $this->outstandingPayments(),
            'recent_activity' => $dashboard['recent_activity'],
            'summary' => $dashboard['summary'],
            'preview' => [
                'sales_count' => $sales->count(),
                'rentals_count' => $rentals->count(),
                'available_quantity' => (int) Product::query()->sum('available_quantity'),
                'rented_quantity' => (int) Product::query()->sum('rented_quantity'),
            ],
            'charts' => [
                'monthly_cash_flow' => $dashboard['charts']['monthly_cash_flow'],
                'income_by_source' => $dashboard['charts']['income_by_source'],
                'expenses_by_category' => $dashboard['charts']['expenses_by_category'],
            ],
        ];
    }

    public function sales(string $from, string $to): array
    {
        $sales = $this->salesInRange($from, $to)->load(['customer', 'items.product']);
        $revenue = round((float) $sales->sum('total_amount'), 2);
        $paid = round((float) $sales->sum('paid_amount'), 2);
        $outstanding = round((float) $sales->sum('balance'), 2);
        $count = $sales->count();

        $byProduct = [];
        foreach ($sales as $sale) {
            foreach ($sale->items as $item) {
                $pid = $item->product_id ?: 0;
                if (! isset($byProduct[$pid])) {
                    $byProduct[$pid] = [
                        'product_id' => $item->product_id,
                        'product' => $item->product?->name ?: 'Unknown',
                        'serial_number' => $item->product?->serial_number ?: '—',
                        'quantity_sold' => 0,
                        'revenue' => 0,
                        'number_of_sales' => 0,
                    ];
                }
                $byProduct[$pid]['quantity_sold'] += (int) $item->quantity;
                $byProduct[$pid]['revenue'] += (float) $item->subtotal;
                $byProduct[$pid]['number_of_sales'] += 1;
            }
        }

        $byCustomer = [];
        foreach ($sales as $sale) {
            $cid = $sale->customer_id ?: 0;
            if (! isset($byCustomer[$cid])) {
                $byCustomer[$cid] = [
                    'customer_id' => $sale->customer_id,
                    'customer' => $sale->customer?->name ?: 'Unknown',
                    'transaction_count' => 0,
                    'revenue' => 0,
                    'paid' => 0,
                    'outstanding' => 0,
                ];
            }
            $byCustomer[$cid]['transaction_count'] += 1;
            $byCustomer[$cid]['revenue'] += (float) $sale->total_amount;
            $byCustomer[$cid]['paid'] += (float) $sale->paid_amount;
            $byCustomer[$cid]['outstanding'] += (float) $sale->balance;
        }

        return [
            'range' => compact('from', 'to'),
            'summary' => [
                'total_sales' => $count,
                'total_revenue' => $revenue,
                'sales_revenue' => $revenue,
                'total_paid' => $paid,
                'paid_amount' => $paid,
                'total_outstanding' => $outstanding,
                'outstanding_amount' => $outstanding,
                'total_transactions' => $count,
                'average_sale_value' => $count ? round($revenue / $count, 2) : 0,
                'items_sold' => (int) SaleItem::query()
                    ->whereIn('sale_id', $sales->pluck('id'))
                    ->sum('quantity'),
            ],
            'transactions' => $sales->sortByDesc('sale_date')->values()->map(fn (Sale $s) => $this->transformSale($s))->all(),
            'by_product' => collect($byProduct)->sortByDesc('quantity_sold')->values()->all(),
            'by_customer' => collect($byCustomer)->sortByDesc('revenue')->values()->all(),
            'payment_status' => $this->groupPaymentStatus($sales, 'payment_status'),
            'monthly' => $this->monthlySalesSeries($from, $to, $sales),
        ];
    }

    public function rentals(string $from, string $to): array
    {
        $allRentals = $this->rentalsInRange($from, $to, true);
        $rentals = $allRentals->where('status', '!=', 'Cancelled')->values();
        $income = round((float) $rentals->sum('total_amount'), 2);
        $paid = round((float) $rentals->sum('paid_amount'), 2);
        $outstanding = round((float) $rentals->sum('balance'), 2);

        $allActive = Rental::query()->whereIn('status', ['Active', 'Confirmed', 'Overdue'])->count();
        $overdue = Rental::query()
            ->whereNotIn('status', ['Returned', 'Cancelled', 'Completed'])
            ->whereDate('expected_return_date', '<', Carbon::today())
            ->count();

        return [
            'range' => compact('from', 'to'),
            'summary' => [
                'total_rentals' => $allRentals->count(),
                'cancelled_rentals' => $allRentals->count() - $rentals->count(),
                'total_rental_income' => $income,
                'paid_rental_income' => $paid,
                'outstanding_rental_income' => $outstanding,
                'active_rentals' => $allActive,
                'overdue_rentals' => $overdue,
                'completed_rentals' => Rental::query()->whereIn('status', ['Returned', 'Completed'])->count(),
            ],
            'transactions' => $allRentals->sortByDesc('start_date')->values()->map(fn (Rental $r) => $this->transformRental($r))->all(),
            'status_summary' => $this->groupCounts($allRentals, 'status'),
            'payment_status' => $this->groupPaymentStatus($rentals, 'payment_status'),
            'usage' => $this->rentalUsage($rentals),
            'overdue' => $this->overdueRentals(),
            'monthly' => $this->monthlyRentalSeries($from, $to, $rentals),
        ];
    }

    public function inventory(): array
    {
        $products = Product::query()->with('category')->orderBy('name')->get();
        $maintenanceActive = MaintenanceRecord::query()
            ->whereIn('status', ['Scheduled', 'In Progress', 'On Hold'])
            ->pluck('product_id')
            ->unique()
            ->flip();

        $rows = $products->map(function (Product $p) use ($maintenanceActive) {
            $available = (int) $p->available_quantity;
            $rented = (int) $p->rented_quantity;
            $total = (int) $p->quantity;
            $inMaintenance = $maintenanceActive->has($p->id) ? max(0, $total - $available - $rented) : 0;
            $status = $p->status;
            if ($available <= 0 && $rented <= 0) {
                $status = $status ?: 'Out of Stock';
            } elseif ($available <= (int) ($p->minimum_stock ?? 0)) {
                $status = $status === 'Maintenance' ? $status : 'Low Stock';
            }

            return [
                'id' => $p->id,
                'product' => $p->name,
                'serial_number' => $p->serial_number,
                'category' => $p->category?->name ?: '—',
                'total_quantity' => $total,
                'available_quantity' => $available,
                'rented_quantity' => $rented,
                'maintenance_quantity' => $inMaintenance,
                'sold_quantity' => max(0, $total - $available - $rented - $inMaintenance),
                'status' => $status,
                'minimum_stock' => (int) ($p->minimum_stock ?? 0),
            ];
        });

        $lowStock = $rows->filter(fn ($r) => $r['available_quantity'] <= $r['minimum_stock'])->count();
        $outOfStock = $rows->filter(fn ($r) => $r['available_quantity'] <= 0)->count();

        return [
            'summary' => [
                'total_products' => $rows->count(),
                'total_quantity' => $rows->sum('total_quantity'),
                'available_quantity' => $rows->sum('available_quantity'),
                'rented_quantity' => $rows->sum('rented_quantity'),
                'sold_quantity' => $rows->sum('sold_quantity'),
                'maintenance_quantity' => $rows->sum('maintenance_quantity'),
                'low_stock_count' => $lowStock,
                'out_of_stock_count' => $outOfStock,
            ],
            'products' => $rows->values()->all(),
        ];
    }

    public function inventoryUsage(string $from, string $to): array
    {
        $sales = $this->salesInRange($from, $to)->load('items');
        $rentals = $this->rentalsInRange($from, $to)->load('items.product');
        $products = Product::query()->get()->keyBy('id');

        $map = [];
        foreach ($sales as $sale) {
            foreach ($sale->items as $item) {
                $id = (int) $item->product_id;
                if (! isset($map[$id])) {
                    $map[$id] = $this->emptyUsageRow($products->get($id), $id);
                }
                $map[$id]['sales_quantity'] += (int) $item->quantity;
                $map[$id]['total_revenue'] += (float) $item->subtotal;
                $map[$id]['last_usage_date'] = max((string) $map[$id]['last_usage_date'], optional($sale->sale_date)?->toDateString() ?: '');
            }
        }
        foreach ($rentals as $rental) {
            foreach ($rental->items as $item) {
                $id = (int) $item->product_id;
                if (! isset($map[$id])) {
                    $map[$id] = $this->emptyUsageRow($products->get($id), $id);
                }
                $map[$id]['rental_quantity'] += (int) $item->quantity;
                $map[$id]['rental_count'] += 1;
                $map[$id]['rental_days'] += (int) ($item->rental_days ?: 0);
                $map[$id]['total_revenue'] += (float) $item->subtotal;
                $map[$id]['last_usage_date'] = max((string) $map[$id]['last_usage_date'], optional($rental->start_date)?->toDateString() ?: '');
            }
        }

        return [
            'range' => compact('from', 'to'),
            'usage' => collect($map)->sortByDesc('total_revenue')->values()->all(),
        ];
    }

    public function equipment(): array
    {
        $products = Product::query()->with('category')->orderBy('name')->get();
        $rentalItems = RentalItem::query()
            ->with('rental')
            ->whereHas('rental', fn ($q) => $q->where('status', '!=', 'Cancelled'))
            ->get()
            ->groupBy('product_id');
        $maintenance = MaintenanceRecord::query()->get()->groupBy('product_id');
        $checks = EquipmentCheck::query()->get()->groupBy('product_id');

        $rows = $products->map(function (Product $p) use ($rentalItems, $maintenance, $checks) {
            $items = $rentalItems->get($p->id, collect());
            $maint = $maintenance->get($p->id, collect());
            $chk = $checks->get($p->id, collect());

            return [
                'id' => $p->id,
                'product' => $p->name,
                'serial_number' => $p->serial_number,
                'status' => $p->status,
                'condition' => $p->condition,
                'total_quantity' => (int) $p->quantity,
                'available_quantity' => (int) $p->available_quantity,
                'rental_count' => $items->pluck('rental_id')->unique()->count(),
                'rental_income' => round((float) $items->sum('subtotal'), 2),
                'maintenance_count' => $maint->count(),
                'maintenance_cost' => round((float) $maint->sum(fn ($m) => (float) ($m->cost ?? $m->estimated_cost ?? 0)), 2),
                'check_count' => $chk->count(),
                'last_maintenance_date' => optional($maint->sortByDesc('start_date')->first()?->start_date)?->toDateString(),
                'last_check_date' => optional($chk->sortByDesc('scheduled_date')->first()?->scheduled_date)?->toDateString(),
                'created_at' => optional($p->created_at)?->toDateString(),
            ];
        });

        return [
            'equipment' => $rows->values()->all(),
            'lifecycle' => $rows->map(fn ($row) => [
                ...$row,
                'purchase_date' => $row['created_at'],
                'sales_history_count' => (int) SaleItem::query()->where('product_id', $row['id'])->count(),
                'rental_history_count' => $row['rental_count'],
                'maintenance_history_count' => $row['maintenance_count'],
                'check_history_count' => $row['check_count'],
            ])->values()->all(),
        ];
    }

    public function financial(string $from, string $to): array
    {
        $income = $this->incomeInRange($from, $to)->load(['customer', 'payments']);
        $expenses = $this->expensesInRange($from, $to)->load(['supplier', 'payments']);

        $totalIncome = round((float) $income->sum('amount'), 2);
        $totalExpenses = round((float) $expenses->sum('amount'), 2);
        $paidIncome = round((float) $income->sum('paid_amount'), 2);
        $paidExpenses = round((float) $expenses->sum('paid_amount'), 2);

        return [
            'range' => compact('from', 'to'),
            'summary' => [
                'total_income' => $totalIncome,
                'total_expenses' => $totalExpenses,
                'net_cash_flow' => round($totalIncome - $totalExpenses, 2),
                'paid_income' => $paidIncome,
                'outstanding_income' => round((float) $income->sum('balance'), 2),
                'paid_expenses' => $paidExpenses,
                'outstanding_expenses' => round((float) $expenses->sum('balance'), 2),
            ],
            'income_transactions' => $income->sortByDesc('date')->values()->map(fn (Income $i) => $this->transformIncome($i))->all(),
            'expense_transactions' => $expenses->sortByDesc('date')->values()->map(fn (Expense $e) => $this->transformExpense($e))->all(),
            'income_by_source' => $this->incomeBySource($income),
            'expenses_by_category' => $this->expensesByCategory($expenses),
            'income_payment_status' => $this->groupPaymentStatus($income, 'status'),
            'expense_payment_status' => $this->groupPaymentStatus($expenses, 'status'),
            'monthly_cash_flow' => $this->monthlyCashFlow($from, $to, $income, $expenses),
            'outstanding_income' => $income->where('balance', '>', 0)->values()->map(fn (Income $i) => $this->transformIncome($i))->all(),
            'outstanding_expenses' => $expenses->where('balance', '>', 0)->values()->map(fn (Expense $e) => $this->transformExpense($e))->all(),
        ];
    }

    public function customers(string $from, string $to): array
    {
        $customers = Customer::query()->orderBy('name')->get();
        $sales = $this->salesInRange($from, $to);
        $rentals = $this->rentalsInRange($from, $to);

        $rows = $customers->map(function (Customer $c) use ($sales, $rentals) {
            $cSales = $sales->where('customer_id', $c->id);
            $cRentals = $rentals->where('customer_id', $c->id);
            $lastSale = optional($cSales->sortByDesc('sale_date')->first()?->sale_date)?->toDateString();
            $lastRental = optional($cRentals->sortByDesc('start_date')->first()?->start_date)?->toDateString();

            return [
                'id' => $c->id,
                'name' => $c->name,
                'company' => $c->company_name,
                'customer_type' => $c->customer_type,
                'status' => $c->status,
                'phone' => $c->phone,
                'email' => $c->email,
                'sales_count' => $cSales->count(),
                'sales_revenue' => round((float) $cSales->sum('total_amount'), 2),
                'rental_count' => $cRentals->count(),
                'rental_revenue' => round((float) $cRentals->sum('total_amount'), 2),
                'outstanding_balance' => round(
                    (float) $cSales->sum('balance') + (float) $cRentals->sum('balance'),
                    2
                ),
                'last_transaction_date' => max($lastSale ?: '', $lastRental ?: '') ?: null,
            ];
        });

        return [
            'range' => compact('from', 'to'),
            'summary' => [
                'total_customers' => $customers->count(),
                'active_customers' => $customers->where('status', 'Active')->count(),
                'inactive_customers' => $customers->where('status', '!=', 'Active')->count(),
                'individual_customers' => $customers->filter(fn ($c) => strcasecmp((string) $c->customer_type, 'Company') !== 0)->count(),
                'company_customers' => $customers->filter(fn ($c) => strcasecmp((string) $c->customer_type, 'Company') === 0)->count(),
            ],
            'customers' => $rows->values()->all(),
        ];
    }

    public function customerDetails(int $customerId, string $from, string $to): array
    {
        $customer = Customer::query()->findOrFail($customerId);
        $sales = Sale::query()
            ->with(['items', 'payments'])
            ->where('customer_id', $customerId)
            ->whereDate('sale_date', '>=', $from)
            ->whereDate('sale_date', '<=', $to)
            ->whereNotIn('sale_status', ['Cancelled', 'Refunded'])
            ->orderByDesc('sale_date')
            ->get();
        $rentals = Rental::query()
            ->with(['items.product', 'payments'])
            ->where('customer_id', $customerId)
            ->where('status', '!=', 'Cancelled')
            ->where(function ($q) use ($from, $to) {
                $q->whereBetween('start_date', [$from, $to])
                    ->orWhereBetween('expected_return_date', [$from, $to]);
            })
            ->orderByDesc('start_date')
            ->get();
        $income = Income::query()
            ->with('payments')
            ->where('customer_id', $customerId)
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->orderByDesc('date')
            ->get();

        $payments = [];
        foreach ($sales as $sale) {
            foreach ($sale->payments as $p) {
                $payments[] = [
                    'type' => 'Sale Payment',
                    'payment_date' => optional($p->payment_date)?->toDateString(),
                    'amount' => (float) $p->amount,
                    'payment_method' => $p->payment_method,
                    'reference' => $p->reference,
                    'related' => $sale->invoice_number,
                ];
            }
        }
        foreach ($rentals as $rental) {
            foreach ($rental->payments as $p) {
                $payments[] = [
                    'type' => 'Rental Payment',
                    'payment_date' => optional($p->payment_date)?->toDateString(),
                    'amount' => (float) $p->amount,
                    'payment_method' => $p->payment_method,
                    'reference' => $p->reference,
                    'related' => $rental->rental_number,
                ];
            }
        }
        foreach ($income as $row) {
            foreach ($row->payments as $p) {
                $payments[] = [
                    'type' => 'Income Payment',
                    'payment_date' => optional($p->payment_date)?->toDateString(),
                    'amount' => (float) $p->amount,
                    'payment_method' => $p->payment_method,
                    'reference' => $p->reference,
                    'related' => $row->reference,
                ];
            }
        }
        usort($payments, fn ($a, $b) => strcmp((string) $b['payment_date'], (string) $a['payment_date']));

        $timeline = [];
        foreach ($sales as $s) {
            $timeline[] = [
                'type' => 'Sale',
                'description' => 'Invoice '.($s->invoice_number ?: '#'.$s->id),
                'date' => optional($s->sale_date)?->toDateString(),
                'related_id' => $s->id,
                'amount' => (float) $s->total_amount,
            ];
        }
        foreach ($rentals as $r) {
            $timeline[] = [
                'type' => 'Rental',
                'description' => 'Rental '.($r->rental_number ?: '#'.$r->id),
                'date' => optional($r->start_date)?->toDateString(),
                'related_id' => $r->id,
                'amount' => (float) $r->total_amount,
            ];
        }
        foreach ($income as $i) {
            $timeline[] = [
                'type' => 'Income',
                'description' => $i->description ?: ($i->reference ?: 'Income #'.$i->id),
                'date' => optional($i->date)?->toDateString(),
                'related_id' => $i->id,
                'amount' => (float) $i->amount,
            ];
        }
        usort($timeline, fn ($a, $b) => strcmp((string) $b['date'], (string) $a['date']));

        return [
            'range' => compact('from', 'to'),
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'company' => $customer->company_name,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'address' => trim(($customer->address ?: '').' '.($customer->city ?: '')),
                'status' => $customer->status,
                'customer_type' => $customer->customer_type,
            ],
            'sales' => $sales->map(fn (Sale $s) => $this->transformSale($s))->all(),
            'rentals' => $rentals->map(fn (Rental $r) => $this->transformRental($r))->all(),
            'payments' => $payments,
            'activity_timeline' => $timeline,
            'summary' => [
                'sales_count' => $sales->count(),
                'sales_revenue' => round((float) $sales->sum('total_amount'), 2),
                'rental_count' => $rentals->count(),
                'rental_revenue' => round((float) $rentals->sum('total_amount'), 2),
                'outstanding_balance' => round(
                    (float) $sales->sum('balance') + (float) $rentals->sum('balance'),
                    2
                ),
            ],
        ];
    }

    /* -------------------- helpers -------------------- */

    private function salesInRange(string $from, string $to): Collection
    {
        return Sale::query()
            ->with('customer')
            ->whereDate('sale_date', '>=', $from)
            ->whereDate('sale_date', '<=', $to)
            ->whereNotIn('sale_status', ['Cancelled', 'Refunded'])
            ->get();
    }

    private function rentalsInRange(string $from, string $to, bool $includeCancelled = false): Collection
    {
        return Rental::query()
            ->with(['customer', 'items.product'])
            ->where(function ($q) use ($from, $to) {
                $q->whereBetween('start_date', [$from, $to])
                    ->orWhereBetween('expected_return_date', [$from, $to]);
            })
            ->when(! $includeCancelled, fn ($q) => $q->where('status', '!=', 'Cancelled'))
            ->get();
    }

    private function incomeInRange(string $from, string $to): Collection
    {
        return Income::query()
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->get();
    }

    private function expensesInRange(string $from, string $to): Collection
    {
        return Expense::query()
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->get();
    }

    private function monthBuckets(string $from, string $to): array
    {
        $start = Carbon::parse($from)->startOfMonth();
        $end = Carbon::parse($to)->startOfMonth();
        $buckets = [];
        while ($start->lte($end)) {
            $key = $start->format('Y-m');
            $buckets[$key] = [
                'month' => $start->format('M'),
                'month_full' => self::MONTHS[$start->month - 1],
                'month_key' => $key,
                'income' => 0.0,
                'expenses' => 0.0,
                'net_cash_flow' => 0.0,
                'sales' => 0.0,
                'rental' => 0.0,
                'revenue' => 0.0,
                'transaction_count' => 0,
            ];
            $start->addMonth();
        }

        return $buckets;
    }

    private function monthlyCashFlow(string $from, string $to, Collection $income, Collection $expenses): array
    {
        $buckets = $this->monthBuckets($from, $to);
        foreach ($income as $row) {
            $key = optional($row->date)?->format('Y-m');
            if ($key && isset($buckets[$key])) {
                $buckets[$key]['income'] += (float) $row->amount;
            }
        }
        foreach ($expenses as $row) {
            $key = optional($row->date)?->format('Y-m');
            if ($key && isset($buckets[$key])) {
                $buckets[$key]['expenses'] += (float) $row->amount;
            }
        }
        foreach ($buckets as &$bucket) {
            $bucket['income'] = round($bucket['income'], 2);
            $bucket['expenses'] = round($bucket['expenses'], 2);
            $bucket['net_cash_flow'] = round($bucket['income'] - $bucket['expenses'], 2);
            $bucket['netCashFlow'] = $bucket['net_cash_flow'];
            $bucket['monthFull'] = $bucket['month_full'];
            $bucket['monthKey'] = $bucket['month_key'];
        }

        return array_values($buckets);
    }

    private function monthlySalesVsRental(string $from, string $to, Collection $sales, Collection $rentals): array
    {
        $buckets = $this->monthBuckets($from, $to);
        foreach ($sales as $sale) {
            $key = optional($sale->sale_date)?->format('Y-m');
            if ($key && isset($buckets[$key])) {
                $buckets[$key]['sales'] += (float) $sale->total_amount;
            }
        }
        foreach ($rentals as $rental) {
            $key = optional($rental->start_date)?->format('Y-m');
            if ($key && isset($buckets[$key])) {
                $buckets[$key]['rental'] += (float) $rental->total_amount;
            }
        }

        return collect($buckets)->map(fn ($b) => [
            'month' => $b['month'],
            'sales' => round($b['sales'], 2),
            'rental' => round($b['rental'], 2),
        ])->values()->all();
    }

    private function monthlySalesSeries(string $from, string $to, Collection $sales): array
    {
        $buckets = $this->monthBuckets($from, $to);
        foreach ($sales as $sale) {
            $key = optional($sale->sale_date)?->format('Y-m');
            if ($key && isset($buckets[$key])) {
                $buckets[$key]['revenue'] += (float) $sale->total_amount;
                $buckets[$key]['transaction_count'] += 1;
            }
        }

        return collect($buckets)->map(fn ($b) => [
            'month' => $b['month'],
            'monthFull' => $b['month_full'],
            'monthKey' => $b['month_key'],
            'revenue' => round($b['revenue'], 2),
            'transaction_count' => $b['transaction_count'],
        ])->values()->all();
    }

    private function monthlyRentalSeries(string $from, string $to, Collection $rentals): array
    {
        $buckets = $this->monthBuckets($from, $to);
        foreach ($rentals as $rental) {
            $key = optional($rental->start_date)?->format('Y-m');
            if ($key && isset($buckets[$key])) {
                $buckets[$key]['revenue'] += (float) $rental->total_amount;
                $buckets[$key]['transaction_count'] += 1;
            }
        }

        return collect($buckets)->map(fn ($b) => [
            'month' => $b['month'],
            'monthFull' => $b['month_full'],
            'monthKey' => $b['month_key'],
            'income' => round($b['revenue'], 2),
            'transaction_count' => $b['transaction_count'],
        ])->values()->all();
    }

    private function incomeBySource(Collection $income): array
    {
        $total = max(0.01, (float) $income->sum('amount'));
        return $income->groupBy(fn ($i) => $i->source ?: 'Other')
            ->map(function ($rows, $source) use ($total) {
                $amount = round((float) $rows->sum('amount'), 2);

                return [
                    'source' => $source,
                    'name' => $source,
                    'amount' => $amount,
                    'value' => $amount,
                    'percentage' => round(($amount / $total) * 100, 1),
                ];
            })
            ->sortByDesc('amount')
            ->values()
            ->all();
    }

    private function expensesByCategory(Collection $expenses): array
    {
        $total = max(0.01, (float) $expenses->sum('amount'));

        return $expenses->groupBy(fn ($e) => $e->category ?: 'Other Expense')
            ->map(function ($rows, $category) use ($total) {
                $amount = round((float) $rows->sum('amount'), 2);

                return [
                    'category' => $category,
                    'name' => $category,
                    'amount' => $amount,
                    'value' => $amount,
                    'percentage' => round(($amount / $total) * 100, 1),
                ];
            })
            ->sortByDesc('amount')
            ->values()
            ->all();
    }

    private function groupPaymentStatus(Collection $rows, string $field): array
    {
        $groups = ['Paid' => 0, 'Partial' => 0, 'Pending' => 0, 'Overdue' => 0];
        foreach ($rows as $row) {
            $status = $row->{$field} ?: 'Pending';
            if (! isset($groups[$status])) {
                $groups[$status] = 0;
            }
            $groups[$status]++;
        }

        return collect($groups)->map(fn ($count, $status) => [
            'status' => $status,
            'name' => $status,
            'count' => $count,
            'value' => $count,
        ])->values()->all();
    }

    private function groupCounts(Collection $rows, string $field): array
    {
        return $rows->groupBy($field)
            ->map(fn ($group, $status) => [
                'status' => $status ?: 'Unknown',
                'name' => $status ?: 'Unknown',
                'count' => $group->count(),
                'value' => $group->count(),
            ])
            ->values()
            ->all();
    }

    private function rentalUsage(Collection $rentals): array
    {
        $map = [];
        foreach ($rentals as $rental) {
            foreach ($rental->items as $item) {
                $id = (int) $item->product_id;
                if (! isset($map[$id])) {
                    $map[$id] = [
                        'product_id' => $id,
                        'product' => $item->product?->name ?: 'Unknown',
                        'rental_count' => 0,
                        'total_rented_quantity' => 0,
                        'rental_days' => 0,
                        'rental_income' => 0,
                    ];
                }
                $map[$id]['rental_count'] += 1;
                $map[$id]['total_rented_quantity'] += (int) $item->quantity;
                $map[$id]['rental_days'] += (int) ($item->rental_days ?: 0);
                $map[$id]['rental_income'] += (float) $item->subtotal;
            }
        }

        return collect($map)->map(function ($row) {
            $row['rental_income'] = round($row['rental_income'], 2);

            return $row;
        })->sortByDesc('rental_income')->values()->all();
    }

    private function overdueRentals(): array
    {
        $today = Carbon::today();

        return Rental::query()
            ->with(['customer', 'items.product'])
            ->whereNotIn('status', ['Returned', 'Cancelled', 'Completed'])
            ->whereDate('expected_return_date', '<', $today)
            ->orderBy('expected_return_date')
            ->get()
            ->map(function (Rental $r) use ($today) {
                $product = $r->items->first()?->product?->name ?: '—';

                return [
                    'id' => $r->id,
                    'rental_number' => $r->rental_number,
                    'customer' => $r->customer?->name,
                    'product' => $product,
                    'expected_return' => optional($r->expected_return_date)?->toDateString(),
                    'overdue_days' => $r->expected_return_date
                        ? $r->expected_return_date->diffInDays($today)
                        : 0,
                    'amount' => (float) $r->total_amount,
                    'balance' => (float) $r->balance,
                    'status' => $r->status,
                ];
            })
            ->all();
    }

    private function outstandingPayments(): array
    {
        $rows = [];
        foreach (Sale::query()->with('customer')->where('balance', '>', 0)->whereNotIn('sale_status', ['Cancelled', 'Refunded'])->get() as $sale) {
            $rows[] = [
                'type' => 'Sale',
                'reference' => $sale->invoice_number,
                'party' => $sale->customer?->name,
                'date' => optional($sale->sale_date)?->toDateString(),
                'total' => (float) $sale->total_amount,
                'paid' => (float) $sale->paid_amount,
                'balance' => (float) $sale->balance,
                'status' => $sale->payment_status,
                'related_id' => $sale->id,
            ];
        }
        foreach (Rental::query()->with('customer')->where('balance', '>', 0)->where('status', '!=', 'Cancelled')->get() as $rental) {
            $rows[] = [
                'type' => 'Rental',
                'reference' => $rental->rental_number,
                'party' => $rental->customer?->name,
                'date' => optional($rental->start_date)?->toDateString(),
                'total' => (float) $rental->total_amount,
                'paid' => (float) $rental->paid_amount,
                'balance' => (float) $rental->balance,
                'status' => $rental->payment_status,
                'related_id' => $rental->id,
            ];
        }
        foreach (Income::query()->with('customer')->where('balance', '>', 0)->get() as $income) {
            $rows[] = [
                'type' => 'Income',
                'reference' => $income->reference,
                'party' => $income->customer?->name,
                'date' => optional($income->date)?->toDateString(),
                'total' => (float) $income->amount,
                'paid' => (float) $income->paid_amount,
                'balance' => (float) $income->balance,
                'status' => $income->status,
                'related_id' => $income->id,
            ];
        }
        foreach (Expense::query()->with('supplier')->where('balance', '>', 0)->get() as $expense) {
            $rows[] = [
                'type' => 'Expense',
                'reference' => $expense->reference,
                'party' => $expense->supplier?->name,
                'date' => optional($expense->date)?->toDateString(),
                'total' => (float) $expense->amount,
                'paid' => (float) $expense->paid_amount,
                'balance' => (float) $expense->balance,
                'status' => $expense->status,
                'related_id' => $expense->id,
            ];
        }

        usort($rows, fn ($a, $b) => strcmp((string) $b['date'], (string) $a['date']));

        return $rows;
    }

    private function recentActivity(int $limit = 20): array
    {
        $items = [];
        foreach (Sale::query()->whereNotIn('sale_status', ['Cancelled', 'Refunded'])->latest('sale_date')->limit(10)->get() as $s) {
            $items[] = [
                'type' => 'Sale',
                'description' => 'Sale '.($s->invoice_number ?: '#'.$s->id).' recorded',
                'date' => optional($s->sale_date)?->toDateString(),
                'related_id' => $s->id,
            ];
        }
        foreach (Rental::query()->latest('start_date')->limit(10)->get() as $r) {
            $items[] = [
                'type' => 'Rental',
                'description' => 'Rental '.($r->rental_number ?: '#'.$r->id).' ('.$r->status.')',
                'date' => optional($r->start_date)?->toDateString(),
                'related_id' => $r->id,
            ];
        }
        foreach (Booking::query()->latest('booking_date')->limit(10)->get() as $b) {
            $items[] = [
                'type' => 'Booking',
                'description' => 'Booking '.($b->booking_number ?: '#'.$b->id).' ('.$b->status.')',
                'date' => optional($b->booking_date)?->toDateString(),
                'related_id' => $b->id,
            ];
        }
        foreach (MaintenanceRecord::query()->latest('start_date')->limit(5)->get() as $m) {
            $items[] = [
                'type' => 'Maintenance',
                'description' => 'Maintenance '.($m->maintenance_number ?: '#'.$m->id),
                'date' => optional($m->start_date)?->toDateString(),
                'related_id' => $m->id,
            ];
        }
        foreach (EquipmentCheck::query()->latest('scheduled_date')->limit(5)->get() as $c) {
            $items[] = [
                'type' => 'Check',
                'description' => 'Check '.($c->check_number ?: '#'.$c->id),
                'date' => optional($c->scheduled_date)?->toDateString(),
                'related_id' => $c->id,
            ];
        }

        usort($items, fn ($a, $b) => strcmp((string) $b['date'], (string) $a['date']));

        return array_slice($items, 0, $limit);
    }

    private function topProductUsage(int $limit): array
    {
        $counts = RentalItem::query()
            ->whereHas('rental', fn ($q) => $q->where('status', '!=', 'Cancelled'))
            ->selectRaw('product_id, COUNT(*) as value')
            ->groupBy('product_id')
            ->orderByDesc('value')
            ->limit($limit)
            ->get();
        $products = Product::query()->whereIn('id', $counts->pluck('product_id'))->get()->keyBy('id');

        return $counts->map(fn ($row) => [
            'name' => $products->get($row->product_id)?->name ?: 'Product #'.$row->product_id,
            'value' => (int) $row->value,
        ])->all();
    }

    private function rentalActivityWeek(): array
    {
        $days = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = Carbon::today()->subDays($i);
            $key = $day->toDateString();
            $days[$key] = [
                'day' => $day->format('D'),
                'active' => 0,
                'returns' => 0,
            ];
        }

        $from = Carbon::today()->subDays(6)->toDateString();
        $to = Carbon::today()->toDateString();

        foreach (Rental::query()->whereBetween('start_date', [$from, $to])->where('status', '!=', 'Cancelled')->get() as $rental) {
            $key = optional($rental->start_date)?->toDateString();
            if ($key && isset($days[$key])) {
                $days[$key]['active']++;
            }
        }
        foreach (Rental::query()->whereNotNull('actual_return_date')->whereBetween('actual_return_date', [$from, $to])->get() as $rental) {
            $key = optional($rental->actual_return_date)?->toDateString();
            if ($key && isset($days[$key])) {
                $days[$key]['returns']++;
            }
        }

        return array_values($days);
    }

    private function emptyUsageRow(?Product $product, int $id): array
    {
        return [
            'product_id' => $id,
            'product' => $product?->name ?: 'Product #'.$id,
            'serial_number' => $product?->serial_number ?: '—',
            'sales_quantity' => 0,
            'rental_quantity' => 0,
            'rental_count' => 0,
            'rental_days' => 0,
            'total_revenue' => 0,
            'last_usage_date' => null,
        ];
    }

    private function transformSale(Sale $sale): array
    {
        return [
            'id' => $sale->id,
            'sale_id' => $sale->id,
            'invoice_number' => $sale->invoice_number,
            'customer' => $sale->customer?->name,
            'customer_id' => $sale->customer_id,
            'sale_date' => optional($sale->sale_date)?->toDateString(),
            'date' => optional($sale->sale_date)?->toDateString(),
            'subtotal' => (float) $sale->subtotal,
            'discount' => (float) $sale->discount,
            'tax' => (float) $sale->tax,
            'total' => (float) $sale->total_amount,
            'total_amount' => (float) $sale->total_amount,
            'paid_amount' => (float) $sale->paid_amount,
            'amount_paid' => (float) $sale->paid_amount,
            'balance' => (float) $sale->balance,
            'payment_status' => $sale->payment_status,
            'sale_status' => $sale->sale_status,
        ];
    }

    private function transformRental(Rental $rental): array
    {
        $items = $rental->relationLoaded('items') ? $rental->items : $rental->items()->with('product')->get();
        $first = $items->first();
        $days = $first?->rental_days;
        if (! $days && $rental->start_date && $rental->expected_return_date) {
            $days = max(1, (int) $rental->start_date->diffInDays($rental->expected_return_date));
        }

        return [
            'product_id' => $first?->product_id,
            'product' => $items->map(fn ($item) => $item->product?->name)->filter()->unique()->implode(', ') ?: null,
            'quantity' => (int) $items->sum('quantity'),
            'rental_days' => $days ? (int) $days : null,
            'id' => $rental->id,
            'rental_number' => $rental->rental_number,
            'customer' => $rental->customer?->name,
            'customer_id' => $rental->customer_id,
            'rental_date' => optional($rental->start_date)?->toDateString(),
            'start_date' => optional($rental->start_date)?->toDateString(),
            'expected_return_date' => optional($rental->expected_return_date)?->toDateString(),
            'actual_return_date' => optional($rental->actual_return_date)?->toDateString(),
            'total' => (float) $rental->total_amount,
            'total_amount' => (float) $rental->total_amount,
            'paid' => (float) $rental->paid_amount,
            'paid_amount' => (float) $rental->paid_amount,
            'balance' => (float) $rental->balance,
            'payment_status' => $rental->payment_status,
            'rental_status' => $rental->status,
            'status' => $rental->status,
        ];
    }

    private function transformIncome(Income $income): array
    {
        return [
            'id' => $income->id,
            'income_number' => $income->reference,
            'reference' => $income->reference,
            'source' => $income->source,
            'category' => $income->category,
            'customer' => $income->customer?->name,
            'date' => optional($income->date)?->toDateString(),
            'amount' => (float) $income->amount,
            'paid_amount' => (float) $income->paid_amount,
            'balance' => (float) $income->balance,
            'payment_status' => $income->status,
            'status' => $income->status,
            'payment_method' => $income->payment_method,
            'description' => $income->description,
        ];
    }

    private function transformExpense(Expense $expense): array
    {
        return [
            'id' => $expense->id,
            'expense_number' => $expense->reference,
            'reference' => $expense->reference,
            'category' => $expense->category,
            'supplier' => $expense->supplier?->name,
            'date' => optional($expense->date)?->toDateString(),
            'amount' => (float) $expense->amount,
            'paid_amount' => (float) $expense->paid_amount,
            'balance' => (float) $expense->balance,
            'payment_status' => $expense->status,
            'status' => $expense->status,
            'payment_method' => $expense->payment_method,
            'description' => $expense->description,
        ];
    }
}
