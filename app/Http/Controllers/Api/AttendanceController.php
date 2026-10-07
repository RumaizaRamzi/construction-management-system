<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Services\StaffService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class AttendanceController extends Controller
{
    public function __construct(private readonly StaffService $staff)
    {
    }

    /** Active staff with their attendance for one date (defaults to today). */
    public function index(Request $request): JsonResponse
    {
        $validator = Validator::make($request->query(), ['date' => ['nullable', 'date_format:Y-m-d']]);
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }
        $date = $request->query('date') ?: now()->toDateString();

        return $this->success([
            'date' => $date,
            'statuses' => Attendance::STATUSES,
            'rows' => $this->staff->attendanceForDate($date),
        ], 'Attendance retrieved successfully.');
    }

    public function summary(Request $request): JsonResponse
    {
        $validator = Validator::make($request->query(), [
            'month' => ['nullable', 'date_format:Y-m'],
            'staff_id' => ['nullable', 'integer', 'exists:staff,id'],
        ]);
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        return $this->success(
            $this->staff->monthlySummary($request->query('month') ?: now()->format('Y-m'), $request->integer('staff_id') ?: null),
            'Attendance summary retrieved successfully.'
        );
    }

    /** Mark one staff member for a date. */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'date' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            ...$this->recordRules(''),
        ], $this->messages());
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }
        $data = $validator->validated();

        return $this->guard(function () use ($data) {
            $record = $this->staff->mark($data['date'], [$data])[0];

            return $this->success($record, 'Attendance saved.');
        });
    }

    /** Mark many staff members for one date. */
    public function bulk(Request $request): JsonResponse
    {
        $rules = [
            'date' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'records' => ['required', 'array', 'min:1', 'max:500'],
            ...$this->recordRules('records.*.'),
        ];
        $rules['records.*.staff_id'][] = 'distinct';
        $validator = Validator::make($request->all(), $rules, $this->messages());
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }
        $data = $validator->validated();

        return $this->guard(function () use ($data) {
            $saved = $this->staff->mark($data['date'], $data['records']);

            return $this->success($saved, sprintf('Attendance saved for %d staff member(s).', count($saved)));
        });
    }

    private function recordRules(string $prefix): array
    {
        return [
            "{$prefix}staff_id" => ['required', 'integer', 'exists:staff,id'],
            "{$prefix}status" => ['required', Rule::in(Attendance::STATUSES)],
            "{$prefix}check_in" => ['nullable', 'date_format:H:i'],
            "{$prefix}check_out" => ['nullable', 'date_format:H:i'],
            "{$prefix}notes" => ['nullable', 'string', 'max:500'],
        ];
    }

    private function messages(): array
    {
        return [
            'date.before_or_equal' => 'Attendance cannot be marked for a future date.',
            'records.required' => 'There is no attendance to save.',
            '*.status.required' => 'Choose an attendance status.',
            '*.check_in.date_format' => 'Enter check-in time as HH:MM.',
            '*.check_out.date_format' => 'Enter check-out time as HH:MM.',
            'records.*.staff_id.distinct' => 'A staff member appears more than once.',
        ];
    }

    private function guard(callable $callback): JsonResponse
    {
        try {
            return $callback();
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to save attendance. Please try again.', 500);
        }
    }
}
