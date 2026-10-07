<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (! Schema::hasColumn('customers', 'id_number')) {
                $table->string('id_number', 100)->nullable()->after('notes');
            }
            if (! Schema::hasColumn('customers', 'id_photo_path')) {
                $table->string('id_photo_path')->nullable()->after('id_number');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (Schema::hasColumn('customers', 'id_photo_path')) {
                $table->dropColumn('id_photo_path');
            }
            if (Schema::hasColumn('customers', 'id_number')) {
                $table->dropColumn('id_number');
            }
        });
    }
};
