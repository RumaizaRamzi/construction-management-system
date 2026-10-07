<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rentals', function (Blueprint $table) {
            $table->date('expected_return_date')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Rentals saved without a return date would block reverting to NOT NULL.
        if (DB::table('rentals')->whereNull('expected_return_date')->exists()) {
            return;
        }

        Schema::table('rentals', function (Blueprint $table) {
            $table->date('expected_return_date')->nullable(false)->change();
        });
    }
};
