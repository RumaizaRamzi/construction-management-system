<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerIdDetailsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        $this->seed(RolesAndPermissionsSeeder::class);
        Sanctum::actingAs(User::query()->where('email', 'admin@buildtrack.local')->firstOrFail());
    }

    private function image(string $name): UploadedFile
    {
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');

        return UploadedFile::fake()->createWithContent($name, $png);
    }

    private function createCustomer(array $overrides = []): array
    {
        return $this->postJson('/api/customers', array_merge(['name' => 'ID Test Customer'], $overrides))
            ->assertCreated()
            ->json('data');
    }

    public function test_id_number_and_photo_are_optional(): void
    {
        $customer = $this->createCustomer();

        $this->assertNull($customer['id_number']);
        $this->assertFalse($customer['has_id_photo']);
        $this->getJson("/api/customers/{$customer['id']}/id-photo")->assertNotFound();
    }

    public function test_id_number_can_be_saved_and_cleared(): void
    {
        $customer = $this->createCustomer(['id_number' => '199012345678']);
        $this->assertSame('199012345678', $customer['id_number']);

        $updated = $this->putJson("/api/customers/{$customer['id']}", ['name' => 'ID Test Customer', 'id_number' => null])
            ->assertOk()
            ->json('data');
        $this->assertNull($updated['id_number']);

        $this->putJson("/api/customers/{$customer['id']}", ['name' => 'ID Test Customer', 'id_number' => str_repeat('9', 101)])
            ->assertStatus(422);
    }

    public function test_id_photo_upload_is_stored_privately_and_served_to_authorised_users(): void
    {
        $customer = $this->createCustomer();

        $data = $this->post("/api/customers/{$customer['id']}/id-photo", [
            'id_photo' => $this->image('national-id.png'),
        ], ['Accept' => 'application/json'])->assertOk()->json('data');

        $this->assertTrue($data['has_id_photo']);
        $this->assertArrayNotHasKey('id_photo_path', $data);

        $path = Customer::query()->findOrFail($customer['id'])->id_photo_path;
        $this->assertStringStartsWith('customer-id-photos/', $path);
        $this->assertStringNotContainsString('national-id', $path);
        Storage::disk('local')->assertExists($path);

        $response = $this->get("/api/customers/{$customer['id']}/id-photo")->assertOk();
        $this->assertStringStartsWith('image/', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));

        $shown = $this->getJson("/api/customers/{$customer['id']}")->assertOk()->json('data');
        $this->assertArrayNotHasKey('id_photo_path', $shown);
    }

    public function test_replacing_and_removing_the_photo_deletes_old_files(): void
    {
        $customer = $this->createCustomer();
        $upload = fn () => $this->post("/api/customers/{$customer['id']}/id-photo", [
            'id_photo' => $this->image('id.png'),
        ], ['Accept' => 'application/json'])->assertOk();

        $upload();
        $first = Customer::query()->findOrFail($customer['id'])->id_photo_path;
        $upload();
        $second = Customer::query()->findOrFail($customer['id'])->id_photo_path;

        Storage::disk('local')->assertMissing($first);
        Storage::disk('local')->assertExists($second);

        $data = $this->deleteJson("/api/customers/{$customer['id']}/id-photo")->assertOk()->json('data');
        $this->assertFalse($data['has_id_photo']);
        Storage::disk('local')->assertMissing($second);
    }

    public function test_non_image_uploads_are_rejected(): void
    {
        $customer = $this->createCustomer();

        foreach ([
            UploadedFile::fake()->create('id.pdf', 100, 'application/pdf'),
            UploadedFile::fake()->createWithContent('id.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
            $this->image('huge.png')->size(6000),
        ] as $file) {
            $this->post("/api/customers/{$customer['id']}/id-photo", ['id_photo' => $file], ['Accept' => 'application/json'])
                ->assertStatus(422)
                ->assertJsonValidationErrors('id_photo');
        }

        $this->assertNull(Customer::query()->findOrFail($customer['id'])->id_photo_path);
    }

    public function test_photo_requires_authentication_and_permission(): void
    {
        $customer = $this->createCustomer();
        $this->post("/api/customers/{$customer['id']}/id-photo", [
            'id_photo' => $this->image('id.png'),
        ], ['Accept' => 'application/json'])->assertOk();

        $role = Role::query()->create(['name' => 'No Customers', 'slug' => 'no-customers', 'description' => 'Test role']);
        $user = User::query()->create([
            'name' => 'No Access',
            'email' => 'no-access@example.test',
            'password' => 'password',
            'status' => 'Active',
        ]);
        $user->role_id = $role->id;
        $user->role = $role->name;
        $user->save();
        Sanctum::actingAs($user);

        $this->getJson("/api/customers/{$customer['id']}/id-photo")->assertForbidden();
        $this->postJson("/api/customers/{$customer['id']}/id-photo", [])->assertForbidden();
        $this->deleteJson("/api/customers/{$customer['id']}/id-photo")->assertForbidden();

        $this->app['auth']->forgetGuards();
        $this->getJson("/api/customers/{$customer['id']}/id-photo")->assertUnauthorized();
    }

    public function test_id_details_are_not_written_to_activity_logs(): void
    {
        $customer = $this->createCustomer(['id_number' => 'SECRET-ID-123']);
        $this->post("/api/customers/{$customer['id']}/id-photo", [
            'id_photo' => $this->image('id.png'),
        ], ['Accept' => 'application/json'])->assertOk();

        $logged = ActivityLog::query()->get()->concat(AuditLog::query()->get())
            ->map(fn ($log) => json_encode($log->toArray()))
            ->implode(' ');
        $this->assertNotSame('', $logged);
        $this->assertStringNotContainsString('SECRET-ID-123', $logged);
        $this->assertStringNotContainsString('customer-id-photos/', $logged);
    }
}
