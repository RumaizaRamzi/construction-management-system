<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use App\Services\SettingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SettingController extends Controller
{
    public function __construct(
        private readonly SettingService $settings,
        private readonly ActivityLogService $logs
    ) {
    }

    public function show(Request $request): JsonResponse
    {
        return $this->success($this->settings->payloadFor($request->user()), 'Settings retrieved.');
    }

    public function update(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'company_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'company_subtitle' => ['sometimes', 'nullable', 'string', 'max:255'],
            'address' => ['sometimes', 'nullable', 'string', 'max:500'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'website' => ['sometimes', 'nullable', 'string', 'max:255'],
            'tax_number' => ['sometimes', 'nullable', 'string', 'max:100'],
            'business_registration' => ['sometimes', 'nullable', 'string', 'max:100'],
            'bank_details' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'currency' => ['sometimes', 'string', 'in:LKR,USD,EUR,GBP,INR'],
            'tax_rate' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'invoice_prefix' => ['sometimes', 'nullable', 'string', 'max:20'],
            'invoice_footer' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'rental_terms' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'rental_deposit_percent' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'late_fee_per_day' => ['sometimes', 'numeric', 'min:0', 'max:10000000'],
            'low_stock_alerts' => ['sometimes', 'boolean'],
            'email_notifications' => ['sometimes', 'boolean'],
            'sms_notifications' => ['sometimes', 'boolean'],
            'enable_notifications' => ['sometimes', 'boolean'],
            'enable_rental_reminders' => ['sometimes', 'boolean'],
            'enable_low_stock_alerts' => ['sometimes', 'boolean'],
            'enable_maintenance_reminders' => ['sometimes', 'boolean'],
            'enable_payment_alerts' => ['sometimes', 'boolean'],
            'enable_booking_notifications' => ['sometimes', 'boolean'],
            'reminder_timing' => ['sometimes', 'string', 'max:50'],
            'holiday_overrides' => ['sometimes', 'array', 'max:300'],
            'holiday_overrides.*.action' => ['required', 'string', 'in:add,remove'],
            'holiday_overrides.*.date' => ['required', 'date_format:Y-m-d'],
            'holiday_overrides.*.name' => ['required', 'string', 'max:100'],
            'holiday_overrides.*.kind' => ['nullable', 'string', 'in:poya,public'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        $diff = $this->settings->update($validator->validated());

        if ($diff['new'] !== []) {
            $this->logs->record(
                'updated',
                'settings',
                'Updated settings ('.implode(', ', array_map(fn ($k) => str_replace('_', ' ', $k), array_keys($diff['new']))).')',
                null,
                $diff['old'],
                $diff['new']
            );
        }

        return $this->success($this->settings->publicPayload(), 'Settings saved.');
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'logo' => ['required', 'file', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048', 'dimensions:max_width=4000,max_height=4000'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        $this->settings->storeLogo($request->file('logo'));
        $this->logs->record('updated', 'settings', 'Uploaded company logo');

        return $this->success($this->settings->publicPayload(), 'Logo uploaded.');
    }

    public function removeLogo(): JsonResponse
    {
        $this->settings->removeLogo();
        $this->logs->record('deleted', 'settings', 'Removed company logo');

        return $this->success($this->settings->publicPayload(), 'Logo removed.');
    }
}
