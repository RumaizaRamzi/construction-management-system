<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Tables that get an optional branch_id. */
    private const BRANCHED_TABLES = ['products', 'sales', 'rentals', 'bookings', 'expenses', 'income', 'users'];

    public function up(): void
    {
        if (! Schema::hasTable('branches')) {
            Schema::create('branches', function (Blueprint $table) {
                $table->id();
                $table->string('name', 150)->unique();
                $table->string('code', 30)->nullable();
                $table->string('address', 500)->nullable();
                $table->string('phone', 50)->nullable();
                $table->string('status', 20)->default('Active');
                $table->timestamps();
            });
        }

        foreach (self::BRANCHED_TABLES as $tableName) {
            if (! Schema::hasColumn($tableName, 'branch_id')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
                });
            }
        }

        $now = now();
        DB::table('permissions')->insertOrIgnore([
            'name' => 'Manage Branches',
            'slug' => 'branches.manage',
            'group' => 'Settings',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $permissionId = DB::table('permissions')->where('slug', 'branches.manage')->value('id');
        $adminRoleId = DB::table('roles')->where('slug', 'admin')->value('id');
        if ($permissionId && $adminRoleId) {
            DB::table('role_permissions')->insertOrIgnore([
                'role_id' => $adminRoleId,
                'permission_id' => $permissionId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        foreach (self::BRANCHED_TABLES as $tableName) {
            if (Schema::hasColumn($tableName, 'branch_id')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->dropConstrainedForeignId('branch_id');
                });
            }
        }

        $permissionId = DB::table('permissions')->where('slug', 'branches.manage')->value('id');
        if ($permissionId) {
            DB::table('role_permissions')->where('permission_id', $permissionId)->delete();
            DB::table('permissions')->where('id', $permissionId)->delete();
        }

        Schema::dropIfExists('branches');
    }
};
