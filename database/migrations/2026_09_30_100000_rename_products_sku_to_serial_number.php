<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->renameColumn('sku', 'serial_number');
        });

        // The new unique index is added before the old one is dropped so uniqueness is enforced throughout;
        // renameIndex() is not used because MariaDB < 10.5.2 has no RENAME INDEX.
        Schema::table('products', function (Blueprint $table) {
            $table->unique('serial_number', 'products_serial_number_unique');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique('products_sku_unique');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->renameColumn('serial_number', 'sku');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->unique('sku', 'products_sku_unique');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique('products_serial_number_unique');
        });
    }
};
