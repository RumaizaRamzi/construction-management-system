<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\Staff;
use App\Models\StaffAssignment;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class StaffService
{
    public const FILE_DISK = 'local';

    public const PHOTO_DIRECTORY = 'staff-photos';

    public function __construct(private readonly ActivityLogService $logs)
    {
    }

    public function transform(Staff $staff): array
    {
        $staff->loadMissing(['role:id,name', 'branch:id,name', 'user:id,name,email']);

        return [
            'id' => $staff->id,
            'staff_code' => $staff->staff_code,
            'full_name' => $staff->full_name,
            'nic' => $staff->nic,
            'phone' => $staff->phone,
            'email' => $staff->email,
            'address' => $staff->address,
            'has_photo' => (bool) $staff->photo,
            'role_id' => $staff->role_id,
            'role_name' => $staff->role?->name,
            'branch_id' => $staff->branch_id,
            'branch_name' => $staff->branch?->name,
            'joined_date' => $staff->joined_date?->toDateString(),
            'status' => $staff->status,
            'user_id' => $staff->user_id,
            'user_name' => $staff->user?->name,
            'notes' => $staff->notes,
            'created_at' => $staff->created_at?->toIso8601String(),
            'updated_at' => $staff->updated_at?->toIso8601String(),
        ];
    }

    public function create(array $data): Staff
    {
        return DB::transaction(function () use ($data) {
            $data['staff_code'] = $this->text($data['staff_code'] ?? null) ?? $this->nextCode();
            $data['status'] ??= Staff::STATUS_ACTIVE;

            return Staff::query()->create($this->clean($data));
        });
    }

    public function update(Staff $staff, array $data): Staff
    {
        if (array_key_exists('staff_code', $data) && $this->text($data['staff_code']) === null) {
            unset($data['staff_code']);
        }
        $staff->fill($this->clean($data));
        $deactivated = $staff->isDirty('status') && $staff->status === Staff::STATUS_INACTIVE;
        $staff->save();

        if ($deactivated) {
            app(AdminUserService::class)->disableLoginForStaff($staff);
        }

        return $staff->fresh();
    }

    /** Soft delete: attendance and assignment history stay in place. */
    public function delete(Staff $staff): void
    {
        DB::transaction(function () use ($staff) {
            $staff->status = Staff::STATUS_INACTIVE;
            $staff->saveQuietly();
            $staff->delete();
            app(AdminUserService::class)->disableLoginForStaff($staff);
        });
    }

    public function storePhoto(Staff $staff, $file): Staff
    {
        $path = $file->store(self::PHOTO_DIRECTORY, self::FILE_DISK);
        if (! $path) {
            throw new \RuntimeException('Unable to store staff photo.');
        }
        $old = $staff->photo;
        $staff->photo = $path;
        $staff->save();
        if ($old && $old !== $path) {
            Storage::disk(self::FILE_DISK)->delete($old);
        }

        return $staff->fresh();
    }

    public function removePhoto(Staff $staff): Staff
    {
        if ($staff->photo) {
            Storage::disk(self::FILE_DISK)->delete($staff->photo);
            $staff->photo = null;
            $staff->save();
        }

        return $staff->fresh();
    }

    public function summary(): array
    {
        $today = now()->toDateString();

        return [
            'total' => Staff::query()->count(),
            'active' => Staff::query()->where('status', Staff::STATUS_ACTIVE)->count(),
            'inactive' => Staff::query()->where('status', Staff::STATUS_INACTIVE)->count(),
            'on_leave_today' => Attendance::query()
                ->whereDate('date', $today)
                ->where('status', Attendance::STATUS_LEAVE)
                ->whereHas('staff', fn ($q) => $q->whereNull('deleted_at'))
                ->count(),
        ];
    }

    public function details(Staff $staff, ?User $user): array
    {
        $month = now()->format('Y-m');
        [$start, $end] = $this->monthRange($month);

        $attendance = $staff->attendances()
            ->whereDate('date', '>=', $start)
            ->whereDate('date', '<=', $end)
            ->orderByDesc('date')
            ->get();

        return [
            ...$this->transform($staff),
            'month' => $month,
            'attendance_summary' => $this->counts($attendance),
            'attendance' => $attendance->map(fn (Attendance $a) => $this->transformAttendance($a))->values(),
            'assignments' => $this->assignments($staff),
            'activity' => $user?->hasPermission('activity.view') ? $this->activity($staff) : [],
        ];
    }

    public function transformAttendance(Attendance $a): array
    {
        return [
            'id' => $a->id,
            'staff_id' => $a->staff_id,
            'date' => $a->date?->toDateString(),
            'check_in' => $a->check_in ? substr((string) $a->check_in, 0, 5) : null,
            'check_out' => $a->check_out ? substr((string) $a->check_out, 0, 5) : null,
            'status' => $a->status,
            'notes' => $a->notes,
        ];
    }

    /** Active staff (plus anyone already marked that day) with their record for the date. */
    public function attendanceForDate(string $date): array
    {
        $records = Attendance::query()->whereDate('date', $date)->get()->keyBy('staff_id');

        return Staff::query()
            ->with(['role:id,name', 'branch:id,name'])
            ->where(fn ($q) => $q->where('status', Staff::STATUS_ACTIVE)->orWhereIn('id', $records->keys()))
            ->orderBy('full_name')
            ->get()
            ->map(fn (Staff $s) => [
                'staff_id' => $s->id,
                'staff_code' => $s->staff_code,
                'full_name' => $s->full_name,
                'role_name' => $s->role?->name,
                'branch_name' => $s->branch?->name,
                'staff_status' => $s->status,
                'attendance' => isset($records[$s->id]) ? $this->transformAttendance($records[$s->id]) : null,
            ])
            ->values()
            ->all();
    }

    /**
     * @param  list<array{staff_id:int,status:string,check_in?:?string,check_out?:?string,notes?:?string}>  $records
     */
    public function mark(string $date, array $records): array
    {
        $saved = DB::transaction(function () use ($date, $records) {
            $staff = Staff::query()->whereIn('id', collect($records)->pluck('staff_id'))->get()->keyBy('id');
            $existing = Attendance::query()->whereDate('date', $date)->whereIn('staff_id', $staff->keys())->get()->keyBy('staff_id');
            $rows = [];
            foreach (array_values($records) as $index => $record) {
                $member = $staff[$record['staff_id']] ?? null;
                if (! $member) {
                    throw ValidationException::withMessages(["records.{$index}.staff_id" => ['Select a valid staff member.']]);
                }
                if (! $member->isActive() && ! isset($existing[$member->id])) {
                    throw ValidationException::withMessages([
                        "records.{$index}.staff_id" => ["{$member->full_name} is inactive. Reactivate them before marking new attendance."],
                    ]);
                }
                $working = ! in_array($record['status'], Attendance::NOT_WORKING, true);
                if ($working && ! empty($record['check_in']) && ! empty($record['check_out']) && $record['check_out'] <= $record['check_in']) {
                    throw ValidationException::withMessages([
                        "records.{$index}.check_out" => ["{$member->full_name}: check-out must be after check-in."],
                    ]);
                }
                $attendance = $existing[$member->id] ?? new Attendance(['staff_id' => $member->id, 'date' => $date]);
                $attendance->fill([
                    'status' => $record['status'],
                    'check_in' => $working ? ($record['check_in'] ?? null) : null,
                    'check_out' => $working ? ($record['check_out'] ?? null) : null,
                    'notes' => $this->text($record['notes'] ?? null),
                ])->save();
                $rows[] = $attendance;
            }

            return $rows;
        });

        $this->logs->record(
            'updated',
            'staff',
            sprintf('Attendance marked for %d staff on %s', count($saved), Carbon::parse($date)->toDateString()),
            null,
            null,
            ['date' => $date, 'records' => count($saved)]
        );

        return array_map(fn (Attendance $a) => $this->transformAttendance($a), $saved);
    }

    /** Per-staff counts and day-by-day statuses for a YYYY-MM month. */
    public function monthlySummary(string $month, ?int $staffId = null): array
    {
        [$start, $end] = $this->monthRange($month);
        $records = Attendance::query()
            ->whereDate('date', '>=', $start)
            ->whereDate('date', '<=', $end)
            ->when($staffId, fn ($q) => $q->where('staff_id', $staffId))
            ->get()
            ->groupBy('staff_id');

        $rows = Staff::query()
            ->with('role:id,name')
            ->when($staffId, fn ($q) => $q->whereKey($staffId))
            ->where(fn ($q) => $q->where('status', Staff::STATUS_ACTIVE)->orWhereIn('id', $records->keys()))
            ->orderBy('full_name')
            ->get()
            ->map(function (Staff $s) use ($records) {
                $own = $records->get($s->id, collect());

                return [
                    'staff_id' => $s->id,
                    'staff_code' => $s->staff_code,
                    'full_name' => $s->full_name,
                    'role_name' => $s->role?->name,
                    'staff_status' => $s->status,
                    ...$this->counts($own),
                    'days' => $own->mapWithKeys(fn (Attendance $a) => [$a->date->toDateString() => $a->status])->all(),
                ];
            })
            ->values()
            ->all();

        return [
            'month' => $month,
            'start' => $start,
            'end' => $end,
            'days_in_month' => Carbon::parse($start)->daysInMonth,
            'rows' => $rows,
        ];
    }

    public function transformAssignment(StaffAssignment $a): array
    {
        $a->loadMissing(['staff:id,full_name,staff_code', 'vehicle:id,name,registration_number', 'rental:id,rental_number,customer_id', 'rental.customer:id,name']);
        $today = now()->toDateString();

        return [
            'id' => $a->id,
            'staff_id' => $a->staff_id,
            'staff_name' => $a->staff?->full_name,
            'vehicle_id' => $a->vehicle_id,
            'vehicle_name' => $a->vehicle?->name,
            'vehicle_registration' => $a->vehicle?->registration_number,
            'rental_id' => $a->rental_id,
            'rental_number' => $a->rental?->rental_number,
            'rental_customer' => $a->rental?->customer?->name,
            'assigned_from' => $a->assigned_from?->toDateString(),
            'assigned_to' => $a->assigned_to?->toDateString(),
            'is_current' => $a->assigned_from?->toDateString() <= $today
                && ($a->assigned_to === null || $a->assigned_to->toDateString() >= $today),
            'notes' => $a->notes,
        ];
    }

    public function assignments(Staff $staff): array
    {
        return $staff->assignments()
            ->orderByDesc('assigned_from')
            ->orderByDesc('id')
            ->get()
            ->map(fn (StaffAssignment $a) => $this->transformAssignment($a))
            ->values()
            ->all();
    }

    public function assign(Staff $staff, array $data): StaffAssignment
    {
        if (! $staff->isActive()) {
            throw ValidationException::withMessages(['staff' => ["{$staff->full_name} is inactive and cannot be assigned."]]);
        }

        return $staff->assignments()->create([
            'vehicle_id' => $data['vehicle_id'] ?? null,
            'rental_id' => $data['rental_id'] ?? null,
            'assigned_from' => $data['assigned_from'],
            'assigned_to' => $data['assigned_to'] ?? null,
            'notes' => $this->text($data['notes'] ?? null),
        ]);
    }

    public function nextCode(): string
    {
        $latest = Staff::withTrashed()->where('staff_code', 'like', 'STF-%')->pluck('staff_code')
            ->map(fn ($code) => preg_match('/^STF-(\d+)$/', $code, $m) ? (int) $m[1] : 0)
            ->max() ?? 0;
        $next = $latest + 1;
        do {
            $code = sprintf('STF-%04d', $next++);
        } while (Staff::withTrashed()->where('staff_code', $code)->exists());

        return $code;
    }

    /** @return array{present:int,absent:int,late:int,leave:int,half_day:int,marked_days:int} */
    private function counts($attendance): array
    {
        $counts = array_fill_keys(Attendance::STATUSES, 0);
        foreach ($attendance as $a) {
            if (isset($counts[$a->status])) {
                $counts[$a->status]++;
            }
        }
        $counts['marked_days'] = array_sum($counts);

        return $counts;
    }

    private function monthRange(string $month): array
    {
        $start = Carbon::createFromFormat('Y-m-d', $month.'-01')->startOfMonth();

        return [$start->toDateString(), $start->copy()->endOfMonth()->toDateString()];
    }

    private function activity(Staff $staff): array
    {
        return ActivityLog::query()
            ->where('subject_type', 'Staff')
            ->where('subject_id', $staff->id)
            ->latest('id')
            ->limit(50)
            ->get()
            ->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'user_name' => $log->user_name ?? 'System',
                'action' => $log->action,
                'description' => $log->description,
                'created_at' => $log->created_at?->toIso8601String(),
            ])
            ->all();
    }

    private function clean(array $data): array
    {
        foreach (['full_name', 'phone', 'email', 'address', 'notes', 'staff_code'] as $field) {
            if (array_key_exists($field, $data)) {
                $data[$field] = $this->text($data[$field]);
            }
        }
        if (isset($data['nic'])) {
            $data['nic'] = strtoupper(trim((string) $data['nic']));
        }
        if (isset($data['staff_code'])) {
            $data['staff_code'] = strtoupper($data['staff_code']);
        }
        unset($data['photo']);

        return $data;
    }

    private function text(mixed $value): ?string
    {
        $value = is_string($value) ? trim($value) : $value;

        return $value === '' || $value === null ? null : (string) $value;
    }
}
