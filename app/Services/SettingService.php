<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

class SettingService
{
    private const CACHE_KEY = 'buildtrack.settings';

    /**
     * Company/contact fields default to empty: real values must be supplied by the client.
     *
     * @var array<string, array{type:string, default:mixed}>
     */
    public const SCHEMA = [
        'company_name' => ['type' => 'string', 'default' => ''],
        'company_subtitle' => ['type' => 'string', 'default' => ''],
        'address' => ['type' => 'string', 'default' => ''],
        'phone' => ['type' => 'string', 'default' => ''],
        'email' => ['type' => 'string', 'default' => ''],
        'website' => ['type' => 'string', 'default' => ''],
        'tax_number' => ['type' => 'string', 'default' => ''],
        'business_registration' => ['type' => 'string', 'default' => ''],
        'bank_details' => ['type' => 'string', 'default' => ''],
        'logo_path' => ['type' => 'string', 'default' => ''],
        'currency' => ['type' => 'string', 'default' => 'LKR'],
        'tax_rate' => ['type' => 'float', 'default' => 0],
        'invoice_prefix' => ['type' => 'string', 'default' => 'INV-'],
        'invoice_footer' => ['type' => 'string', 'default' => ''],
        'rental_terms' => ['type' => 'string', 'default' => ''],
        'rental_deposit_percent' => ['type' => 'float', 'default' => 20],
        'late_fee_per_day' => ['type' => 'float', 'default' => 2500],
        'low_stock_alerts' => ['type' => 'bool', 'default' => true],
        'email_notifications' => ['type' => 'bool', 'default' => true],
        'sms_notifications' => ['type' => 'bool', 'default' => false],
        'enable_notifications' => ['type' => 'bool', 'default' => true],
        'enable_rental_reminders' => ['type' => 'bool', 'default' => true],
        'enable_low_stock_alerts' => ['type' => 'bool', 'default' => true],
        'enable_maintenance_reminders' => ['type' => 'bool', 'default' => true],
        'enable_payment_alerts' => ['type' => 'bool', 'default' => true],
        'enable_booking_notifications' => ['type' => 'bool', 'default' => true],
        'reminder_timing' => ['type' => 'string', 'default' => '1 Day Before'],
        'holiday_overrides' => ['type' => 'holidays', 'default' => []],
    ];

    public const CLIENT_REQUIRED = ['company_name', 'address', 'phone', 'email'];

    /** @return array<string, mixed> */
    public function all(): array
    {
        $stored = Cache::rememberForever(self::CACHE_KEY, fn () => Setting::query()->pluck('value', 'key')->all());

        $values = [];
        foreach (self::SCHEMA as $key => $def) {
            $values[$key] = array_key_exists($key, $stored)
                ? $this->cast($stored[$key], $def['type'])
                : $def['default'];
        }

        return $values;
    }

    public function get(string $key, mixed $fallback = null): mixed
    {
        return $this->all()[$key] ?? $fallback;
    }

    /** @return array<string, mixed> */
    public function publicPayload(): array
    {
        $values = $this->all();
        $values['logo_url'] = $values['logo_path'] !== ''
            ? Storage::disk('public')->url($values['logo_path'])
            : null;
        unset($values['logo_path']);
        $values['missing_client_data'] = array_values(array_filter(
            self::CLIENT_REQUIRED,
            fn ($key) => trim((string) $values[$key]) === ''
        ));

        return $values;
    }

    /**
     * Settings visible to a user: full payload with settings.manage, otherwise only what
     * documents (invoices, agreements), sales/rental forms and notification views need.
     *
     * @return array<string, mixed>
     */
    public function payloadFor(?User $user): array
    {
        $payload = $this->publicPayload();

        if ($user?->hasPermission('settings.manage')) {
            return $payload;
        }

        $keys = [
            'company_name', 'company_subtitle', 'address', 'phone', 'email', 'website',
            'tax_number', 'business_registration', 'logo_url',
            'currency', 'tax_rate', 'invoice_prefix', 'invoice_footer',
            'rental_terms', 'rental_deposit_percent', 'late_fee_per_day', 'missing_client_data',
            'holiday_overrides',
        ];
        if ($user?->hasAnyPermission(['sales.view', 'rentals.view', 'payments.manage'])) {
            $keys[] = 'bank_details';
        }
        if ($user?->hasPermission('notifications.view')) {
            array_push(
                $keys,
                'low_stock_alerts', 'enable_notifications', 'enable_rental_reminders', 'enable_low_stock_alerts',
                'enable_maintenance_reminders', 'enable_payment_alerts', 'enable_booking_notifications', 'reminder_timing'
            );
        }

        return array_intersect_key($payload, array_flip($keys));
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{old: array<string, mixed>, new: array<string, mixed>}
     */
    public function update(array $data): array
    {
        $current = $this->all();
        $old = [];
        $new = [];

        foreach ($data as $key => $value) {
            if (! array_key_exists($key, self::SCHEMA) || $key === 'logo_path') {
                continue;
            }
            $type = self::SCHEMA[$key]['type'];
            $casted = $this->cast($value, $type);
            if ($casted === $this->cast($current[$key] ?? null, $type)) {
                continue;
            }
            Setting::query()->updateOrCreate(['key' => $key], ['value' => $this->serialize($casted)]);
            $old[$key] = $current[$key];
            $new[$key] = $casted;
        }

        Cache::forget(self::CACHE_KEY);

        return ['old' => $old, 'new' => $new];
    }

    public function storeLogo(UploadedFile $file): string
    {
        $previous = $this->get('logo_path');
        $path = $file->store('settings', 'public');
        Setting::query()->updateOrCreate(['key' => 'logo_path'], ['value' => $path]);
        if ($previous && $previous !== $path) {
            Storage::disk('public')->delete($previous);
        }
        Cache::forget(self::CACHE_KEY);

        return $path;
    }

    public function removeLogo(): void
    {
        $previous = $this->get('logo_path');
        if ($previous) {
            Storage::disk('public')->delete($previous);
        }
        Setting::query()->where('key', 'logo_path')->delete();
        Cache::forget(self::CACHE_KEY);
    }

    private function cast(mixed $value, string $type): mixed
    {
        return match ($type) {
            'float' => round((float) $value, 2),
            'bool' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
            'holidays' => $this->castHolidays($value),
            default => trim((string) ($value ?? '')),
        };
    }

    /** @return list<array{action:string, date:string, name:string, kind:string}> */
    private function castHolidays(mixed $value): array
    {
        $rows = is_string($value) ? json_decode($value, true) : $value;
        if (! is_array($rows)) {
            return [];
        }

        $clean = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $date = (string) ($row['date'] ?? '');
            $action = (string) ($row['action'] ?? '');
            $name = trim((string) ($row['name'] ?? ''));
            if (! in_array($action, ['add', 'remove'], true) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $name === '') {
                continue;
            }
            $clean[] = [
                'action' => $action,
                'date' => $date,
                'name' => mb_substr($name, 0, 100),
                'kind' => ($row['kind'] ?? '') === 'poya' ? 'poya' : 'public',
            ];
        }
        usort($clean, fn ($a, $b) => [$a['date'], $a['action'], $a['name']] <=> [$b['date'], $b['action'], $b['name']]);

        return array_values(array_unique($clean, SORT_REGULAR));
    }

    private function serialize(mixed $value): string
    {
        if (is_array($value)) {
            return json_encode($value, JSON_UNESCAPED_UNICODE);
        }

        return is_bool($value) ? ($value ? '1' : '0') : (string) $value;
    }
}
