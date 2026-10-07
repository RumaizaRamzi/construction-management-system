<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->string('booking_number')->unique();
            $table->foreignId('customer_id')->constrained('customers')->restrictOnDelete();
            $table->date('booking_date');
            $table->date('start_date');
            $table->date('end_date');
            $table->string('status')->default('Pending');
            $table->decimal('deposit', 12, 2)->default(0);
            $table->decimal('estimated_amount', 12, 2)->default(0);
            $table->foreignId('rental_id')->nullable()->constrained('rentals')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('start_date');
        });

        Schema::create('booking_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->decimal('rental_rate', 12, 2)->nullable();
            $table->timestamps();
        });

        Schema::create('income', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();
            $table->date('date');
            $table->string('source');
            $table->string('category');
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->decimal('amount', 12, 2);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('balance', 12, 2)->default(0);
            $table->string('payment_method')->nullable();
            $table->string('status')->default('Pending');
            $table->date('due_date')->nullable();
            $table->string('related_type')->nullable();
            $table->unsignedBigInteger('related_id')->nullable();
            $table->string('description')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('date');
            $table->index('status');
            $table->index(['related_type', 'related_id']);
        });

        Schema::create('income_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('income_id')->constrained('income')->cascadeOnDelete();
            $table->date('payment_date');
            $table->decimal('amount', 12, 2);
            $table->string('payment_method')->nullable();
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();
            $table->date('date');
            $table->string('category');
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->decimal('amount', 12, 2);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('balance', 12, 2)->default(0);
            $table->string('payment_method')->nullable();
            $table->string('status')->default('Pending');
            $table->date('due_date')->nullable();
            $table->string('description')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('date');
            $table->index('status');
        });

        Schema::create('expense_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('expense_id')->constrained('expenses')->cascadeOnDelete();
            $table->date('payment_date');
            $table->decimal('amount', 12, 2);
            $table->string('payment_method')->nullable();
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expense_payments');
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('income_payments');
        Schema::dropIfExists('income');
        Schema::dropIfExists('booking_items');
        Schema::dropIfExists('bookings');
    }
};
