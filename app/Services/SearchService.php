<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\EquipmentCheck;
use App\Models\Expense;
use App\Models\Income;
use App\Models\MaintenanceRecord;
use App\Models\Product;
use App\Models\Reminder;
use App\Models\Rental;
use App\Models\Sale;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Support\Collection;

class SearchService
{
    private const DEFAULT_LIMIT = 8;

    private const MAX_LIMIT = 20;

    /**
     * Entity config: permission, label, searcher.
     *
     * @return array<string, array{permission:string,label:string}>
     */
    public function entityMap(): array
    {
        return [
            'products' => ['permission' => 'products.view', 'label' => 'Product'],
            'customers' => ['permission' => 'customers.view', 'label' => 'Customer'],
            'suppliers' => ['permission' => 'suppliers.view', 'label' => 'Supplier'],
            'sales' => ['permission' => 'sales.view', 'label' => 'Sale'],
            'rentals' => ['permission' => 'rentals.view', 'label' => 'Rental'],
            'bookings' => ['permission' => 'bookings.view', 'label' => 'Booking'],
            'income' => ['permission' => 'income.view', 'label' => 'Income'],
            'expenses' => ['permission' => 'expenses.view', 'label' => 'Expense'],
            'maintenance' => ['permission' => 'maintenance.view', 'label' => 'Maintenance'],
            'checks' => ['permission' => 'checks.view', 'label' => 'Check'],
            'reminders' => ['permission' => 'reminders.view', 'label' => 'Reminder'],
        ];
    }

    public function canSearch(User $user, string $key): bool
    {
        $meta = $this->entityMap()[$key] ?? null;
        if (! $meta) {
            return false;
        }

        // Reminders can also be viewed via checks.view / notifications.view (route OR).
        if ($key === 'reminders') {
            return $user->hasAnyPermission(['reminders.view', 'checks.view', 'notifications.view']);
        }

        return $user->hasPermission($meta['permission']);
    }

    public function search(User $user, string $query, ?string $type = null, int $limit = self::DEFAULT_LIMIT): array
    {
        $q = trim($query);
        if (mb_strlen($q) < 2) {
            return [
                'query' => $q,
                'results' => [],
                'groups' => [],
                'total' => 0,
            ];
        }

        $limit = max(1, min($limit, self::MAX_LIMIT));
        $like = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $q).'%';
        $entities = $this->entityMap();

        if ($type) {
            $type = strtolower($type);
            if (! isset($entities[$type])) {
                return [
                    'query' => $q,
                    'results' => [],
                    'groups' => [],
                    'total' => 0,
                ];
            }
            $entities = [$type => $entities[$type]];
        }

        $results = [];

        foreach ($entities as $key => $meta) {
            if (! $this->canSearch($user, $key)) {
                continue;
            }

            $chunk = match ($key) {
                'products' => $this->searchProducts($like, $limit),
                'customers' => $this->searchCustomers($like, $limit),
                'suppliers' => $this->searchSuppliers($like, $limit),
                'sales' => $this->searchSales($like, $limit),
                'rentals' => $this->searchRentals($like, $limit),
                'bookings' => $this->searchBookings($like, $limit),
                'income' => $this->searchIncome($like, $limit),
                'expenses' => $this->searchExpenses($like, $limit),
                'maintenance' => $this->searchMaintenance($like, $limit),
                'checks' => $this->searchChecks($like, $limit),
                'reminders' => $this->searchReminders($like, $limit),
                default => collect(),
            };

            foreach ($chunk as $item) {
                $results[] = $item;
            }
        }

        // Soft-rank: exact / prefix matches first, then cap overall list.
        usort($results, function (array $a, array $b) use ($q) {
            return $this->score($b, $q) <=> $this->score($a, $q);
        });

        $results = array_slice($results, 0, $limit * 2);

        $groups = [];
        foreach ($results as $item) {
            $groups[$item['type']] ??= [];
            if (count($groups[$item['type']]) < $limit) {
                $groups[$item['type']][] = $item;
            }
        }

        $flat = [];
        foreach ($groups as $items) {
            foreach ($items as $item) {
                $flat[] = $item;
            }
        }

        return [
            'query' => $q,
            'results' => $flat,
            'groups' => $groups,
            'total' => count($flat),
        ];
    }

    private function score(array $item, string $q): int
    {
        $title = mb_strtolower((string) ($item['title'] ?? ''));
        $ref = mb_strtolower((string) ($item['reference'] ?? ''));
        $needle = mb_strtolower($q);
        $score = 0;
        if ($title === $needle || $ref === $needle) {
            $score += 100;
        }
        if (str_starts_with($title, $needle) || str_starts_with($ref, $needle)) {
            $score += 50;
        }
        if (str_contains($title, $needle) || str_contains($ref, $needle)) {
            $score += 10;
        }

        return $score;
    }

    private function searchProducts(string $like, int $limit): Collection
    {
        return Product::query()
            ->where(function ($q) use ($like) {
                $q->where('name', 'like', $like)
                    ->orWhere('serial_number', 'like', $like)
                    ->orWhere('description', 'like', $like);
            })
            ->orderBy('name')
            ->limit($limit)
            ->get(['id', 'name', 'serial_number', 'status'])
            ->map(fn (Product $p) => [
                'id' => $p->id,
                'type' => 'Product',
                'type_key' => 'products',
                'title' => $p->name,
                'subtitle' => $p->serial_number,
                'reference' => $p->serial_number,
                'status' => $p->status,
                'url' => '/products/'.$p->id,
            ]);
    }

    private function searchCustomers(string $like, int $limit): Collection
    {
        return Customer::query()
            ->where(function ($q) use ($like) {
                $q->where('name', 'like', $like)
                    ->orWhere('email', 'like', $like)
                    ->orWhere('phone', 'like', $like)
                    ->orWhere('customer_code', 'like', $like)
                    ->orWhere('company_name', 'like', $like);
            })
            ->orderBy('name')
            ->limit($limit)
            ->get(['id', 'name', 'email', 'phone', 'customer_code', 'status'])
            ->map(fn (Customer $c) => [
                'id' => $c->id,
                'type' => 'Customer',
                'type_key' => 'customers',
                'title' => $c->name,
                'subtitle' => $c->email ?: $c->phone ?: $c->customer_code,
                'reference' => $c->customer_code,
                'status' => $c->status,
                'url' => '/customers/'.$c->id,
            ]);
    }

    private function searchSuppliers(string $like, int $limit): Collection
    {
        return Supplier::query()
            ->where(function ($q) use ($like) {
                $q->where('name', 'like', $like)
                    ->orWhere('supplier_code', 'like', $like)
                    ->orWhere('contact_person', 'like', $like)
                    ->orWhere('email', 'like', $like)
                    ->orWhere('phone', 'like', $like);
            })
            ->orderBy('name')
            ->limit($limit)
            ->get(['id', 'name', 'supplier_code', 'email', 'phone', 'status'])
            ->map(fn (Supplier $s) => [
                'id' => $s->id,
                'type' => 'Supplier',
                'type_key' => 'suppliers',
                'title' => $s->name,
                'subtitle' => $s->supplier_code ?: ($s->email ?: $s->phone),
                'reference' => $s->supplier_code,
                'status' => $s->status,
                'url' => '/suppliers',
            ]);
    }

    private function searchSales(string $like, int $limit): Collection
    {
        return Sale::query()
            ->with(['customer:id,name'])
            ->where(function ($q) use ($like) {
                $q->where('invoice_number', 'like', $like)
                    ->orWhere('notes', 'like', $like)
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', $like));
            })
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['id', 'invoice_number', 'customer_id', 'sale_status', 'payment_status'])
            ->map(fn (Sale $s) => [
                'id' => $s->id,
                'type' => 'Sale',
                'type_key' => 'sales',
                'title' => $s->invoice_number ?: 'Sale #'.$s->id,
                'subtitle' => $s->customer?->name,
                'reference' => $s->invoice_number,
                'status' => $s->payment_status ?: $s->sale_status,
                'url' => '/sales/'.$s->id,
            ]);
    }

    private function searchRentals(string $like, int $limit): Collection
    {
        return Rental::query()
            ->with(['customer:id,name'])
            ->where(function ($q) use ($like) {
                $q->where('rental_number', 'like', $like)
                    ->orWhere('notes', 'like', $like)
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', $like));
            })
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['id', 'rental_number', 'customer_id', 'status'])
            ->map(fn (Rental $r) => [
                'id' => $r->id,
                'type' => 'Rental',
                'type_key' => 'rentals',
                'title' => $r->rental_number ?: 'Rental #'.$r->id,
                'subtitle' => $r->customer?->name,
                'reference' => $r->rental_number,
                'status' => $r->status,
                'url' => '/rentals/'.$r->id,
            ]);
    }

    private function searchBookings(string $like, int $limit): Collection
    {
        return Booking::query()
            ->with(['customer:id,name'])
            ->where(function ($q) use ($like) {
                $q->where('booking_number', 'like', $like)
                    ->orWhere('notes', 'like', $like)
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', $like));
            })
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['id', 'booking_number', 'customer_id', 'status'])
            ->map(fn (Booking $b) => [
                'id' => $b->id,
                'type' => 'Booking',
                'type_key' => 'bookings',
                'title' => $b->booking_number ?: 'Booking #'.$b->id,
                'subtitle' => $b->customer?->name,
                'reference' => $b->booking_number,
                'status' => $b->status,
                'url' => '/bookings',
            ]);
    }

    private function searchIncome(string $like, int $limit): Collection
    {
        return Income::query()
            ->where(function ($q) use ($like) {
                $q->where('reference', 'like', $like)
                    ->orWhere('description', 'like', $like)
                    ->orWhere('category', 'like', $like)
                    ->orWhere('source', 'like', $like);
            })
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['id', 'reference', 'description', 'category', 'status'])
            ->map(fn (Income $i) => [
                'id' => $i->id,
                'type' => 'Income',
                'type_key' => 'income',
                'title' => $i->reference ?: 'Income #'.$i->id,
                'subtitle' => $i->description ?: $i->category,
                'reference' => $i->reference,
                'status' => $i->status,
                'url' => '/income/'.$i->id,
            ]);
    }

    private function searchExpenses(string $like, int $limit): Collection
    {
        return Expense::query()
            ->where(function ($q) use ($like) {
                $q->where('reference', 'like', $like)
                    ->orWhere('description', 'like', $like)
                    ->orWhere('category', 'like', $like);
            })
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['id', 'reference', 'description', 'category', 'status'])
            ->map(fn (Expense $e) => [
                'id' => $e->id,
                'type' => 'Expense',
                'type_key' => 'expenses',
                'title' => $e->reference ?: 'Expense #'.$e->id,
                'subtitle' => $e->description ?: $e->category,
                'reference' => $e->reference,
                'status' => $e->status,
                'url' => '/expenses/'.$e->id,
            ]);
    }

    private function searchMaintenance(string $like, int $limit): Collection
    {
        return MaintenanceRecord::query()
            ->with(['product:id,name,serial_number'])
            ->where(function ($q) use ($like) {
                $q->where('maintenance_number', 'like', $like)
                    ->orWhere('maintenance_type', 'like', $like)
                    ->orWhere('description', 'like', $like)
                    ->orWhere('technician', 'like', $like)
                    ->orWhereHas('product', fn ($p) => $p->where('name', 'like', $like)->orWhere('serial_number', 'like', $like));
            })
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['id', 'maintenance_number', 'product_id', 'maintenance_type', 'status'])
            ->map(fn (MaintenanceRecord $m) => [
                'id' => $m->id,
                'type' => 'Maintenance',
                'type_key' => 'maintenance',
                'title' => $m->maintenance_number ?: 'Maintenance #'.$m->id,
                'subtitle' => ($m->product?->name ?: '').($m->maintenance_type ? ' · '.$m->maintenance_type : ''),
                'reference' => $m->maintenance_number,
                'status' => $m->status,
                'url' => '/maintenance/'.$m->id,
            ]);
    }

    private function searchChecks(string $like, int $limit): Collection
    {
        return EquipmentCheck::query()
            ->with(['product:id,name,serial_number'])
            ->where(function ($q) use ($like) {
                $q->where('check_number', 'like', $like)
                    ->orWhere('check_type', 'like', $like)
                    ->orWhere('assigned_to', 'like', $like)
                    ->orWhere('notes', 'like', $like)
                    ->orWhereHas('product', fn ($p) => $p->where('name', 'like', $like)->orWhere('serial_number', 'like', $like));
            })
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['id', 'check_number', 'product_id', 'check_type', 'status'])
            ->map(fn (EquipmentCheck $c) => [
                'id' => $c->id,
                'type' => 'Check',
                'type_key' => 'checks',
                'title' => $c->check_number ?: 'Check #'.$c->id,
                'subtitle' => ($c->product?->name ?: '').($c->check_type ? ' · '.$c->check_type : ''),
                'reference' => $c->check_number,
                'status' => $c->status,
                'url' => '/checks/'.$c->id,
            ]);
    }

    private function searchReminders(string $like, int $limit): Collection
    {
        return Reminder::query()
            ->where(function ($q) use ($like) {
                $q->where('title', 'like', $like)
                    ->orWhere('reminder_number', 'like', $like)
                    ->orWhere('message', 'like', $like)
                    ->orWhere('description', 'like', $like);
            })
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['id', 'reminder_number', 'title', 'status', 'due_date'])
            ->map(fn (Reminder $r) => [
                'id' => $r->id,
                'type' => 'Reminder',
                'type_key' => 'reminders',
                'title' => $r->title,
                'subtitle' => $r->reminder_number ?: optional($r->due_date)?->format('Y-m-d'),
                'reference' => $r->reminder_number,
                'status' => $r->status,
                'url' => '/reminders',
            ]);
    }
}
