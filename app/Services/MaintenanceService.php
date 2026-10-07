<?php

namespace App\Services;

use App\Models\MaintenanceRecord;
use App\Models\Product;
use App\Models\Supplier;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MaintenanceService
{
    public const STATUSES = ['Scheduled', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];

    public const ACTIVE_STATUSES = ['Scheduled', 'In Progress', 'On Hold'];

    public const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

    public const TYPES = [
        'Repair',
        'Preventive Maintenance',
        'Service',
        'Inspection',
        'Replacement',
        'Cleaning',
        'Calibration',
    ];

    public function transform(MaintenanceRecord $record): array
    {
        $record->loadMissing([
            'product:id,serial_number,name,image,category_id,status',
            'product.category:id,name',
            'supplier:id,name,supplier_code',
        ]);

        $product = $record->product;
        $start = optional($record->start_date)?->format('Y-m-d');
        $scheduled = optional($record->scheduled_date)?->format('Y-m-d') ?: $start;
        $started = optional($record->started_date)?->format('Y-m-d');
        $expected = optional($record->expected_completion)?->format('Y-m-d');
        $completed = optional($record->completed_date)?->format('Y-m-d');
        $next = optional($record->next_maintenance_date)?->format('Y-m-d');

        return [
            'id' => $record->id,
            'maintenance_number' => $record->maintenance_number,
            'maintenanceId' => $record->maintenance_number,
            'maintenance_id' => $record->maintenance_number,
            'product_id' => $record->product_id,
            'productId' => $record->product_id,
            'product' => $product?->name,
            'productSerialNumber' => $product?->serial_number,
            'product_serial_number' => $product?->serial_number,
            'productCategory' => $product?->category?->name,
            'productImage' => $product?->image,
            'supplier_id' => $record->supplier_id,
            'supplierId' => $record->supplier_id,
            'supplier' => $record->supplier?->name,
            'maintenance_type' => $record->maintenance_type,
            'maintenanceType' => $record->maintenance_type,
            'description' => $record->description,
            'scheduled_date' => $scheduled,
            'scheduledDate' => $scheduled,
            'start_date' => $start,
            'startDate' => $start,
            'started_date' => $started,
            'startedDate' => $started,
            'expected_completion' => $expected,
            'expectedCompletion' => $expected,
            'completed_date' => $completed,
            'completedDate' => $completed,
            'cost' => $record->cost !== null ? (float) $record->cost : 0,
            'estimated_cost' => $record->estimated_cost !== null ? (float) $record->estimated_cost : 0,
            'estimatedCost' => $record->estimated_cost !== null ? (float) $record->estimated_cost : 0,
            'status' => $record->status,
            'priority' => $record->priority,
            'technician' => $record->technician,
            'next_maintenance_date' => $next,
            'nextMaintenanceDate' => $next,
            'notes' => $record->notes,
            'timeline' => [],
            'created_at' => optional($record->created_at)?->toIso8601String(),
            'updated_at' => optional($record->updated_at)?->toIso8601String(),
        ];
    }

    public function create(array $data): MaintenanceRecord
    {
        return DB::transaction(function () use ($data) {
            $payload = $this->normalizeInput($data);
            $payload['maintenance_number'] = $payload['maintenance_number'] ?? $this->nextNumber();

            if (MaintenanceRecord::query()->where('maintenance_number', $payload['maintenance_number'])->exists()) {
                throw ValidationException::withMessages([
                    'maintenance_number' => ['Maintenance number already exists.'],
                ]);
            }

            $record = MaintenanceRecord::query()->create($payload);
            $this->syncProductAvailability((int) $record->product_id);

            return $record->fresh(['product.category', 'supplier']);
        });
    }

    public function update(MaintenanceRecord $record, array $data): MaintenanceRecord
    {
        return DB::transaction(function () use ($record, $data) {
            $previousProductId = (int) $record->product_id;
            $payload = $this->normalizeInput($data, $record);
            $record->fill($payload);
            $record->save();

            $this->syncProductAvailability($previousProductId);
            if ((int) $record->product_id !== $previousProductId) {
                $this->syncProductAvailability((int) $record->product_id);
            }

            return $record->fresh(['product.category', 'supplier']);
        });
    }

    public function complete(MaintenanceRecord $record, array $data = []): MaintenanceRecord
    {
        return $this->update($record, [
            'status' => 'Completed',
            'completed_date' => $data['completed_date'] ?? $data['completedDate'] ?? Carbon::today()->toDateString(),
            'cost' => $data['cost'] ?? $record->cost ?? $record->estimated_cost,
            'notes' => $data['notes'] ?? $record->notes,
        ]);
    }

    public function cancel(MaintenanceRecord $record, array $data = []): MaintenanceRecord
    {
        return $this->update($record, [
            'status' => 'Cancelled',
            'notes' => $data['notes'] ?? $record->notes,
        ]);
    }

    public function delete(MaintenanceRecord $record): void
    {
        DB::transaction(function () use ($record) {
            $productId = (int) $record->product_id;
            $record->delete();
            $this->syncProductAvailability($productId);
        });
    }

    /**
     * When any active maintenance exists for a product, mark it Maintenance.
     * When none remain, restore Available if stock allows (does not override Rented/Inactive).
     */
    public function syncProductAvailability(int $productId): void
    {
        if ($productId <= 0) {
            return;
        }

        $product = Product::query()->lockForUpdate()->find($productId);
        if (! $product) {
            return;
        }

        $hasActive = MaintenanceRecord::query()
            ->where('product_id', $productId)
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->exists();

        $current = (string) $product->status;

        if ($hasActive) {
            if (strcasecmp($current, 'Maintenance') !== 0) {
                $product->status = 'Maintenance';
                $product->save();
            }

            return;
        }

        if (strcasecmp($current, 'Maintenance') === 0) {
            $product->status = ((int) $product->available_quantity > 0) ? 'Available' : 'Out of Stock';
            $product->save();
        }
    }

    public function nextNumber(): string
    {
        $year = Carbon::now()->year;
        $prefix = "MNT-{$year}-";
        $latest = MaintenanceRecord::query()
            ->where('maintenance_number', 'like', $prefix.'%')
            ->orderByDesc('maintenance_number')
            ->value('maintenance_number');

        $num = 0;
        if ($latest && preg_match('/MNT-\d{4}-(\d+)/', $latest, $m)) {
            $num = (int) $m[1];
        }

        return $prefix.str_pad((string) ($num + 1), 3, '0', STR_PAD_LEFT);
    }

    private function normalizeInput(array $data, ?MaintenanceRecord $existing = null): array
    {
        $productId = $data['product_id'] ?? $data['productId'] ?? $existing?->product_id;
        if (! $productId || ! Product::query()->whereKey($productId)->exists()) {
            throw ValidationException::withMessages(['product_id' => ['A valid product is required.']]);
        }

        $supplierId = $data['supplier_id'] ?? $data['supplierId'] ?? $existing?->supplier_id;
        if ($supplierId !== null && $supplierId !== '' && ! Supplier::query()->whereKey($supplierId)->exists()) {
            throw ValidationException::withMessages(['supplier_id' => ['Supplier is invalid.']]);
        }

        $type = $data['maintenance_type'] ?? $data['maintenanceType'] ?? $existing?->maintenance_type;
        $status = $data['status'] ?? $existing?->status ?? 'Scheduled';
        if (! in_array($status, self::STATUSES, true)) {
            throw ValidationException::withMessages(['status' => ['Invalid maintenance status.']]);
        }

        $priority = $data['priority'] ?? $existing?->priority ?? 'Medium';
        if ($priority && ! in_array($priority, self::PRIORITIES, true)) {
            throw ValidationException::withMessages(['priority' => ['Invalid priority.']]);
        }

        $start = $data['start_date'] ?? $data['startDate'] ?? $data['scheduled_date'] ?? $data['scheduledDate'] ?? $existing?->start_date;
        $scheduled = $data['scheduled_date'] ?? $data['scheduledDate'] ?? $existing?->scheduled_date ?? $start;
        $started = $data['started_date'] ?? $data['startedDate'] ?? $existing?->started_date;
        $expected = $data['expected_completion'] ?? $data['expectedCompletion'] ?? $existing?->expected_completion;
        $completed = array_key_exists('completed_date', $data) || array_key_exists('completedDate', $data)
            ? ($data['completed_date'] ?? $data['completedDate'])
            : $existing?->completed_date;

        if ($status === 'In Progress' && ! $started) {
            $started = Carbon::today()->toDateString();
        }
        if ($status === 'Completed') {
            $completed = $completed ?: Carbon::today()->toDateString();
        }

        if ($start && $expected && Carbon::parse($expected)->lt(Carbon::parse($start))) {
            throw ValidationException::withMessages([
                'expected_completion' => ['Expected completion must be on or after start date.'],
            ]);
        }

        $cost = $data['cost'] ?? $existing?->cost;
        $estimated = $data['estimated_cost'] ?? $data['estimatedCost'] ?? $existing?->estimated_cost ?? $cost;
        if ($cost !== null && $cost !== '' && (float) $cost < 0) {
            throw ValidationException::withMessages(['cost' => ['Maintenance cost cannot be negative.']]);
        }
        if ($estimated !== null && $estimated !== '' && (float) $estimated < 0) {
            throw ValidationException::withMessages(['estimated_cost' => ['Estimated cost cannot be negative.']]);
        }

        $description = $data['description'] ?? $existing?->description;
        if ($description !== null && trim((string) $description) === '' && ! $existing) {
            throw ValidationException::withMessages(['description' => ['Description is required.']]);
        }

        return array_filter([
            'maintenance_number' => $data['maintenance_number'] ?? $data['maintenanceNumber'] ?? $data['maintenanceId'] ?? $existing?->maintenance_number,
            'product_id' => (int) $productId,
            'supplier_id' => $this->nullableInt($supplierId),
            'maintenance_type' => trim((string) $type),
            'description' => $description !== null ? trim((string) $description) : null,
            'scheduled_date' => $scheduled ? Carbon::parse($scheduled)->toDateString() : null,
            'start_date' => $start ? Carbon::parse($start)->toDateString() : Carbon::today()->toDateString(),
            'started_date' => $started ? Carbon::parse($started)->toDateString() : null,
            'expected_completion' => $expected ? Carbon::parse($expected)->toDateString() : null,
            'completed_date' => $completed ? Carbon::parse($completed)->toDateString() : null,
            'cost' => $cost === null || $cost === '' ? null : (float) $cost,
            'estimated_cost' => $estimated === null || $estimated === '' ? null : (float) $estimated,
            'status' => $status,
            'priority' => $priority,
            'technician' => $data['technician'] ?? $existing?->technician,
            'next_maintenance_date' => isset($data['next_maintenance_date']) || isset($data['nextMaintenanceDate'])
                ? (($data['next_maintenance_date'] ?? $data['nextMaintenanceDate'])
                    ? Carbon::parse($data['next_maintenance_date'] ?? $data['nextMaintenanceDate'])->toDateString()
                    : null)
                : $existing?->next_maintenance_date,
            'notes' => $data['notes'] ?? $existing?->notes,
        ], fn ($v) => $v !== null);
    }

    private function nullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (int) $value;
    }
}
