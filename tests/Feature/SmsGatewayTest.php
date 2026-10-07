<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Role;
use App\Models\Setting;
use App\Models\User;
use App\Services\SmsGatewayService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SmsGatewayTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function makeUser(string $roleSlug): User
    {
        $role = Role::query()->where('slug', $roleSlug)->firstOrFail();
        $user = User::query()->create([
            'name' => ucfirst($roleSlug).' User',
            'email' => $roleSlug.uniqid().'@test.local',
            'password' => 'password123',
            'status' => 'Active',
        ]);
        $user->role_id = $role->id;
        $user->role = $role->name;
        $user->save();

        return $user;
    }

    private function saveNotifyLk(): void
    {
        $this->putJson('/api/admin/sms-gateway', [
            'sms_service' => 'notifylk',
            'notifylk_user_id' => '12345',
            'notifylk_api_key' => 'SECRET-API-KEY-XYZ',
            'notifylk_sender_id' => 'BuildTrack',
        ])->assertOk();
    }

    public function test_non_admin_cannot_access_sms_gateway(): void
    {
        Sanctum::actingAs($this->makeUser('staff'));

        $this->getJson('/api/admin/sms-gateway')->assertForbidden();
        $this->putJson('/api/admin/sms-gateway', ['sms_service' => 'twilio'])->assertForbidden();
        $this->postJson('/api/admin/sms-gateway/test', ['test_number' => '0771234567'])->assertForbidden();
    }

    public function test_secrets_are_encrypted_masked_and_never_logged(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $this->saveNotifyLk();

        $raw = Setting::query()->where('key', SmsGatewayService::SETTING_KEY)->value('value');
        $this->assertStringNotContainsString('SECRET-API-KEY-XYZ', $raw);

        $response = $this->getJson('/api/admin/sms-gateway')->assertOk();
        $response->assertJsonPath('data.config.notifylk_api_key', '')
            ->assertJsonPath('data.config.notifylk_user_id', '12345')
            ->assertJsonPath('data.saved_secrets.notifylk_api_key', true)
            ->assertJsonPath('data.configured', true);
        $this->assertStringNotContainsString('SECRET-API-KEY-XYZ', $response->getContent());

        $this->assertStringNotContainsString('SECRET-API-KEY-XYZ', ActivityLog::query()->get()->toJson());
        $this->assertTrue(ActivityLog::query()->where('description', 'like', 'Updated SMS gateway settings%')->exists());

        // the settings endpoint used by the rest of the app does not include the gateway
        $this->assertStringNotContainsString('SECRET-API-KEY-XYZ', $this->getJson('/api/settings')->getContent());
    }

    public function test_blank_secret_keeps_saved_value_and_clear_removes_it(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $this->saveNotifyLk();

        $this->putJson('/api/admin/sms-gateway', [
            'sms_service' => 'notifylk',
            'notifylk_api_key' => '',
            'notifylk_sender_id' => 'NewSender',
        ])->assertOk();
        $config = app(SmsGatewayService::class)->config();
        $this->assertSame('SECRET-API-KEY-XYZ', $config['notifylk_api_key']);
        $this->assertSame('NewSender', $config['notifylk_sender_id']);

        $this->putJson('/api/admin/sms-gateway', [
            'sms_service' => 'notifylk',
            'clear_secrets' => ['notifylk_api_key'],
        ])->assertOk()->assertJsonPath('data.configured', false);
        $this->assertSame('', app(SmsGatewayService::class)->config()['notifylk_api_key']);
    }

    public function test_validation_for_custom_provider(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));

        $this->putJson('/api/admin/sms-gateway', [
            'sms_service' => 'other',
            'url' => 'not-a-url',
            'request_method' => 'delete',
        ])->assertStatus(422)->assertJsonValidationErrors(['url', 'request_method']);

        $this->putJson('/api/admin/sms-gateway', ['sms_service' => 'unknown'])
            ->assertStatus(422)->assertJsonValidationErrors(['sms_service']);
    }

    public function test_send_test_sms_via_notifylk_normalises_local_number(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $this->saveNotifyLk();

        Http::fake(['app.notify.lk/*' => Http::response(['status' => 'success', 'data' => 'Sent'])]);

        $this->postJson('/api/admin/sms-gateway/test', ['test_number' => '077 123 4567'])
            ->assertOk()->assertJsonPath('message', 'SMS sent successfully.');

        Http::assertSent(fn (HttpRequest $r) => str_starts_with($r->url(), 'https://app.notify.lk/api/v1/send')
            && $r['to'] === '94771234567'
            && $r['sender_id'] === 'BuildTrack'
            && $r['message'] === 'This is a test SMS from RN TRADING LANKA PVT. LTD.');

        $log = ActivityLog::query()->where('action', 'sms_test')->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertStringNotContainsString('771234567', $log->description);
    }

    public function test_custom_gateway_json_with_array_recipient_headers_and_params(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));

        $this->putJson('/api/admin/sms-gateway', [
            'sms_service' => 'other',
            'url' => 'https://sms.example.test/send',
            'send_to_param_name' => 'recipients',
            'send_to_param_type' => 'array',
            'msg_param_name' => 'body',
            'request_method' => 'post',
            'data_parameter_type' => 'json',
            'header_1' => 'Authorization',
            'header_val_1' => 'Bearer HEADER-SECRET',
            'param_1' => 'sender',
            'param_val_1' => 'BUILD',
            'param_2' => 'api_key',
            'param_val_2' => 'PARAM-SECRET',
        ])->assertOk()
            ->assertJsonPath('data.config.header_val_1', '')
            ->assertJsonPath('data.config.param_val_2', '')
            ->assertJsonPath('data.config.param_val_1', 'BUILD');

        Http::fake(['sms.example.test/*' => Http::response(['ok' => true])]);

        $this->postJson('/api/admin/sms-gateway/test', ['test_number' => '+94771234567', 'message' => 'Hello'])
            ->assertOk();

        Http::assertSent(fn (HttpRequest $r) => $r->method() === 'POST'
            && $r->isJson()
            && $r->hasHeader('Authorization', 'Bearer HEADER-SECRET')
            && $r['recipients'] === ['94771234567']
            && $r['body'] === 'Hello'
            && $r['sender'] === 'BUILD'
            && $r['api_key'] === 'PARAM-SECRET');
    }

    public function test_gateway_failure_is_reported_without_crashing(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $this->putJson('/api/admin/sms-gateway', [
            'sms_service' => 'twilio',
            'twilio_sid' => 'AC123',
            'twilio_token' => 'tok',
            'twilio_from' => '+15005550006',
        ])->assertOk();

        Http::fake(['api.twilio.com/*' => Http::response(['message' => 'Authenticate'], 401)]);

        $this->postJson('/api/admin/sms-gateway/test', ['test_number' => '0771234567'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'SMS gateway rejected the request (HTTP 401): Authenticate');

        Http::assertSent(fn (HttpRequest $r) => $r['To'] === '+94771234567' && $r['From'] === '+15005550006');
    }

    public function test_connection_error_is_logged_with_secrets_redacted(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $this->putJson('/api/admin/sms-gateway', [
            'sms_service' => 'other',
            'url' => 'https://sms.example.test/send',
            'send_to_param_name' => 'to',
            'msg_param_name' => 'text',
            'request_method' => 'get',
            'param_1' => 'api_key',
            'param_val_1' => 'GET-QUERY-SECRET',
        ])->assertOk();

        Http::fake(fn () => throw new \Illuminate\Http\Client\ConnectionException(
            'cURL error 60: SSL certificate problem: unable to get local issuer certificate for https://sms.example.test/send?api_key=GET-QUERY-SECRET&to=94771234567'
        ));
        Log::spy();

        $this->postJson('/api/admin/sms-gateway/test', ['test_number' => '0771234567'])
            ->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'SSL certificate verification failed'));

        Log::shouldHaveReceived('warning')->withArgs(fn ($message, $context) => str_contains($message, 'cURL error 60')
            && ! str_contains($message, 'GET-QUERY-SECRET')
            && str_contains($message, 'https://sms.example.test/send?[redacted]')
            && $context['curl_errno'] === 60
            && $context['provider'] === 'other');
    }

    public function test_test_sms_requires_configuration(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        Http::fake();

        $this->postJson('/api/admin/sms-gateway/test', ['test_number' => '0771234567'])->assertStatus(422);
        Http::assertNothingSent();
    }
}
