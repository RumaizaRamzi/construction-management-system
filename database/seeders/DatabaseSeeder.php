<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seeds only roles, permissions and the initial admin account.
     * Demo business data lives in DemoDataSeeder and must be run explicitly.
     */
    public function run(): void
    {
        $this->call(RolesAndPermissionsSeeder::class);

        if (app()->environment('local')) {
            $this->call(VehicleSeeder::class);
            $this->call(StaffSeeder::class);
        }
    }
}
