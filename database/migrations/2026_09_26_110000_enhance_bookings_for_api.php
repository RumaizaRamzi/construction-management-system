<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            if (! Schema::hasColumn('bookings', 'discount')) {
                $table->decimal('discount', 12, 2)->default(0)->after('deposit');
            }
            if (! Schema::hasColumn('bookings', 'subtotal')) {
                $table->decimal('subtotal', 12, 2)->default(0)->after('end_date');
            }
            if (! Schema::hasColumn('bookings', 'paid_amount')) {
                $table->decimal('paid_amount', 12, 2)->default(0)->after('estimated_amount');
            }
            if (! Schema::hasColumn('bookings', 'payment_status')) {
                $table->string('payment_status')->default('Pending')->after('paid_amount');
            }
        });

        Schema::table('booking_items', function (Blueprint $table) {
            if (! Schema::hasColumn('booking_items', 'rental_days')) {
                $table->unsignedInteger('rental_days')->default(1)->after('rental_rate');
            }
            if (! Schema::hasColumn('booking_items', 'subtotal')) {
                $table->decimal('subtotal', 12, 2)->default(0)->after('rental_days');
            }
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            foreach (['discount', 'subtotal', 'paid_amount', 'payment_status'] as $column) {
                if (Schema::hasColumn('bookings', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('booking_items', function (Blueprint $table) {
            foreach (['rental_days', 'subtotal'] as $column) {
                if (Schema::hasColumn('booking_items', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
