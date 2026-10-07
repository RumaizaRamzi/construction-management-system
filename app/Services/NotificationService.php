<?php

namespace App\Services;

use App\Models\Notification;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class NotificationService
{
    public function categoryForType(string $type): string
    {
        return match ($type) {
            'Low Stock' => 'Inventory',
            'Overdue Rental', 'Rental Return Due' => 'Rentals',
            'Booking Reminder' => 'Bookings',
            'Payment Due', 'Payment Overdue' => 'Payments',
            'Cheque Due in 3 Days', 'Cheque Due Tomorrow', 'Cheque Due Today', 'Cheque Overdue', 'Cheque Bounced' => 'Payments',
            'Maintenance Due' => 'Maintenance',
            'Check Due' => 'Maintenance',
            'Reminder' => 'System',
            'System Alert' => 'System',
            default => 'System',
        };
    }

    public function actionUrl(string $relatedType, ?int $relatedId): ?string
    {
        if (! $relatedId) {
            return null;
        }

        return match (strtolower($relatedType)) {
            'product' => "/products/{$relatedId}",
            'rental' => "/rentals/{$relatedId}",
            'booking' => '/bookings',
            'sale' => "/sales/{$relatedId}",
            'income' => "/income/{$relatedId}",
            'expense' => "/expenses/{$relatedId}",
            'maintenance' => "/maintenance/{$relatedId}",
            'check', 'equipment_check' => "/checks/{$relatedId}",
            'cheque' => "/cheques/{$relatedId}",
            'reminder' => '/reminders',
            default => null,
        };
    }

    /**
     * Create a notification unless an equivalent one (unread, read or dismissed) already exists,
     * so the scheduled generator never resurrects alerts the user has dismissed.
     */
    public function createNotification(array $data, bool $skipDuplicateCheck = false): ?Notification
    {
        $type = (string) ($data['type'] ?? $data['notification_type'] ?? 'System Alert');
        $relatedType = $data['related_type'] ?? null;
        $relatedId = isset($data['related_id']) ? (int) $data['related_id'] : null;

        if (! $skipDuplicateCheck && $relatedType && $relatedId) {
            $exists = Notification::query()
                ->where('type', $type)
                ->where('related_type', $relatedType)
                ->where('related_id', $relatedId)
                ->exists();

            if ($exists) {
                return null;
            }
        }

        $link = $data['link'] ?? $data['action_url'] ?? null;
        if (! $link && $relatedType) {
            $link = $this->actionUrl((string) $relatedType, $relatedId);
        }

        $status = $data['status'] ?? Notification::STATUS_UNREAD;
        $isRead = $status === Notification::STATUS_READ || $status === Notification::STATUS_DISMISSED
            || (! empty($data['is_read']));

        return Notification::query()->create([
            'user_id' => $data['user_id'] ?? null,
            'type' => $type,
            'category' => $data['category'] ?? $this->categoryForType($type),
            'priority' => $data['priority'] ?? 'Medium',
            'title' => $data['title'],
            'message' => $data['message'] ?? '',
            'related_type' => $relatedType,
            'related_id' => $relatedId,
            'link' => $link,
            'action_url' => $data['action_url'] ?? $link,
            'is_read' => $isRead,
            'status' => $isRead && $status === Notification::STATUS_UNREAD
                ? Notification::STATUS_READ
                : $status,
            'read_at' => $isRead ? ($data['read_at'] ?? now()) : null,
        ]);
    }

    public function createLowStockNotification(object $product): ?Notification
    {
        $available = (int) ($product->available_quantity ?? 0);
        $min = (int) ($product->minimum_stock ?? 0);
        $name = $product->name ?? 'Product';

        return $this->createNotification([
            'type' => 'Low Stock',
            'title' => 'Low Stock Alert',
            'message' => "{$name} stock is below the minimum level. Available {$available} (minimum {$min}).",
            'priority' => $available <= 0 ? 'High' : 'Medium',
            'related_type' => 'product',
            'related_id' => $product->id,
        ]);
    }

    public function createOverdueRentalNotification(object $rental): ?Notification
    {
        $number = $rental->rental_number ?? "Rental #{$rental->id}";

        return $this->createNotification([
            'type' => 'Overdue Rental',
            'title' => 'Overdue Rental',
            'message' => "Rental {$number} is overdue for return.",
            'priority' => 'High',
            'related_type' => 'rental',
            'related_id' => $rental->id,
        ]);
    }

    public function createRentalReturnDueNotification(object $rental, int $daysUntil): ?Notification
    {
        $number = $rental->rental_number ?? "Rental #{$rental->id}";
        $when = $daysUntil === 0 ? 'today' : ($daysUntil === 1 ? 'tomorrow' : "in {$daysUntil} days");

        return $this->createNotification([
            'type' => 'Rental Return Due',
            'title' => 'Rental Return Due',
            'message' => "Rental {$number} return is due {$when}.",
            'priority' => $daysUntil === 0 ? 'High' : 'Medium',
            'related_type' => 'rental',
            'related_id' => $rental->id,
        ]);
    }

    public function createPaymentDueNotification(
        string $relatedType,
        int $relatedId,
        string $label,
        float $balance,
        bool $overdue = false
    ): ?Notification {
        $formatted = number_format($balance, 2);

        return $this->createNotification([
            'type' => $overdue ? 'Payment Overdue' : 'Payment Due',
            'title' => $overdue ? 'Payment Overdue' : 'Payment Due',
            'message' => "{$label} has an outstanding balance of LKR {$formatted}.",
            'priority' => $overdue ? 'Critical' : 'High',
            'related_type' => $relatedType,
            'related_id' => $relatedId,
        ]);
    }

    public function createMaintenanceDueNotification(object $maintenance): ?Notification
    {
        $number = $maintenance->maintenance_number ?? "Maintenance #{$maintenance->id}";
        $priority = $maintenance->priority ?: 'Medium';

        return $this->createNotification([
            'type' => 'Maintenance Due',
            'title' => 'Maintenance Due',
            'message' => "{$number} is due or approaching its scheduled date.",
            'priority' => in_array($priority, ['Low', 'Medium', 'High', 'Critical'], true) ? $priority : 'Medium',
            'related_type' => 'maintenance',
            'related_id' => $maintenance->id,
            'link' => "/maintenance/{$maintenance->id}",
        ]);
    }

    public function createCheckDueNotification(object $check): ?Notification
    {
        $number = $check->check_number ?? "Check #{$check->id}";
        $priority = $check->priority ?: 'Medium';

        return $this->createNotification([
            'type' => 'Check Due',
            'title' => 'Check Due',
            'message' => "{$number} is due or approaching its scheduled date.",
            'priority' => in_array($priority, ['Low', 'Medium', 'High', 'Critical'], true) ? $priority : 'Medium',
            'related_type' => 'check',
            'related_id' => $check->id,
        ]);
    }

    /**
     * One alert per cheque per stage (3 days, 1 day, due today, overdue). The message carries the cheque date and amount,
     * so moving the date produces fresh reminders instead of being blocked by the old ones.
     */
    public function createChequeReminderNotification(object $cheque, string $description, int $daysUntil): ?Notification
    {
        [$type, $priority] = match (true) {
            $daysUntil < 0 => ['Cheque Overdue', 'Critical'],
            $daysUntil === 0 => ['Cheque Due Today', 'High'],
            $daysUntil === 1 => ['Cheque Due Tomorrow', 'High'],
            default => ['Cheque Due in 3 Days', 'Medium'],
        };
        $title = $type;
        $date = Carbon::parse($cheque->cheque_date)->format('d M Y');
        $message = $daysUntil < 0
            ? "{$description} was due on {$date} and is still pending."
            : "{$description} is due on {$date}.";

        $exists = Notification::query()
            ->where('type', $type)
            ->where('related_type', 'cheque')
            ->where('related_id', $cheque->id)
            ->where('message', $message)
            ->exists();
        if ($exists) {
            return null;
        }

        return $this->createNotification([
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'priority' => $priority,
            'related_type' => 'cheque',
            'related_id' => $cheque->id,
        ], true);
    }

    public function createBookingReminderNotification(object $booking, int $daysUntil): ?Notification
    {
        $number = $booking->booking_number ?? "Booking #{$booking->id}";
        $when = $daysUntil === 0 ? 'today' : ($daysUntil === 1 ? 'tomorrow' : "in {$daysUntil} days");

        return $this->createNotification([
            'type' => 'Booking Reminder',
            'title' => 'Booking Reminder',
            'message' => "{$number} starts {$when}.",
            'priority' => $daysUntil === 0 ? 'High' : 'Medium',
            'related_type' => 'booking',
            'related_id' => $booking->id,
        ]);
    }

    public function createReminderNotification(object $reminder): ?Notification
    {
        return $this->createNotification([
            'type' => 'Reminder',
            'title' => $reminder->title ?: 'Reminder Due',
            'message' => $reminder->message ?: "Reminder \"{$reminder->title}\" is due.",
            'priority' => $reminder->priority ?: 'Medium',
            'related_type' => 'reminder',
            'related_id' => $reminder->id,
            'link' => $reminder->link ?: '/reminders',
        ]);
    }

    public function update(Notification $notification, array $data): Notification
    {
        $payload = [];
        foreach (['title', 'message', 'type', 'category', 'priority', 'related_type', 'related_id', 'link', 'action_url', 'user_id'] as $field) {
            if (array_key_exists($field, $data)) {
                $payload[$field] = $data[$field];
            }
        }
        if (array_key_exists('notification_type', $data)) {
            $payload['type'] = $data['notification_type'];
        }
        if (array_key_exists('status', $data)) {
            $status = $data['status'];
            $payload['status'] = $status;
            $payload['is_read'] = $status !== Notification::STATUS_UNREAD;
            if ($payload['is_read'] && ! $notification->read_at) {
                $payload['read_at'] = now();
            }
            if ($status === Notification::STATUS_UNREAD) {
                $payload['read_at'] = null;
                $payload['is_read'] = false;
            }
        }

        $notification->update($payload);

        return $notification->fresh();
    }

    public function markAsRead(Notification $notification): Notification
    {
        return $notification->markRead();
    }

    public function dismiss(Notification $notification): Notification
    {
        return $notification->dismiss();
    }

    public function markAllAsRead(?int $userId = null): int
    {
        return DB::transaction(function () use ($userId) {
            $query = Notification::query()->unread();
            if ($userId) {
                $query->where(function ($q) use ($userId) {
                    $q->whereNull('user_id')->orWhere('user_id', $userId);
                });
            }

            return $query->update([
                'is_read' => true,
                'status' => Notification::STATUS_READ,
                'read_at' => now(),
            ]);
        });
    }

    public function unreadCount(?int $userId = null): int
    {
        $query = Notification::query()->unread();
        if ($userId) {
            $query->where(function ($q) use ($userId) {
                $q->whereNull('user_id')->orWhere('user_id', $userId);
            });
        }

        return $query->count();
    }

    public function transform(Notification $notification): array
    {
        $actionUrl = $notification->action_url ?: $notification->link;

        return [
            'id' => $notification->id,
            'title' => $notification->title,
            'message' => $notification->message,
            'type' => $notification->type,
            'notification_type' => $notification->type,
            'category' => $notification->category ?: $this->categoryForType((string) $notification->type),
            'priority' => $notification->priority ?: 'Medium',
            'status' => $notification->status ?: ($notification->is_read ? Notification::STATUS_READ : Notification::STATUS_UNREAD),
            'is_read' => (bool) $notification->is_read,
            'read' => (bool) $notification->is_read,
            'related_type' => $notification->related_type,
            'related_id' => $notification->related_id,
            'link' => $actionUrl,
            'action_url' => $actionUrl,
            'user_id' => $notification->user_id,
            'read_at' => optional($notification->read_at)?->toIso8601String(),
            'created_at' => optional($notification->created_at)?->toIso8601String(),
            'updated_at' => optional($notification->updated_at)?->toIso8601String(),
            'time' => optional($notification->created_at)?->toIso8601String(),
        ];
    }

    public function validateStore(array $data): array
    {
        if (empty($data['title'])) {
            throw ValidationException::withMessages(['title' => ['Title is required.']]);
        }
        if (empty($data['message']) && empty($data['title'])) {
            throw ValidationException::withMessages(['message' => ['Message is required.']]);
        }

        return $data;
    }
}
