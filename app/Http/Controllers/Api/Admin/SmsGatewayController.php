<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use App\Services\SmsGatewayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class SmsGatewayController extends Controller
{
    public function __construct(
        private readonly SmsGatewayService $sms,
        private readonly ActivityLogService $logs
    ) {
    }

    public function show(): JsonResponse
    {
        return $this->success($this->sms->publicConfig(), 'SMS gateway settings retrieved.');
    }

    public function update(Request $request): JsonResponse
    {
        $rules = [
            'sms_service' => ['present', 'nullable', Rule::in(SmsGatewayService::PROVIDERS)],
            'default_country_code' => ['nullable', 'regex:/^\+?\d{1,4}$/'],
            'notifylk_user_id' => ['nullable', 'string', 'max:100'],
            'notifylk_api_key' => ['nullable', 'string', 'max:255'],
            'notifylk_sender_id' => ['nullable', 'string', 'max:11'],
            'twilio_sid' => ['nullable', 'string', 'max:100'],
            'twilio_token' => ['nullable', 'string', 'max:255'],
            'twilio_from' => ['nullable', 'string', 'max:30'],
            'nexmo_key' => ['nullable', 'string', 'max:100'],
            'nexmo_secret' => ['nullable', 'string', 'max:255'],
            'nexmo_from' => ['nullable', 'string', 'max:30'],
            'url' => ['nullable', 'url:http,https', 'max:500', 'required_if:sms_service,other'],
            'send_to_param_name' => ['nullable', 'string', 'max:100', 'required_if:sms_service,other'],
            'send_to_param_type' => ['nullable', Rule::in(['string', 'array'])],
            'msg_param_name' => ['nullable', 'string', 'max:100', 'required_if:sms_service,other'],
            'request_method' => ['nullable', Rule::in(['get', 'post'])],
            'data_parameter_type' => ['nullable', Rule::in(['form-data', 'json'])],
            'clear_secrets' => ['nullable', 'array'],
            'clear_secrets.*' => ['string'],
        ];
        for ($i = 1; $i <= SmsGatewayService::HEADER_COUNT; $i++) {
            $rules["header_{$i}"] = ['nullable', 'string', 'max:100', 'regex:/^[A-Za-z0-9\-_]*$/'];
            $rules["header_val_{$i}"] = ['nullable', 'string', 'max:1000'];
        }
        for ($i = 1; $i <= SmsGatewayService::PARAM_COUNT; $i++) {
            $rules["param_{$i}"] = ['nullable', 'string', 'max:100'];
            $rules["param_val_{$i}"] = ['nullable', 'string', 'max:1000'];
        }

        $validator = Validator::make($request->all(), $rules, [
            'url.url' => 'Enter a valid URL starting with http:// or https://.',
            'url.required_if' => 'The gateway URL is required for a custom provider.',
            'send_to_param_name.required_if' => 'The "send to" parameter name is required for a custom provider.',
            'msg_param_name.required_if' => 'The message parameter name is required for a custom provider.',
            'notifylk_sender_id.max' => 'Sender ID may not be longer than 11 characters.',
            'default_country_code.regex' => 'Country code must be 1 to 4 digits (e.g. 94).',
            'header_1.regex' => 'Header names may only contain letters, numbers, dashes and underscores.',
            'header_2.regex' => 'Header names may only contain letters, numbers, dashes and underscores.',
            'header_3.regex' => 'Header names may only contain letters, numbers, dashes and underscores.',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        $data = $validator->validated();
        if (isset($data['default_country_code'])) {
            $data['default_country_code'] = ltrim($data['default_country_code'], '+');
        }
        $clear = $data['clear_secrets'] ?? [];
        unset($data['clear_secrets']);

        $changed = $this->sms->update($data, $clear);

        if ($changed !== []) {
            $provider = SmsGatewayService::PROVIDER_LABELS[$this->sms->config()['sms_service']] ?? 'None';
            $this->logs->record(
                'updated',
                'settings',
                'Updated SMS gateway settings (provider: '.$provider.', '.count($changed).' field(s) changed)'
            );
        }

        return $this->success($this->sms->publicConfig(), 'SMS gateway settings saved.');
    }

    public function test(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'test_number' => ['required', 'string', 'max:20', 'regex:/^\+?[\d\s\-()]{8,20}$/'],
            'message' => ['nullable', 'string', 'max:480'],
        ], [
            'test_number.required' => 'Enter a mobile number to send the test SMS to.',
            'test_number.regex' => 'Enter a valid mobile number (e.g. 0771234567 or +94771234567).',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        if (! $this->sms->isConfigured()) {
            return $this->error('Configure and save the SMS gateway settings before sending a test SMS.', 422);
        }

        $number = $request->string('test_number')->toString();
        $message = trim((string) $request->input('message')) ?: 'This is a test SMS from RN TRADING LANKA PVT. LTD.';
        $result = $this->sms->send($number, $message);

        $provider = SmsGatewayService::PROVIDER_LABELS[$this->sms->config()['sms_service']] ?? '';
        $this->logs->record(
            'sms_test',
            'settings',
            'Test SMS to '.SmsGatewayService::maskNumber($number).' via '.$provider.' '.($result['ok'] ? 'sent' : 'failed')
        );

        return $result['ok']
            ? $this->success(['status' => $result['status']], $result['message'])
            : $this->error($result['message'], 422);
    }
}
