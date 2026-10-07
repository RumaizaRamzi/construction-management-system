<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** slug => [name, role slugs granted] */
    private const PERMISSIONS = [
        'purchases.view' => ['View Purchases', ['admin', 'manager', 'staff']],
        'purchases.create' => ['Create Purchases', ['admin']],
        'purchases.edit' => ['Edit / Cancel Purchases', ['admin']],
    ];

    public function up(): void
    {
        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->string('purchase_number', 30)->unique();
            $table->foreignId('supplier_id')->constrained('suppliers')->restrictOnDelete();
            $table->date('purchase_date');
            $table->string('bill_number', 100)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->decimal('total_amount', 14, 2)->default(0);
            $table->string('payment_type', 20)->default('Credit');
            $table->decimal('paid_amount', 14, 2)->default(0);
            $table->decimal('balance', 14, 2)->default(0);
            $table->string('payment_status', 20)->default('Unpaid')->index();
            $table->string('status', 20)->default('Completed')->index();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancel_reason', 500)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['supplier_id', 'status']);
            $table->index('purchase_date');
        });

        Schema::create('purchase_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_id')->constrained('purchases')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->boolean('is_new_product')->default(false);
            $table->unsignedInteger('quantity');
            $table->decimal('unit_cost', 12, 2)->default(0);
            $table->decimal('line_total', 14, 2)->default(0);
            $table->string('listing_type', 10)->nullable();
            $table->decimal('sale_price', 12, 2)->nullable();
            $table->decimal('rental_price', 12, 2)->nullable();
            $table->timestamps();
            $table->index('product_id');
        });

        $now = now();
        $roleIds = DB::table('roles')->pluck('id', 'slug');
        foreach (self::PERMISSIONS as $slug => [$name, $roles]) {
            DB::table('permissions')->insertOrIgnore([
                'name' => $name,
                'slug' => $slug,
                'group' => 'Purchases',
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

        Schema::dropIfExists('purchase_items');
        Schema::dropIfExists('purchases');
    }
};
