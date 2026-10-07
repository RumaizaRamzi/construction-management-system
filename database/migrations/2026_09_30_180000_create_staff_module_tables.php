<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** slug => [name, roles that receive it]. Admin bypasses permission checks. */
    private const PERMISSIONS = [
        'staff.view' => ['View Staff', ['admin', 'manager', 'accountant']],
        'staff.create' => ['Create Staff', ['admin', 'manager']],
        'staff.update' => ['Update / Deactivate Staff', ['admin', 'manager']],
        'staff.delete' => ['Delete Staff', ['admin', 'manager']],
        'staff.attendance' => ['Manage Staff Attendance', ['admin', 'manager']],
        'staff.roles' => ['Manage Staff Roles', ['admin', 'manager']],
    ];

    private const STAFF_ROLES = [
        'Manager' => 'Oversees operations and staff.',
        'Cashier' => 'Handles payments and billing.',
        'Driver' => 'Drives company vehicles.',
        'Operator' => 'Operates machinery and equipment.',
        'Storekeeper' => 'Manages stock and the store.',
        'Site Supervisor' => 'Supervises work on site.',
    ];

    public function up(): void
    {
        Schema::create('staff_roles', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique();
            $table->string('description', 500)->nullable();
            $table->timestamps();
        });

        Schema::create('staff', function (Blueprint $table) {
            $table->id();
            $table->string('staff_code', 30)->unique();
            $table->string('full_name', 150);
            $table->string('nic', 20)->unique();
            $table->string('phone', 30);
            $table->string('email', 150)->nullable();
            $table->string('address', 500)->nullable();
            $table->string('photo')->nullable();
            $table->foreignId('role_id')->constrained('staff_roles')->restrictOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->date('joined_date')->nullable();
            $table->string('status', 20)->default('Active')->index();
            $table->foreignId('user_id')->nullable()->unique()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index('full_name');
        });

        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('staff')->restrictOnDelete();
            $table->date('date');
            $table->time('check_in')->nullable();
            $table->time('check_out')->nullable();
            $table->string('status', 20)->index();
            $table->string('notes', 500)->nullable();
            $table->timestamps();
            $table->unique(['staff_id', 'date']);
            $table->index('date');
        });

        Schema::create('staff_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('staff')->restrictOnDelete();
            $table->foreignId('vehicle_id')->nullable()->constrained('vehicles')->nullOnDelete();
            $table->foreignId('rental_id')->nullable()->constrained('rentals')->nullOnDelete();
            $table->date('assigned_from');
            $table->date('assigned_to')->nullable();
            $table->string('notes', 1000)->nullable();
            $table->timestamps();
            $table->index(['staff_id', 'assigned_from']);
        });

        $now = now();
        foreach (self::STAFF_ROLES as $name => $description) {
            DB::table('staff_roles')->insertOrIgnore([
                'name' => $name,
                'description' => $description,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $roleIds = DB::table('roles')->pluck('id', 'slug');
        foreach (self::PERMISSIONS as $slug => [$name, $roles]) {
            DB::table('permissions')->insertOrIgnore([
                'name' => $name,
                'slug' => $slug,
                'group' => 'Staff',
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

        Schema::dropIfExists('staff_assignments');
        Schema::dropIfExists('attendances');
        Schema::dropIfExists('staff');
        Schema::dropIfExists('staff_roles');
    }
};
