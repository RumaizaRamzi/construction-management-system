<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Throwable;

class ReportController extends Controller
{
    public function __construct(
        private readonly ReportService $reports,
        private readonly ActivityLogService $logs
    ) {
    }

    /**
     * Server-side gate for client-generated report exports (reports.export).
     */
    public function authorizeExport(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'report' => ['required', 'string', 'max:100'],
            'format' => ['required', 'string', 'in:csv,excel'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        $data = $validator->validated();
        $this->logs->record(
            'exported',
            'reports',
            sprintf('Exported %s report (%s)', $data['report'], strtoupper($data['format']))
        );

        return $this->success(['allowed' => true], 'Export authorized.');
    }

    /**
     * Remove income/expense figures the user is not permitted to see.
     */
    private function redactFinancials(array $data, Request $request): array
    {
        $user = $request->user();
        $canIncome = (bool) $user?->hasPermission('income.view');
        $canExpenses = (bool) $user?->hasPermission('expenses.view');

        if ($canIncome && $canExpenses) {
            return $data;
        }

        $hidden = ['net_cash_flow', 'outstanding_payments'];
        if (! $canIncome) {
            array_push($hidden, 'total_income', 'outstanding_income');
        }
        if (! $canExpenses) {
            array_push($hidden, 'total_expenses', 'outstanding_expenses');
        }

        $strip = function (array $row) use ($hidden) {
            foreach ($hidden as $key) {
                if (array_key_exists($key, $row)) {
                    $row[$key] = null;
                }
            }

            return $row;
        };

        $data = $strip($data);
        if (isset($data['summary']) && is_array($data['summary'])) {
            $data['summary'] = $strip($data['summary']);
        }

        if (isset($data['charts']) && is_array($data['charts'])) {
            foreach (['income_vs_expenses', 'monthly_cash_flow'] as $key) {
                if (array_key_exists($key, $data['charts'])) {
                    $data['charts'][$key] = [];
                }
            }
            if (! $canIncome && array_key_exists('income_by_source', $data['charts'])) {
                $data['charts']['income_by_source'] = [];
            }
            if (! $canExpenses && array_key_exists('expenses_by_category', $data['charts'])) {
                $data['charts']['expenses_by_category'] = [];
            }
        }

        if (isset($data['outstanding']) && is_array($data['outstanding'])) {
            $data['outstanding'] = array_values(array_filter($data['outstanding'], function ($row) use ($canIncome, $canExpenses) {
                $type = $row['type'] ?? null;

                return ! (($type === 'Income' && ! $canIncome) || ($type === 'Expense' && ! $canExpenses));
            }));
        }

        return $data;
    }

    private function range(Request $request): array
    {
        return $this->reports->resolveDateRange(
            $request->query('from'),
            $request->query('to'),
            $request->query('preset')
        );
    }

    public function dashboard(Request $request): JsonResponse
    {
        try {
            $range = $this->range($request);

            return $this->success(
                $this->redactFinancials($this->reports->dashboard($range['from'], $range['to']), $request),
                'Dashboard report generated successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to generate dashboard report.', 500);
        }
    }

    public function summary(Request $request): JsonResponse
    {
        try {
            $range = $this->range($request);

            return $this->success(
                $this->redactFinancials($this->reports->summary($range['from'], $range['to']), $request),
                'Report summary generated successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to generate report summary.', 500);
        }
    }

    public function sales(Request $request): JsonResponse
    {
        try {
            $range = $this->range($request);

            return $this->success(
                $this->reports->sales($range['from'], $range['to']),
                'Sales report generated successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to generate sales report.', 500);
        }
    }

    public function rentals(Request $request): JsonResponse
    {
        try {
            $range = $this->range($request);

            return $this->success(
                $this->reports->rentals($range['from'], $range['to']),
                'Rental report generated successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to generate rental report.', 500);
        }
    }

    public function inventory(): JsonResponse
    {
        try {
            return $this->success(
                $this->reports->inventory(),
                'Inventory report generated successfully.'
            );
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to generate inventory report.', 500);
        }
    }

    public function inventoryUsage(Request $request): JsonResponse
    {
        try {
            $range = $this->range($request);

            return $this->success(
                $this->reports->inventoryUsage($range['from'], $range['to']),
                'Inventory usage report generated successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to generate inventory usage report.', 500);
        }
    }

    public function equipment(): JsonResponse
    {
        try {
            return $this->success(
                $this->reports->equipment(),
                'Equipment report generated successfully.'
            );
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to generate equipment report.', 500);
        }
    }

    public function financial(Request $request): JsonResponse
    {
        try {
            $range = $this->range($request);

            return $this->success(
                $this->reports->financial($range['from'], $range['to']),
                'Financial report generated successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to generate financial report.', 500);
        }
    }

    public function customers(Request $request): JsonResponse
    {
        try {
            $range = $this->range($request);

            return $this->success(
                $this->reports->customers($range['from'], $range['to']),
                'Customer report generated successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to generate customer report.', 500);
        }
    }

    public function customerDetails(Request $request, int $customerId): JsonResponse
    {
        try {
            $range = $this->range($request);

            return $this->success(
                $this->reports->customerDetails($customerId, $range['from'], $range['to']),
                'Customer details report generated successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to generate customer details report.', 500);
        }
    }
}
