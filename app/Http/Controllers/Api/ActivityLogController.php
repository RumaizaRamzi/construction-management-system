<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'module' => ['nullable', 'string', 'max:50'],
            'action' => ['nullable', 'string', 'max:50'],
            'user_id' => ['nullable', 'integer'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = ActivityLog::query()->latest('id');

        if (! empty($validated['search'])) {
            $term = '%'.addcslashes($validated['search'], '%_\\').'%';
            $query->where(function ($q) use ($term) {
                $q->where('description', 'like', $term)
                    ->orWhere('subject_label', 'like', $term)
                    ->orWhere('user_name', 'like', $term);
            });
        }
        foreach (['module', 'action', 'user_id'] as $field) {
            if (! empty($validated[$field])) {
                $query->where($field, $validated[$field]);
            }
        }
        if (! empty($validated['date_from'])) {
            $query->whereDate('created_at', '>=', $validated['date_from']);
        }
        if (! empty($validated['date_to'])) {
            $query->whereDate('created_at', '<=', $validated['date_to']);
        }

        $page = $query->paginate((int) ($validated['per_page'] ?? 25));

        return $this->success([
            'data' => collect($page->items())->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'user_id' => $log->user_id,
                'user_name' => $log->user_name ?? 'System',
                'action' => $log->action,
                'module' => $log->module,
                'subject_type' => $log->subject_type,
                'subject_id' => $log->subject_id,
                'subject_label' => $log->subject_label,
                'description' => $log->description,
                'created_at' => $log->created_at?->toIso8601String(),
            ])->all(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
            'modules' => ActivityLog::query()->distinct()->orderBy('module')->pluck('module')->all(),
        ], 'Activity history retrieved.');
    }
}
