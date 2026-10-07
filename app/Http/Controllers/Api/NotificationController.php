<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Services\NotificationAlertService;
use App\Services\NotificationService;
use App\Support\QuerySafety;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Throwable;

class NotificationController extends Controller
{
    public function __construct(
        private readonly NotificationService $notificationService,
        private readonly NotificationAlertService $alertService
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = QuerySafety::perPage($request->query('per_page'), 50, 100);
        $userId = (int) $request->user()->id;

        $query = Notification::query()
            ->where(function ($q) use ($userId) {
                $q->whereNull('user_id')->orWhere('user_id', $userId);
            })
            ->where('status', '!=', Notification::STATUS_DISMISSED)
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($request->boolean('unread_only')) {
            $query->unread();
        }
        if ($type = $request->query('type') ?: $request->query('notification_type')) {
            $query->where('type', $type);
        }
        if ($category = $request->query('category')) {
            $query->where('category', $category);
        }
        if ($priority = $request->query('priority')) {
            $query->where('priority', $priority);
        }
        if ($search = trim((string) $request->query('search', ''))) {
            $like = QuerySafety::likeContains($search);
            $query->where(function ($q) use ($like) {
                $q->where('title', 'like', $like)
                    ->orWhere('message', 'like', $like)
                    ->orWhere('type', 'like', $like);
            });
        }

        $page = $query->paginate($perPage)->through(
            fn (Notification $n) => $this->notificationService->transform($n)
        );

        return $this->success($page, 'Notifications retrieved successfully.');
    }

    public function show(Request $request, Notification $notification): JsonResponse
    {
        if (! $this->userCanAccessNotification($request, $notification)) {
            return $this->error('You do not have permission to view this notification.', 403);
        }

        return $this->success(
            $this->notificationService->transform($notification),
            'Notification retrieved successfully.'
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'title' => ['required', 'string', 'max:255'],
            'message' => ['nullable', 'string', 'max:5000'],
            'type' => ['nullable', 'string', 'max:100'],
            'notification_type' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:100'],
            'priority' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'string', 'max:30'],
            'related_type' => ['nullable', 'string', 'max:50'],
            'related_id' => ['nullable', 'integer'],
            'link' => ['nullable', 'string', 'max:255'],
            'action_url' => ['nullable', 'string', 'max:255'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        try {
            $created = $this->notificationService->createNotification(
                $validator->validated(),
                true
            );

            return $this->success(
                $this->notificationService->transform($created),
                'Notification created successfully.',
                201
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to create notification.', 500);
        }
    }

    public function update(Request $request, Notification $notification): JsonResponse
    {
        if (! $this->userCanAccessNotification($request, $notification)) {
            return $this->error('You do not have permission to update this notification.', 403);
        }

        $validator = Validator::make($request->all(), [
            'title' => ['sometimes', 'string', 'max:255'],
            'message' => ['nullable', 'string', 'max:5000'],
            'type' => ['nullable', 'string', 'max:100'],
            'notification_type' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:100'],
            'priority' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'string', 'max:30'],
            'related_type' => ['nullable', 'string', 'max:50'],
            'related_id' => ['nullable', 'integer'],
            'link' => ['nullable', 'string', 'max:255'],
            'action_url' => ['nullable', 'string', 'max:255'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        try {
            $updated = $this->notificationService->update($notification, $validator->validated());

            return $this->success(
                $this->notificationService->transform($updated),
                'Notification updated successfully.'
            );
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update notification.', 500);
        }
    }

    public function destroy(Request $request, Notification $notification): JsonResponse
    {
        if (! $this->userCanAccessNotification($request, $notification)) {
            return $this->error('You do not have permission to delete this notification.', 403);
        }

        try {
            $notification->delete();

            return $this->success(null, 'Notification deleted successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to delete notification.', 500);
        }
    }

    public function markAsRead(Request $request, Notification $notification): JsonResponse
    {
        if (! $this->userCanAccessNotification($request, $notification)) {
            return $this->error('You do not have permission to update this notification.', 403);
        }

        $updated = $this->notificationService->markAsRead($notification);

        return $this->success(
            $this->notificationService->transform($updated),
            'Notification marked as read.'
        );
    }

    public function dismiss(Request $request, Notification $notification): JsonResponse
    {
        if (! $this->userCanAccessNotification($request, $notification)) {
            return $this->error('You do not have permission to dismiss this notification.', 403);
        }

        $updated = $this->notificationService->dismiss($notification);

        return $this->success(
            $this->notificationService->transform($updated),
            'Notification dismissed.'
        );
    }

    public function markAllAsRead(Request $request): JsonResponse
    {
        $count = $this->notificationService->markAllAsRead((int) $request->user()->id);

        return $this->success(['updated' => $count], 'All notifications marked as read.');
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return $this->success(
            ['count' => $this->notificationService->unreadCount((int) $request->user()->id)],
            'Unread count retrieved successfully.'
        );
    }

    public function generate(): JsonResponse
    {
        try {
            $result = $this->alertService->generate();

            return $this->success($result, 'Notification alerts generated successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to generate notification alerts.', 500);
        }
    }

    private function userCanAccessNotification(Request $request, Notification $notification): bool
    {
        $userId = (int) $request->user()->id;

        return $notification->user_id === null || (int) $notification->user_id === $userId;
    }
}
