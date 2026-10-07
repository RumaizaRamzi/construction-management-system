<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'auditable_type' => ['nullable', 'string', 'max:100'],
            'auditable_id' => ['nullable', 'integer'],
            'action' => ['nullable', 'string', 'max:50'],
            'user_id' => ['nullable', 'integer'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = AuditLog::query()->latest('id');

        if (! empty($validated['search'])) {
            $term = '%'.addcslashes($validated['search'], '%_\\').'%';
            $query->where(function ($q) use ($term) {
                $q->where('auditable_label', 'like', $term)
                    ->orWhere('user_name', 'like', $term)
                    ->orWhere('auditable_type', 'like', $term);
            });
        }
        foreach (['auditable_type', 'auditable_id', 'action', 'user_id'] as $field) {
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
            'data' => collect($page->items())->map(fn (AuditLog $log) => $this->transform($log))->all(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
            'types' => AuditLog::query()->distinct()->orderBy('auditable_type')->pluck('auditable_type')->all(),
        ], 'Audit logs retrieved.');
    }

    public function show(AuditLog $auditLog): JsonResponse
    {
        return $this->success($this->transform($auditLog), 'Audit log retrieved.');
    }

    private function transform(AuditLog $log): array
    {
        $old = $log->old_values ?? [];
        $new = $log->new_values ?? [];
        $changes = [];
        foreach (array_unique(array_merge(array_keys($old), array_keys($new))) as $field) {
            $changes[] = [
                'field' => $field,
                'old' => $old[$field] ?? null,
                'new' => $new[$field] ?? null,
            ];
        }

        return [
            'id' => $log->id,
            'user_id' => $log->user_id,
            'user_name' => $log->user_name ?? 'System',
            'action' => $log->action,
            'auditable_type' => $log->auditable_type,
            'auditable_id' => $log->auditable_id,
            'auditable_label' => $log->auditable_label,
            'changes' => $changes,
            'ip_address' => $log->ip_address,
            'user_agent' => $log->user_agent,
            'created_at' => $log->created_at?->toIso8601String(),
        ];
    }
}
