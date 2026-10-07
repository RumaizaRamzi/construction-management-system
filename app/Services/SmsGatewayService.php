<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * SMS gateway configuration (stored encrypted in the settings table) and message sending.
 */
class SmsGatewayService
{
    public const SETTING_KEY = 'sms_gateway';

    public const PROVIDERS = ['', 'notifylk', 'twilio', 'nexmo', 'other'];

    public const PROVIDER_LABELS = [
        'notifylk' => 'notify.lk',
        'twilio' => 'Twilio',
        'nexmo' => 'Nexmo (Vonage)',
        'other' => 'Other (custom HTTP API)',
    ];

    public const HEADER_COUNT = 3;

    public const PARAM_COUNT = 10;

    /** Fields never returned to the client once saved. */
    public const SECRET_FIELDS = ['notifylk_api_key', 'twilio_token', 'nexmo_secret'];

    private const SENSITIVE_NAME = '/key|token|secret|pass|auth|sign/i';

    /** @return array<string, mixed> */
    public static function defaults(): array
    {
        $defaults = [
            'sms_service' => '',
            'default_country_code' => '94',
            'notifylk_user_id' => '',
            'notifylk_api_key' => '',
            'notifylk_sender_id' => '',
            'twilio_sid' => '',
            'twilio_token' => '',
            'twilio_from' => '',
            'nexmo_key' => '',
            'nexmo_secret' => '',
            'nexmo_from' => '',
            'url' => '',
            'send_to_param_name' => 'to',
            'send_to_param_type' => 'string',
            'msg_param_name' => 'text',
            'request_method' => 'post',
            'data_parameter_type' => 'form-data',
        ];
        for ($i = 1; $i <= self::HEADER_COUNT; $i++) {
            $defaults["header_{$i}"] = '';
            $defaults["header_val_{$i}"] = '';
        }
        for ($i = 1; $i <= self::PARAM_COUNT; $i++) {
            $defaults["param_{$i}"] = '';
            $defaults["param_val_{$i}"] = '';
        }

        return $defaults;
    }

    /** @return array<string, string> */
    public function config(): array
    {
        $raw = Setting::query()->where('key', self::SETTING_KEY)->value('value');
        $stored = [];
        if ($raw) {
            try {
                $stored = json_decode(Crypt::decryptString($raw), true) ?: [];
            } catch (DecryptException) {
                Log::warning('SMS gateway settings could not be decrypted (APP_KEY changed?).');
            }
        }

        return array_map(
            fn ($v) => (string) ($v ?? ''),
            array_merge(self::defaults(), array_intersect_key($stored, self::defaults()))
        );
    }

    /**
     * Config safe to send to the browser: secret values are blanked and replaced by has_* flags.
     *
     * @return array<string, mixed>
     */
    public function publicConfig(): array
    {
        $config = $this->config();
        $configured = $this->isConfigured($config);
        $secrets = [];
        foreach ($this->secretFields($config) as $field) {
            $secrets[$field] = $config[$field] !== '';
            $config[$field] = '';
        }

        return [
            'config' => $config,
            'saved_secrets' => $secrets,
            'configured' => $configured,
            'providers' => self::PROVIDER_LABELS,
            'header_count' => self::HEADER_COUNT,
            'param_count' => self::PARAM_COUNT,
        ];
    }

    /**
     * Blank secret inputs keep the saved value; fields listed in $clear are removed.
     *
     * @param  array<string, mixed>  $data
     * @param  array<int, string>  $clear
     * @return array<int, string> names of changed fields
     */
    public function update(array $data, array $clear = []): array
    {
        $current = $this->config();
        $next = $current;

        foreach (self::defaults() as $field => $default) {
            if (! array_key_exists($field, $data)) {
                continue;
            }
            $next[$field] = trim((string) ($data[$field] ?? ''));
        }

        foreach ($this->secretFields($current) as $field) {
            if (in_array($field, $clear, true)) {
                $next[$field] = '';
            } elseif ($next[$field] === '' && $this->sameSecretSlot($field, $current, $next)) {
                $next[$field] = $current[$field];
            }
        }

        $changed = array_keys(array_filter($next, fn ($v, $k) => $v !== $current[$k], ARRAY_FILTER_USE_BOTH));
        if ($changed !== []) {
            Setting::query()->updateOrCreate(
                ['key' => self::SETTING_KEY],
                ['value' => Crypt::encryptString(json_encode($next))]
            );
        }

        return $changed;
    }

    /** @param  array<string, string>|null  $config */
    public function isConfigured(?array $config = null): bool
    {
        $c = $config ?? $this->config();

        return match ($c['sms_service']) {
            'notifylk' => $c['notifylk_user_id'] !== '' && $c['notifylk_api_key'] !== '' && $c['notifylk_sender_id'] !== '',
            'twilio' => $c['twilio_sid'] !== '' && $c['twilio_token'] !== '' && $c['twilio_from'] !== '',
            'nexmo' => $c['nexmo_key'] !== '' && $c['nexmo_secret'] !== '' && $c['nexmo_from'] !== '',
            'other' => $c['url'] !== '' && $c['send_to_param_name'] !== '' && $c['msg_param_name'] !== '',
            default => false,
        };
    }

    /**
     * @return array{ok: bool, status: int|null, message: string}
     */
    public function send(string $to, string $message): array
    {
        $config = $this->config();
        if (! $this->isConfigured($config)) {
            return ['ok' => false, 'status' => null, 'message' => 'SMS gateway is not configured.'];
        }

        $number = $this->normalizeNumber($to, $config['default_country_code']);
        if ($number === '') {
            return ['ok' => false, 'status' => null, 'message' => 'Invalid mobile number.'];
        }

        try {
            $response = match ($config['sms_service']) {
                'notifylk' => $this->sendNotifyLk($config, $number, $message),
                'twilio' => $this->sendTwilio($config, $number, $message),
                'nexmo' => $this->sendNexmo($config, $number, $message),
                'other' => $this->sendCustom($config, $number, $message),
            };
        } catch (Throwable $e) {
            $error = $this->redact($e->getMessage(), $config);
            preg_match('/cURL error (\d+)/', $error, $m);
            $curlErrno = isset($m[1]) ? (int) $m[1] : null;

            Log::warning('SMS send failed: '.$error, [
                'provider' => $config['sms_service'],
                'exception' => $e::class,
                'curl_errno' => $curlErrno,
            ]);

            return ['ok' => false, 'status' => null, 'message' => match ($curlErrno) {
                60, 77 => 'Could not connect to the SMS gateway: SSL certificate verification failed. The server\'s PHP CA certificate bundle (curl.cainfo / openssl.cafile in php.ini) is missing or outdated.',
                6 => 'Could not connect to the SMS gateway: the gateway host name could not be resolved. Check the URL and the server\'s internet/DNS access.',
                7 => 'Could not connect to the SMS gateway: the connection was refused.',
                28 => 'Could not connect to the SMS gateway: the request timed out.',
                default => 'Could not connect to the SMS gateway.',
            }];
        }

        return $this->interpret($config['sms_service'], $response);
    }

    /** Digits only, local numbers (leading 0) converted to international format without '+'. */
    public function normalizeNumber(string $to, string $countryCode = '94'): string
    {
        $digits = preg_replace('/\D+/', '', $to) ?? '';
        if (str_starts_with($digits, '00')) {
            $digits = substr($digits, 2);
        } elseif (str_starts_with($digits, '0') && $countryCode !== '') {
            $digits = preg_replace('/\D+/', '', $countryCode).substr($digits, 1);
        }

        return strlen($digits) >= 8 && strlen($digits) <= 15 ? $digits : '';
    }

    public static function maskNumber(string $number): string
    {
        $digits = preg_replace('/\D+/', '', $number) ?? '';

        return strlen($digits) <= 5
            ? str_repeat('*', strlen($digits))
            : substr($digits, 0, 3).str_repeat('*', strlen($digits) - 5).substr($digits, -2);
    }

    /** Strips query strings (GET gateways carry credentials there) and any saved secret values. */
    private function redact(string $message, array $config): string
    {
        $message = preg_replace('#(https?://[^\s?]+)\?\S*#i', '$1?[redacted]', $message) ?? $message;
        foreach ($this->secretFields($config) as $field) {
            $value = $config[$field] ?? '';
            if (strlen($value) >= 4) {
                $message = str_replace([$value, rawurlencode($value), urlencode($value)], '[redacted]', $message);
            }
        }

        return $message;
    }

    /** @param  array<string, string>  $config  @return array<int, string> */
    private function secretFields(array $config): array
    {
        $fields = self::SECRET_FIELDS;
        for ($i = 1; $i <= self::HEADER_COUNT; $i++) {
            $fields[] = "header_val_{$i}";
        }
        for ($i = 1; $i <= self::PARAM_COUNT; $i++) {
            if (preg_match(self::SENSITIVE_NAME, $config["param_{$i}"] ?? '')) {
                $fields[] = "param_val_{$i}";
            }
        }

        return $fields;
    }

    /** A masked header/param value is only kept while its name is unchanged. */
    private function sameSecretSlot(string $field, array $current, array $next): bool
    {
        if (preg_match('/^(header|param)_val_(\d+)$/', $field, $m)) {
            $nameField = "{$m[1]}_{$m[2]}";

            return $next[$nameField] !== '' && $next[$nameField] === $current[$nameField];
        }

        return true;
    }

    private function http(): PendingRequest
    {
        return Http::timeout(15)->connectTimeout(10)->acceptJson();
    }

    private function sendNotifyLk(array $c, string $number, string $message): Response
    {
        return $this->http()->asForm()->post('https://app.notify.lk/api/v1/send', [
            'user_id' => $c['notifylk_user_id'],
            'api_key' => $c['notifylk_api_key'],
            'sender_id' => $c['notifylk_sender_id'],
            'to' => $number,
            'message' => $message,
        ]);
    }

    private function sendTwilio(array $c, string $number, string $message): Response
    {
        return $this->http()
            ->withBasicAuth($c['twilio_sid'], $c['twilio_token'])
            ->asForm()
            ->post('https://api.twilio.com/2010-04-01/Accounts/'.rawurlencode($c['twilio_sid']).'/Messages.json', [
                'To' => '+'.$number,
                'From' => $c['twilio_from'],
                'Body' => $message,
            ]);
    }

    private function sendNexmo(array $c, string $number, string $message): Response
    {
        return $this->http()->asForm()->post('https://rest.nexmo.com/sms/json', [
            'api_key' => $c['nexmo_key'],
            'api_secret' => $c['nexmo_secret'],
            'from' => $c['nexmo_from'],
            'to' => $number,
            'text' => $message,
        ]);
    }

    private function sendCustom(array $c, string $number, string $message): Response
    {
        $payload = [];
        for ($i = 1; $i <= self::PARAM_COUNT; $i++) {
            if ($c["param_{$i}"] !== '') {
                $payload[$c["param_{$i}"]] = $c["param_val_{$i}"];
            }
        }
        $payload[$c['send_to_param_name']] = $c['send_to_param_type'] === 'array' ? [$number] : $number;
        $payload[$c['msg_param_name']] = $message;

        $headers = [];
        for ($i = 1; $i <= self::HEADER_COUNT; $i++) {
            if ($c["header_{$i}"] !== '') {
                $headers[$c["header_{$i}"]] = $c["header_val_{$i}"];
            }
        }

        $request = $this->http()->withHeaders($headers);

        if ($c['request_method'] === 'get') {
            return $request->get($c['url'], $payload);
        }

        return $c['data_parameter_type'] === 'json'
            ? $request->asJson()->post($c['url'], $payload)
            : $request->asForm()->post($c['url'], $payload);
    }

    /** @return array{ok: bool, status: int|null, message: string} */
    private function interpret(string $provider, Response $response): array
    {
        $json = $response->json();
        $ok = $response->successful();
        $detail = null;

        if ($provider === 'notifylk' && is_array($json)) {
            $ok = $ok && ($json['status'] ?? null) === 'success';
            $detail = $json['message'] ?? $json['errors'] ?? null;
        } elseif ($provider === 'nexmo' && is_array($json)) {
            $first = $json['messages'][0] ?? [];
            $ok = $ok && (string) ($first['status'] ?? '') === '0';
            $detail = $first['error-text'] ?? null;
        } elseif ($provider === 'twilio' && is_array($json)) {
            $detail = $ok ? null : ($json['message'] ?? null);
        } elseif (! $ok) {
            $detail = is_array($json) ? ($json['message'] ?? $json['error'] ?? null) : null;
        }

        if (is_array($detail)) {
            $detail = implode(' ', array_map(fn ($v) => is_scalar($v) ? (string) $v : json_encode($v), $detail));
        }
        $detail = $detail !== null ? mb_substr(strip_tags((string) $detail), 0, 200) : null;

        return [
            'ok' => $ok,
            'status' => $response->status(),
            'message' => $ok
                ? 'SMS sent successfully.'
                : 'SMS gateway rejected the request (HTTP '.$response->status().')'.($detail ? ': '.$detail : '.'),
        ];
    }
}
