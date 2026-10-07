<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('sale_payments')) {
            Schema::create('sale_payments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
                $table->date('payment_date');
                $table->decimal('amount', 12, 2);
                $table->string('payment_method')->nullable();
                $table->string('reference')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['sale_id', 'payment_date'], 'sale_payments_sale_date_index');
            });
        }

        if (! Schema::hasIndex('sales', 'sales_sale_status_index')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->index('sale_status', 'sales_sale_status_index');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasIndex('sales', 'sales_sale_status_index')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->dropIndex('sales_sale_status_index');
            });
        }

        Schema::dropIfExists('sale_payments');
    }
};
