<?php

namespace App\Services;

use App\Models\EquipmentCheck;
use App\Models\Product;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CheckService
{
    public const TYPES = [
        'Routine Inspection',
        'Safety Inspection',
        'Pre-Rental Check',
        'Post-Rental Check',
        'Maintenance Check',
        'Damage Inspection',
    ];

    public const STATUSES = [
        'Scheduled',
        'Pending',
        'In Progress',
        'Completed',
        'Failed',
        'Cancelled',
    ];

    public const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

    public function transform(EquipmentCheck $check): array
    {
        $check->loadMissing(['product:id,serial_number,name,image,category_id', 'product.category:id,name', 'rental:id,rental_number', 'customer:id,name,customer_code', 'checkedByUser:id,name']);

        $product = $check->product;
        $scheduled = optional($check->scheduled_date)?->format('Y-m-d');
        $completed = optional($check->completed_date)?->format('Y-m-d');
        $next = optional($check->next_check_date)?->format('Y-m-d');

        return [
            'id' => $check->id,
            'check_number' => $check->check_number,
            'check_id' => $check->check_number,
            'checkId' => $check->check_number,
            'checkNumber' => $check->check_number,
            'product_id' => $check->product_id,
            'productId' => $check->product_id,
            'product' => $product?->name,
            'product_serial_number' => $product?->serial_number,
            'category' => $product?->category?->name,
            'rental_id' => $check->rental_id,
            'rentalId' => $check->rental_id,
            'rental_number' => $check->rental?->rental_number,
            'customer_id' => $check->customer_id,
            'customerId' => $check->customer_id,
            'customer' => $check->customer?->name,
            'check_type' => $check->check_type,
            'check' => $check->check_type,
            'name' => $check->check_type,
            'description' => $check->description,
            'scheduled_date' => $scheduled,
            'checkDate' => $scheduled,
            'completed_date' => $completed,
            'lastCompleted' => $completed,
            'next_check_date' => $next,
            'nextCheck' => $next,
            'frequency' => $check->frequency,
            'status' => $check->status,
            'priority' => $check->priority,
            'result' => $check->result,
            'condition' => $check->condition,
            'checklist_data' => $check->checklist_data,
            'assigned_to' => $check->assigned_to,
            'assignedTo' => $check->assigned_to,
            'checked_by' => $check->checked_by,
            'checkedBy' => $check->checkedByUser?->name ?? $check->assigned_to,
            'reminder_before' => $check->reminder_before,
            'reminderBefore' => $check->reminder_before,
            'notes' => $check->notes,
            'created_at' => optional($check->created_at)?->toIso8601String(),
            'updated_at' => optional($check->updated_at)?->toIso8601String(),
        ];
    }

    public function create(array $data): EquipmentCheck
    {
        return DB::transaction(function () use ($data) {
            $payload = $this->normalizeInput($data);
            $payload['check_number'] = $payload['check_number'] ?? $this->nextNumber();

            if (EquipmentCheck::query()->where('check_number', $payload['check_number'])->exists()) {
                throw ValidationException::withMessages([
                    'check_number' => ['Check number already exists.'],
                ]);
            }

            $check = EquipmentCheck::query()->create($payload);

            return $check->fresh(['product.category', 'rental', 'customer', 'checkedByUser']);
        });
    }

    public function update(EquipmentCheck $check, array $data): EquipmentCheck
    {
        return DB::transaction(function () use ($check, $data) {
            $payload = $this->normalizeInput($data, $check);
            $check->fill($payload);
            $check->save();

            return $check->fresh(['product.category', 'rental', 'customer', 'checkedByUser']);
        });
    }

    public function complete(EquipmentCheck $check, array $data = []): EquipmentCheck
    {
        $completed = $data['completed_date'] ?? $data['completedDate'] ?? Carbon::today()->toDateString();
        $result = $data['result'] ?? $check->result ?? 'Passed';
        $condition = $data['condition'] ?? $check->condition;
        $notes = $data['notes'] ?? $check->notes;

        return $this->update($check, [
            'status' => ($result === 'Failed' || ($data['status'] ?? null) === 'Failed') ? 'Failed' : 'Completed',
            'completed_date' => $completed,
            'result' => $result,
            'condition' => $condition,
            'notes' => $notes,
            'checked_by' => $data['checked_by'] ?? $data['checkedBy'] ?? $check->checked_by,
        ]);
    }

    public function delete(EquipmentCheck $check): void
    {
        $check->delete();
    }

    public function nextNumber(): string
    {
        $year = Carbon::now()->year;
        $prefix = "CHK-{$year}-";
        $latest = EquipmentCheck::query()
            ->where('check_number', 'like', $prefix.'%')
            ->orderByDesc('check_number')
            ->value('check_number');

        $num = 0;
        if ($latest && preg_match('/CHK-\d{4}-(\d+)/', $latest, $m)) {
            $num = (int) $m[1];
        }

        return $prefix.str_pad((string) ($num + 1), 3, '0', STR_PAD_LEFT);
    }

    private function normalizeInput(array $data, ?EquipmentCheck $existing = null): array
    {
        $checkType = $data['check_type'] ?? $data['checkType'] ?? $data['check'] ?? $data['name'] ?? $existing?->check_type;
        $scheduled = $data['scheduled_date'] ?? $data['scheduledDate'] ?? $data['check_date'] ?? $data['checkDate'] ?? $existing?->scheduled_date;
        $completed = array_key_exists('completed_date', $data) || array_key_exists('completedDate', $data) || array_key_exists('lastCompleted', $data)
            ? ($data['completed_date'] ?? $data['completedDate'] ?? $data['lastCompleted'])
            : $existing?->completed_date;
        $status = $data['status'] ?? $existing?->status ?? 'Scheduled';

        // Display-only statuses map back to Scheduled/Pending.
        if (in_array($status, ['Due Today', 'Upcoming', 'Overdue'], true)) {
            $status = 'Scheduled';
        }

        if (! in_array($status, self::STATUSES, true)) {
            throw ValidationException::withMessages(['status' => ['Invalid check status.']]);
        }

        if ($status === 'Completed' || $status === 'Failed') {
            $completed = $completed ?: Carbon::today()->toDateString();
        }

        if ($completed && $scheduled && Carbon::parse($completed)->lt(Carbon::parse($scheduled))) {
            throw ValidationException::withMessages([
                'completed_date' => ['Completed date cannot be before scheduled date.'],
            ]);
        }

        $productId = $data['product_id'] ?? $data['productId'] ?? $existing?->product_id;
        if (! $productId || ! Product::query()->whereKey($productId)->exists()) {
            throw ValidationException::withMessages(['product_id' => ['A valid product is required.']]);
        }

        $checkedBy = $data['checked_by'] ?? $data['checkedBy'] ?? $existing?->checked_by;
        if ($checkedBy !== null && $checkedBy !== '' && ! User::query()->whereKey($checkedBy)->exists()) {
            throw ValidationException::withMessages(['checked_by' => ['Checked by must reference a valid user.']]);
        }

        $frequency = $data['frequency'] ?? $existing?->frequency;
        $next = $data['next_check_date'] ?? $data['nextCheckDate'] ?? $data['nextCheck'] ?? $existing?->next_check_date;
        if ($next === null && $scheduled && $frequency) {
            $next = $this->calcNextCheckDate((string) $scheduled, (string) $frequency);
        }

        return array_filter([
            'check_number' => $data['check_number'] ?? $data['checkNumber'] ?? $data['checkId'] ?? $existing?->check_number,
            'product_id' => (int) $productId,
            'rental_id' => $this->nullableInt($data['rental_id'] ?? $data['rentalId'] ?? $existing?->rental_id),
            'customer_id' => $this->nullableInt($data['customer_id'] ?? $data['customerId'] ?? $existing?->customer_id),
            'check_type' => trim((string) $checkType),
            'description' => $data['description'] ?? $existing?->description,
            'scheduled_date' => $scheduled ? Carbon::parse($scheduled)->toDateString() : null,
            'completed_date' => $completed ? Carbon::parse($completed)->toDateString() : null,
            'next_check_date' => $next ? Carbon::parse($next)->toDateString() : null,
            'frequency' => $frequency,
            'status' => $status,
            'priority' => $data['priority'] ?? $existing?->priority ?? 'Medium',
            'result' => $data['result'] ?? $existing?->result,
            'condition' => $data['condition'] ?? $existing?->condition,
            'checklist_data' => $data['checklist_data'] ?? $data['checklistData'] ?? $existing?->checklist_data,
            'assigned_to' => $data['assigned_to'] ?? $data['assignedTo'] ?? $existing?->assigned_to,
            'checked_by' => $this->nullableInt($checkedBy),
            'reminder_before' => $data['reminder_before'] ?? $data['reminderBefore'] ?? $existing?->reminder_before,
            'notes' => $data['notes'] ?? $existing?->notes,
        ], fn ($v) => $v !== null);
    }

    private function calcNextCheckDate(string $date, string $frequency): ?string
    {
        $base = Carbon::parse($date)->startOfDay();

        return match ($frequency) {
            'One Time' => null,
            'Daily' => $base->copy()->addDay()->toDateString(),
            'Weekly' => $base->copy()->addWeek()->toDateString(),
            'Monthly' => $base->copy()->addMonth()->toDateString(),
            'Every 3 Months' => $base->copy()->addMonths(3)->toDateString(),
            'Every 6 Months' => $base->copy()->addMonths(6)->toDateString(),
            'Yearly' => $base->copy()->addYear()->toDateString(),
            default => null,
        };
    }

    private function nullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (int) $value;
    }
}
