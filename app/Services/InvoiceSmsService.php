<?php

namespace App\Services;

use App\Models\Rental;
use App\Models\Sale;
use Illuminate\Database\Eloquent\Model;

/**
 * Builds the SMS text for sale invoices and rental invoices and sends it through the configured gateway.
 */
class InvoiceSmsService
{
    public const MAX_LENGTH = 640;

    public function __construct(
        private readonly SmsGatewayService $sms,
        private readonly SettingService $settings,
        private readonly ActivityLogService $logs
    ) {
    }

    /** @return array{phone: string, message: string, configured: bool, reference: string} */
    public function preview(Sale|Rental $document): array
    {
        $document->loadMissing('customer:id,name,phone');

        return [
            'phone' => (string) ($document->customer?->phone ?? ''),
            'message' => $document instanceof Sale ? $this->saleMessage($document) : $this->rentalMessage($document),
            'configured' => $this->sms->isConfigured(),
            'reference' => $this->reference($document),
        ];
    }

    /** @return array{ok: bool, status: int|null, message: string} */
    public function send(Sale|Rental $document, string $phone, ?string $message = null): array
    {
        $text = trim((string) $message) !== '' ? trim((string) $message) : $this->preview($document)['message'];
        $result = $this->sms->send($phone, $text);

        $this->logs->record(
            $result['ok'] ? 'sms_sent' : 'sms_failed',
            $document instanceof Sale ? 'sales' : 'rentals',
            ($document instanceof Sale ? 'Invoice ' : 'Rental invoice ').$this->reference($document)
                .' SMS to '.SmsGatewayService::maskNumber($phone).' '.($result['ok'] ? 'sent' : 'failed'),
            $document
        );

        return $result;
    }

    public function saleMessage(Sale $sale): string
    {
        $sale->loadMissing('customer:id,name,phone');
        $currency = $this->currency();

        $lines = array_filter([
            $this->companyName(),
            'Invoice: '.$sale->invoice_number,
            'Date: '.$sale->sale_date?->format('d M Y'),
            $sale->customer?->name ? 'Customer: '.$sale->customer->name : null,
            'Total: '.$this->money($sale->total_amount, $currency),
            'Paid: '.$this->money($sale->paid_amount, $currency),
            (float) $sale->balance > 0 ? 'Balance: '.$this->money($sale->balance, $currency) : null,
            'Status: '.$sale->payment_status,
            $this->footer(),
        ]);

        return $this->limit(implode("\n", $lines));
    }

    public function rentalMessage(Rental $rental): string
    {
        $rental->loadMissing('customer:id,name,phone');
        $currency = $this->currency();
        $end = $rental->actual_return_date ?? $rental->expected_return_date;

        $lines = array_filter([
            $this->companyName(),
            'Rental invoice: '.$rental->rental_number,
            'Period: '.$rental->start_date?->format('d M Y').($end ? ' - '.$end->format('d M Y') : ''),
            $rental->customer?->name ? 'Customer: '.$rental->customer->name : null,
            (float) $rental->late_fee > 0 ? 'Late fee: '.$this->money($rental->late_fee, $currency) : null,
            (float) $rental->damage_fee > 0 ? 'Damage fee: '.$this->money($rental->damage_fee, $currency) : null,
            'Total: '.$this->money($rental->total_amount, $currency),
            'Paid: '.$this->money($rental->paid_amount, $currency),
            (float) $rental->balance > 0 ? 'Balance: '.$this->money($rental->balance, $currency) : null,
            'Status: '.$rental->status,
            $this->footer(),
        ]);

        return $this->limit(implode("\n", $lines));
    }

    private function reference(Model $document): string
    {
        return (string) ($document instanceof Sale ? $document->invoice_number : $document->rental_number);
    }

    private function companyName(): ?string
    {
        $name = trim((string) $this->settings->get('company_name', ''));

        return $name !== '' ? $name : null;
    }

    private function footer(): string
    {
        $footer = trim((string) $this->settings->get('invoice_footer', ''));

        return $footer !== '' ? mb_substr($footer, 0, 160) : 'Thank you for your business.';
    }

    private function currency(): string
    {
        return (string) ($this->settings->get('currency', 'LKR') ?: 'LKR');
    }

    private function money(mixed $amount, string $currency): string
    {
        return $currency.' '.number_format((float) $amount, 2);
    }

    private function limit(string $text): string
    {
        return mb_substr($text, 0, self::MAX_LENGTH);
    }
}
