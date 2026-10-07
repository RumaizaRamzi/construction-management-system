<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * listing_type: 'both' (default, previous behaviour), 'rent' or 'sale'.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (! Schema::hasColumn('products', 'listing_type')) {
                $table->string('listing_type', 10)->default('both')->after('status');
                $table->index('listing_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'listing_type')) {
                $table->dropIndex(['listing_type']);
                $table->dropColumn('listing_type');
            }
        });
    }
};
