<?php

namespace App\Providers;

use App\Models\Cheque;
use App\Models\EquipmentCheck;
use App\Models\MaintenanceRecord;
use App\Models\Reminder;
use App\Observers\ActivityObserver;
use App\Observers\ChequePaymentObserver;
use App\Services\ActivityLogService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Route::bind('check', fn (string $value) => EquipmentCheck::query()->findOrFail($value));
        Route::bind('maintenance', fn (string $value) => MaintenanceRecord::query()->findOrFail($value));
        Route::bind('reminder', fn (string $value) => Reminder::query()->findOrFail($value));

        foreach (array_keys(ActivityLogService::TRACKED) as $modelClass) {
            $modelClass::observe(ActivityObserver::class);
        }

        foreach (Cheque::PAYMENT_TYPES as [$paymentClass]) {
            $paymentClass::observe(ChequePaymentObserver::class);
        }

        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(120)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('login', function (Request $request) {
            $email = strtolower((string) $request->input('email', ''));

            return [
                Limit::perMinute(5)->by($request->ip()),
                Limit::perMinute(5)->by($email.'|'.$request->ip()),
            ];
        });

        RateLimiter::for('reports', function (Request $request) {
            return Limit::perMinute(30)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('search', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });
    }
}
