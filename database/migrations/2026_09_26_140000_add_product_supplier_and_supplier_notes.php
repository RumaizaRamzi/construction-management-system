<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('products') && ! Schema::hasColumn('products', 'supplier_id')) {
            Schema::table('products', function (Blueprint $table) {
                $table->foreignId('supplier_id')
                    ->nullable()
                    ->after('category_id')
                    ->constrained('suppliers')
                    ->nullOnDelete();
            });
        }

        if (Schema::hasTable('suppliers') && ! Schema::hasColumn('suppliers', 'notes')) {
            Schema::table('suppliers', function (Blueprint $table) {
                $table->text('notes')->nullable()->after('outstanding');
            });
        }

        if (Schema::hasTable('suppliers') && ! Schema::hasColumn('suppliers', 'products_supplied')) {
            Schema::table('suppliers', function (Blueprint $table) {
                $table->string('products_supplied')->nullable()->after('contact_person');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('products') && Schema::hasColumn('products', 'supplier_id')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropConstrainedForeignId('supplier_id');
            });
        }

        if (Schema::hasTable('suppliers') && Schema::hasColumn('suppliers', 'products_supplied')) {
            Schema::table('suppliers', function (Blueprint $table) {
                $table->dropColumn('products_supplied');
            });
        }

        if (Schema::hasTable('suppliers') && Schema::hasColumn('suppliers', 'notes')) {
            Schema::table('suppliers', function (Blueprint $table) {
                $table->dropColumn('notes');
            });
        }
    }
};
