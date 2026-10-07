<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Product;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoDataSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SeederSafetyTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_seeder_creates_no_demo_business_data(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertTrue(User::query()->where('email', 'admin@buildtrack.local')->exists());
        $this->assertSame(0, Product::query()->count());
        $this->assertSame(0, Customer::query()->count());
    }

    public function test_reseeding_roles_does_not_reset_an_existing_admin_password(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = User::query()->where('email', 'admin@buildtrack.local')->firstOrFail();
        $admin->forceFill(['name' => 'Client Admin', 'password' => 'client-secret-123'])->save();

        $this->seed(RolesAndPermissionsSeeder::class);

        $admin->refresh();
        $this->assertTrue(Hash::check('client-secret-123', $admin->password));
        $this->assertSame('Client Admin', $admin->name);
    }

    public function test_demo_seeder_refuses_to_run_in_production(): void
    {
        $this->app['env'] = 'production';

        $this->app->make(DemoDataSeeder::class)->setContainer($this->app)->run();

        $this->assertSame(0, Product::query()->count());
        $this->assertSame(0, Customer::query()->count());
    }

    public function test_demo_seeder_is_opt_in_for_local_development(): void
    {
        $this->seed(DemoDataSeeder::class);

        $this->assertGreaterThan(0, Product::query()->count());
    }
}
