<?php

namespace App\Observers;

use App\Models\Cheque;
use App\Services\ChequeService;
use Illuminate\Database\Eloquent\Model;

/**
 * Keeps a cheque record linked to every sale, rental, income and expense payment made with the "Cheque" method.
 */
class ChequePaymentObserver
{
    public function __construct(private readonly ChequeService $cheques)
    {
    }

    public function saved(Model $payment): void
    {
        if ($type = $this->paymentType($payment)) {
            $this->cheques->syncFromPayment($payment, $type);
        }
    }

    public function deleted(Model $payment): void
    {
        if ($type = $this->paymentType($payment)) {
            $this->cheques->unlinkPayment($payment, $type);
        }
    }

    private function paymentType(Model $payment): ?string
    {
        foreach (Cheque::PAYMENT_TYPES as $type => [$class]) {
            if ($payment instanceof $class) {
                return $type;
            }
        }

        return null;
    }
}
