<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Reminders\StoreReminderRequest;
use App\Http\Requests\Reminders\UpdateReminderRequest;
use App\Models\Reminder;
use App\Services\ReminderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;

class ReminderController extends Controller
{
    public function __construct(private readonly ReminderService $reminders)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->query('per_page', 50)));

        $query = Reminder::query()
            ->with(['product:id,serial_number,name'])
            ->orderByDesc('due_date')
            ->orderByDesc('id');

        if ($request->boolean('recurring_only') || $request->query('is_recurring') === '1') {
            $query->where('is_recurring', true);
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('message', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('reminder_number', 'like', "%{$search}%")
                    ->orWhereHas('product', fn ($p) => $p->where('name', 'like', "%{$search}%"));
            });
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($type = $request->query('reminder_type') ?: $request->query('type') ?: $request->query('source')) {
            $query->where('reminder_type', $type);
        }
        if ($priority = $request->query('priority')) {
            $query->where('priority', $priority);
        }

        $page = $query->paginate($perPage)->through(
            fn (Reminder $reminder) => $this->reminders->transform($reminder)
        );

        return $this->success($page, 'Reminders retrieved successfully.');
    }

    public function show(Reminder $reminder): JsonResponse
    {
        return $this->success($this->reminders->transform($reminder), 'Reminder retrieved successfully.');
    }

    public function store(StoreReminderRequest $request): JsonResponse
    {
        try {
            $reminder = $this->reminders->create($request->validated());

            return $this->success($this->reminders->transform($reminder), 'Reminder created successfully.', 201);
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to create reminder. Please try again.', 500);
        }
    }

    public function update(UpdateReminderRequest $request, Reminder $reminder): JsonResponse
    {
        try {
            $updated = $this->reminders->update($reminder, $request->validated());

            return $this->success($this->reminders->transform($updated), 'Reminder updated successfully.');
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update reminder. Please try again.', 500);
        }
    }

    public function complete(Reminder $reminder): JsonResponse
    {
        try {
            $updated = $this->reminders->complete($reminder);

            return $this->success($this->reminders->transform($updated), 'Reminder completed successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to complete reminder. Please try again.', 500);
        }
    }

    public function dismiss(Reminder $reminder): JsonResponse
    {
        try {
            $updated = $this->reminders->dismiss($reminder);

            return $this->success($this->reminders->transform($updated), 'Reminder dismissed successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to dismiss reminder. Please try again.', 500);
        }
    }

    public function destroy(Reminder $reminder): JsonResponse
    {
        try {
            $this->reminders->delete($reminder);

            return $this->success(null, 'Reminder deleted successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to delete reminder. Please try again.', 500);
        }
    }
}
