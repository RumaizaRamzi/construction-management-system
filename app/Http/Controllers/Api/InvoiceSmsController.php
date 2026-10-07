<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Rental;
use App\Models\Sale;
use App\Services\InvoiceSmsService;
use App\Services\SmsGatewayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class InvoiceSmsController extends Controller
{
    public function __construct(
        private readonly InvoiceSmsService $invoiceSms,
        private readonly SmsGatewayService $sms
    ) {
    }

    public function salePreview(Sale $sale): JsonResponse
    {
        return $this->success($this->invoiceSms->preview($sale), 'Invoice SMS preview retrieved.');
    }

    public function saleSend(Request $request, Sale $sale): JsonResponse
    {
        return $this->send($request, $sale);
    }

    public function rentalPreview(Rental $rental): JsonResponse
    {
        return $this->success($this->invoiceSms->preview($rental), 'Invoice SMS preview retrieved.');
    }

    public function rentalSend(Request $request, Rental $rental): JsonResponse
    {
        return $this->send($request, $rental);
    }

    private function send(Request $request, Sale|Rental $document): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'phone' => ['required', 'string', 'max:20', 'regex:/^\+?[\d\s\-()]{8,20}$/'],
            'message' => ['nullable', 'string', 'max:'.InvoiceSmsService::MAX_LENGTH],
        ], [
            'phone.required' => 'Enter the customer\'s mobile number.',
            'phone.regex' => 'Enter a valid mobile number (e.g. 0771234567 or +94771234567).',
            'message.max' => 'The SMS may not be longer than '.InvoiceSmsService::MAX_LENGTH.' characters.',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        if (! $this->sms->isConfigured()) {
            return $this->error('The SMS gateway is not configured. Ask an administrator to set it up under Administration > Settings.', 422);
        }

        $result = $this->invoiceSms->send(
            $document,
            $request->string('phone')->toString(),
            $request->input('message')
        );

        return $result['ok']
            ? $this->success(['status' => $result['status']], 'Invoice sent to the customer via SMS.')
            : $this->error($result['message'], 422);
    }
}
