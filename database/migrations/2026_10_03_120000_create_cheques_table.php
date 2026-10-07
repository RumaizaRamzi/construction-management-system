<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** slug => [name, roles that receive it]. Admin bypasses permission checks. */
    private const PERMISSIONS = [
        'cheques.view' => ['View Cheques', ['admin', 'manager', 'accountant', 'staff']],
        'cheques.create' => ['Create Cheques', ['admin', 'manager', 'accountant']],
        'cheques.update' => ['Update Cheques', ['admin', 'manager', 'accountant']],
        'cheques.delete' => ['Delete Cheques', ['admin', 'manager', 'accountant']],
    ];

    public function up(): void
    {
        Schema::create('cheques', function (Blueprint $table) {
            $table->id();
            $table->string('cheque_number', 50)->nullable();
            $table->string('bank', 100)->nullable();
            $table->decimal('amount', 14, 2);
            $table->date('cheque_date');
            $table->string('type', 10)->default('received');
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->string('status', 20)->default('Pending');
            $table->timestamp('status_changed_at')->nullable();
            $table->text('notes')->nullable();
            $table->string('reference_type', 20)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('payment_type', 30)->nullable();
            $table->unsignedBigInteger('payment_id')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'cheque_date']);
            $table->index(['type', 'status']);
            $table->index(['reference_type', 'reference_id']);
            $table->unique(['payment_type', 'payment_id']);
        });

        $now = now();
        $roleIds = DB::table('roles')->pluck('id', 'slug');
        foreach (self::PERMISSIONS as $slug => [$name, $roles]) {
            DB::table('permissions')->insertOrIgnore([
                'name' => $name,
                'slug' => $slug,
                'group' => 'Cheques',
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

        Schema::dropIfExists('cheques');
    }
};
