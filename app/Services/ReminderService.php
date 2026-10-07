<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\EquipmentCheck;
use App\Models\MaintenanceRecord;
use App\Models\Product;
use App\Models\Reminder;
use App\Models\Rental;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReminderService
{
    public const STATUSES = ['Pending', 'Completed', 'Dismissed'];

    public const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

    public const TYPES = [
        'Manual',
        'Check',
        'Rental',
        'Stock',
        'Maintenance',
        'Recurring',
        'Booking',
        'Payment',
    ];

    public const RELATED_TYPES = [
        'check',
        'maintenance',
        'rental',
        'booking',
        'product',
        'customer',
        'sale',
        'income',
        'expense',
    ];

    public function transform(Reminder $reminder): array
    {
        $reminder->loadMissing(['product:id,serial_number,name']);

        $due = optional($reminder->due_date)?->format('Y-m-d');
        $next = optional($reminder->next_reminder)?->format('Y-m-d');
        $lastSent = optional($reminder->last_sent)?->format('Y-m-d');

        return [
            'id' => $reminder->id,
            'reminder_number' => $reminder->reminder_number,
            'reminderNumber' => $reminder->reminder_number,
            'title' => $reminder->title,
            'reminder' => $reminder->title,
            'message' => $reminder->message,
            'description' => $reminder->description ?: $reminder->message,
            'reminder_type' => $reminder->reminder_type ?: 'Manual',
            'reminderType' => $reminder->reminder_type ?: 'Manual',
            'source' => $reminder->reminder_type ?: 'Manual',
            'due_date' => $due,
            'dueDate' => $due,
            'date' => $due,
            'next_reminder' => $next,
            'nextReminder' => $next ?: $due,
            'last_sent' => $lastSent,
            'lastSent' => $lastSent,
            'status' => $reminder->status,
            'priority' => $reminder->priority ?: 'Medium',
            'related_type' => $reminder->related_type,
            'relatedType' => $reminder->related_type,
            'related_id' => $reminder->related_id,
            'relatedId' => $reminder->related_id,
            'product_id' => $reminder->product_id,
            'productId' => $reminder->product_id,
            'product' => $reminder->product?->name,
            'frequency' => $reminder->frequency,
            'is_recurring' => (bool) $reminder->is_recurring,
            'isRecurring' => (bool) $reminder->is_recurring,
            'link' => $reminder->link,
            'notes' => $reminder->notes,
            'completed_at' => optional($reminder->completed_at)?->toIso8601String(),
            'completedAt' => optional($reminder->completed_at)?->toIso8601String(),
            'dismissed_at' => optional($reminder->dismissed_at)?->toIso8601String(),
            'dismissedAt' => optional($reminder->dismissed_at)?->toIso8601String(),
            'created_at' => optional($reminder->created_at)?->toIso8601String(),
            'updated_at' => optional($reminder->updated_at)?->toIso8601String(),
        ];
    }

    public function create(array $data): Reminder
    {
        return DB::transaction(function () use ($data) {
            $payload = $this->normalizeInput($data);
            if (empty($payload['reminder_number'])) {
                $payload['reminder_number'] = $this->nextNumber();
            }

            $reminder = Reminder::query()->create($payload);

            return $reminder->fresh(['product']);
        });
    }

    public function update(Reminder $reminder, array $data): Reminder
    {
        return DB::transaction(function () use ($reminder, $data) {
            $payload = $this->normalizeInput($data, $reminder);
            $reminder->fill($payload);
            $reminder->save();

            return $reminder->fresh(['product']);
        });
    }

    public function complete(Reminder $reminder): Reminder
    {
        return $this->update($reminder, [
            'status' => 'Completed',
            'completed_at' => now(),
            'dismissed_at' => null,
        ]);
    }

    public function dismiss(Reminder $reminder): Reminder
    {
        return $this->update($reminder, [
            'status' => 'Dismissed',
            'dismissed_at' => now(),
        ]);
    }

    public function delete(Reminder $reminder): void
    {
        $reminder->delete();
    }

    public function nextNumber(): string
    {
        $year = Carbon::now()->year;
        $prefix = "REM-{$year}-";
        $latest = Reminder::query()
            ->where('reminder_number', 'like', $prefix.'%')
            ->orderByDesc('reminder_number')
            ->value('reminder_number');

        $num = 0;
        if ($latest && preg_match('/REM-\d{4}-(\d+)/', $latest, $m)) {
            $num = (int) $m[1];
        }

        return $prefix.str_pad((string) ($num + 1), 3, '0', STR_PAD_LEFT);
    }

    private function normalizeInput(array $data, ?Reminder $existing = null): array
    {
        $title = $data['title'] ?? $data['reminder'] ?? $existing?->title;
        if (! $title || trim((string) $title) === '') {
            throw ValidationException::withMessages(['title' => ['Title is required.']]);
        }

        $due = $data['due_date'] ?? $data['dueDate'] ?? $data['next_reminder'] ?? $data['nextReminder'] ?? $existing?->due_date;
        if (! $due) {
            throw ValidationException::withMessages(['due_date' => ['Due date is required.']]);
        }

        $status = $data['status'] ?? $existing?->status ?? 'Pending';
        // Map legacy UI statuses
        if (in_array($status, ['Unread', 'Read', 'Snoozed', 'Active', 'Paused'], true)) {
            $status = match ($status) {
                'Active', 'Unread', 'Read', 'Snoozed' => 'Pending',
                'Paused' => 'Dismissed',
                default => 'Pending',
            };
        }
        if (! in_array($status, self::STATUSES, true)) {
            throw ValidationException::withMessages(['status' => ['Invalid reminder status.']]);
        }

        $type = $data['reminder_type'] ?? $data['reminderType'] ?? $data['source'] ?? $existing?->reminder_type ?? 'Manual';
        $priority = $data['priority'] ?? $existing?->priority ?? 'Medium';
        if ($priority && ! in_array($priority, self::PRIORITIES, true)) {
            throw ValidationException::withMessages(['priority' => ['Invalid priority.']]);
        }

        $relatedType = $data['related_type'] ?? $data['relatedType'] ?? $existing?->related_type;
        $relatedId = $data['related_id'] ?? $data['relatedId'] ?? $existing?->related_id;
        if ($relatedType || $relatedId) {
            $this->assertRelated($relatedType, $relatedId);
        }

        $productId = $data['product_id'] ?? $data['productId'] ?? $existing?->product_id;
        if ($productId !== null && $productId !== '' && ! Product::query()->whereKey($productId)->exists()) {
            throw ValidationException::withMessages(['product_id' => ['Product is invalid.']]);
        }

        $isRecurring = (bool) ($data['is_recurring'] ?? $data['isRecurring'] ?? $existing?->is_recurring ?? ($type === 'Recurring'));
        $message = $data['message'] ?? $data['description'] ?? $existing?->message;
        $description = $data['description'] ?? $data['message'] ?? $existing?->description ?? $message;

        $completedAt = $data['completed_at'] ?? $data['completedAt'] ?? $existing?->completed_at;
        $dismissedAt = $data['dismissed_at'] ?? $data['dismissedAt'] ?? $existing?->dismissed_at;
        if ($status === 'Completed' && ! $completedAt) {
            $completedAt = now();
        }
        if ($status === 'Dismissed' && ! $dismissedAt) {
            $dismissedAt = now();
        }
        if ($status === 'Pending') {
            $completedAt = null;
            $dismissedAt = null;
        }

        return array_filter([
            'reminder_number' => $data['reminder_number'] ?? $data['reminderNumber'] ?? $existing?->reminder_number,
            'title' => trim((string) $title),
            'message' => $message !== null ? (string) $message : null,
            'description' => $description !== null ? (string) $description : null,
            'reminder_type' => $type,
            'due_date' => Carbon::parse($due)->toDateString(),
            'next_reminder' => isset($data['next_reminder']) || isset($data['nextReminder'])
                ? (($data['next_reminder'] ?? $data['nextReminder'])
                    ? Carbon::parse($data['next_reminder'] ?? $data['nextReminder'])->toDateString()
                    : null)
                : ($existing?->next_reminder?->format('Y-m-d') ?: Carbon::parse($due)->toDateString()),
            'last_sent' => isset($data['last_sent']) || isset($data['lastSent'])
                ? (($data['last_sent'] ?? $data['lastSent'])
                    ? Carbon::parse($data['last_sent'] ?? $data['lastSent'])->toDateString()
                    : null)
                : optional($existing?->last_sent)?->format('Y-m-d'),
            'status' => $status,
            'priority' => $priority,
            'related_type' => $relatedType ? strtolower((string) $relatedType) : null,
            'related_id' => $this->nullableInt($relatedId),
            'product_id' => $this->nullableInt($productId),
            'frequency' => $data['frequency'] ?? $existing?->frequency,
            'is_recurring' => $isRecurring,
            'link' => $data['link'] ?? $existing?->link,
            'notes' => $data['notes'] ?? $existing?->notes,
            'completed_at' => $completedAt,
            'dismissed_at' => $dismissedAt,
        ], fn ($v) => $v !== null);
    }

    private function assertRelated(?string $type, mixed $id): void
    {
        if (! $type || $id === null || $id === '') {
            throw ValidationException::withMessages([
                'related_id' => ['Both related_type and related_id are required together.'],
            ]);
        }

        $type = strtolower($type);
        if (! in_array($type, self::RELATED_TYPES, true)) {
            throw ValidationException::withMessages(['related_type' => ['Invalid related type.']]);
        }

        $exists = match ($type) {
            'check' => EquipmentCheck::query()->whereKey($id)->exists(),
            'maintenance' => MaintenanceRecord::query()->whereKey($id)->exists(),
            'rental' => Rental::query()->whereKey($id)->exists(),
            'booking' => Booking::query()->whereKey($id)->exists(),
            'product' => Product::query()->whereKey($id)->exists(),
            'customer' => Customer::query()->whereKey($id)->exists(),
            default => true, // sale/income/expense soft-validated by type only if tables vary
        };

        if (! $exists) {
            throw ValidationException::withMessages([
                'related_id' => ["Related {$type} record was not found."],
            ]);
        }
    }

    private function nullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (int) $value;
    }
}
