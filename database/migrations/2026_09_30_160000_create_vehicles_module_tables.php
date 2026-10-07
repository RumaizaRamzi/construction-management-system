<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** slug => [name, roles that receive it]. Admin bypasses permission checks. */
    private const PERMISSIONS = [
        'vehicles.view' => ['View Vehicles', ['admin', 'manager', 'staff', 'accountant']],
        'vehicles.create' => ['Create Vehicles', ['admin', 'manager']],
        'vehicles.update' => ['Update Vehicles', ['admin', 'manager']],
        'vehicles.delete' => ['Delete Vehicles', ['admin', 'manager']],
        'vehicles.rentals' => ['Manage Vehicle Rentals', ['admin', 'manager', 'staff']],
        'vehicles.maintenance' => ['Manage Vehicle Maintenance', ['admin', 'manager']],
    ];

    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->string('vehicle_code', 30)->unique();
            $table->string('name', 150);
            $table->string('category', 100);
            $table->string('registration_number', 50)->unique();
            $table->string('brand', 100)->nullable();
            $table->string('model', 100)->nullable();
            $table->unsignedSmallInteger('manufacture_year')->nullable();
            $table->date('purchase_date')->nullable();
            $table->decimal('purchase_cost', 14, 2)->nullable();
            $table->decimal('daily_rate', 12, 2)->nullable();
            $table->decimal('weekly_rate', 12, 2)->nullable();
            $table->decimal('monthly_rate', 12, 2)->nullable();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('photo_path')->nullable();
            $table->text('description')->nullable();
            $table->string('status', 30)->default('Available')->index();
            $table->timestamps();
        });

        Schema::create('vehicle_rentals', function (Blueprint $table) {
            $table->id();
            $table->string('rental_number', 30)->unique();
            $table->foreignId('vehicle_id')->constrained('vehicles')->restrictOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->restrictOnDelete();
            $table->date('start_date');
            $table->date('expected_return_date')->nullable();
            $table->date('actual_return_date')->nullable();
            $table->string('rate_type', 20)->default('Daily');
            $table->decimal('rental_rate', 12, 2)->default(0);
            $table->unsignedInteger('rental_days')->default(1);
            $table->unsignedInteger('billed_units')->default(1);
            $table->decimal('total_amount', 14, 2)->default(0);
            $table->decimal('security_deposit', 12, 2)->default(0);
            $table->decimal('paid_amount', 14, 2)->default(0);
            $table->decimal('balance', 14, 2)->default(0);
            $table->string('payment_status', 20)->default('Pending');
            $table->string('status', 20)->default('Active')->index();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['vehicle_id', 'status']);
        });

        Schema::create('vehicle_maintenance', function (Blueprint $table) {
            $table->id();
            $table->string('maintenance_number', 30)->unique();
            $table->foreignId('vehicle_id')->constrained('vehicles')->restrictOnDelete();
            $table->date('maintenance_date');
            $table->string('maintenance_type', 100);
            $table->text('description')->nullable();
            $table->decimal('parts_cost', 12, 2)->default(0);
            $table->decimal('labour_cost', 12, 2)->default(0);
            $table->decimal('total_cost', 14, 2)->default(0);
            $table->date('next_maintenance_date')->nullable();
            $table->decimal('meter_reading', 12, 1)->nullable();
            $table->string('meter_unit', 10)->nullable();
            $table->string('service_provider', 150)->nullable();
            $table->string('receipt_path')->nullable();
            $table->string('receipt_name')->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 20)->default('Scheduled')->index();
            $table->timestamps();
            $table->index(['vehicle_id', 'status']);
        });

        $now = now();
        $roleIds = DB::table('roles')->pluck('id', 'slug');
        foreach (self::PERMISSIONS as $slug => [$name, $roles]) {
            DB::table('permissions')->insertOrIgnore([
                'name' => $name,
                'slug' => $slug,
                'group' => 'Vehicles',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $permissionId = DB::table('permissions')->where('slug', $slug)->value('id');
            foreach ($roles as $roleSlug) {
                if ($permissionId && isset($roleIds[$roleSlug])) {
                    DB::table('role_permissions')->insertOrIgnore([
                        'role_id' => $roleIds[$roleSlug],
                        'permission_id' => $permissionId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        $ids = DB::table('permissions')->whereIn('slug', array_keys(self::PERMISSIONS))->pluck('id');
        DB::table('role_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('permissions')->whereIn('id', $ids)->delete();

        Schema::dropIfExists('vehicle_maintenance');
        Schema::dropIfExists('vehicle_rentals');
        Schema::dropIfExists('vehicles');
    }
};
