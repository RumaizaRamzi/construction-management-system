<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (! Schema::hasColumn('customers', 'city')) {
                $table->string('city')->nullable()->after('address');
            }
            if (! Schema::hasColumn('customers', 'customer_type')) {
                $table->string('customer_type')->default('Company')->after('company_name');
            }
            if (! Schema::hasColumn('customers', 'notes')) {
                $table->text('notes')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (Schema::hasColumn('customers', 'notes')) {
                $table->dropColumn('notes');
            }
            if (Schema::hasColumn('customers', 'customer_type')) {
                $table->dropColumn('customer_type');
            }
            if (Schema::hasColumn('customers', 'city')) {
                $table->dropColumn('city');
            }
        });
    }
};
