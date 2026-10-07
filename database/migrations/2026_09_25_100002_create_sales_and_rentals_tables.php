<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_number')->unique();
            $table->foreignId('customer_id')->constrained('customers')->restrictOnDelete();
            $table->date('sale_date');
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('tax', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('balance', 12, 2)->default(0);
            $table->string('payment_status')->default('Pending');
            $table->string('payment_method')->nullable();
            $table->date('payment_date')->nullable();
            $table->string('sale_status')->default('Pending');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('sale_date');
            $table->index('payment_status');
        });

        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->decimal('unit_price', 12, 2);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('subtotal', 12, 2);
            $table->timestamps();
        });

        Schema::create('rentals', function (Blueprint $table) {
            $table->id();
            $table->string('rental_number')->unique();
            $table->foreignId('customer_id')->constrained('customers')->restrictOnDelete();
            $table->date('start_date');
            $table->date('expected_return_date');
            $table->date('actual_return_date')->nullable();
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('deposit', 12, 2)->default(0);
            $table->decimal('late_fee', 12, 2)->default(0);
            $table->decimal('damage_fee', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('balance', 12, 2)->default(0);
            $table->string('payment_status')->default('Pending');
            $table->string('payment_method')->nullable();
            $table->string('status')->default('Pending');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('start_date');
            $table->index('status');
            $table->index('payment_status');
        });

        Schema::create('rental_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rental_id')->constrained('rentals')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->decimal('rental_rate', 12, 2);
            $table->unsignedInteger('rental_days')->default(1);
            $table->decimal('subtotal', 12, 2);
            $table->timestamps();
        });

        Schema::create('rental_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rental_id')->constrained('rentals')->cascadeOnDelete();
            $table->date('payment_date');
            $table->decimal('amount', 12, 2);
            $table->string('payment_method')->nullable();
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('rental_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rental_id')->constrained('rentals')->cascadeOnDelete();
            $table->date('return_date');
            $table->unsignedInteger('returned_quantity')->default(0);
            $table->unsignedInteger('damaged_quantity')->default(0);
            $table->unsignedInteger('missing_quantity')->default(0);
            $table->string('condition')->nullable();
            $table->unsignedInteger('late_days')->default(0);
            $table->decimal('late_fee', 12, 2)->default(0);
            $table->decimal('damage_fee', 12, 2)->default(0);
            $table->string('status')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rental_returns');
        Schema::dropIfExists('rental_payments');
        Schema::dropIfExists('rental_items');
        Schema::dropIfExists('rentals');
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales');
    }
};
