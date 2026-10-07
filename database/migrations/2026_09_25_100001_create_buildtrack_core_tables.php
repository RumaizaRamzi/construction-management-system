<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->string('status')->default('Active');
            $table->timestamps();
        });

        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('customer_code')->unique();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->text('address')->nullable();
            $table->string('company_name')->nullable();
            $table->string('status')->default('Active');
            $table->timestamps();

            $table->index('name');
            $table->index('phone');
        });

        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('supplier_code')->unique();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->text('address')->nullable();
            $table->string('company_name')->nullable();
            $table->string('contact_person')->nullable();
            $table->string('status')->default('Active');
            $table->decimal('outstanding', 12, 2)->default(0);
            $table->timestamps();

            $table->index('name');
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->string('sku')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('image')->nullable();
            $table->unsignedInteger('quantity')->default(0);
            $table->unsignedInteger('available_quantity')->default(0);
            $table->unsignedInteger('rented_quantity')->default(0);
            $table->unsignedInteger('minimum_stock')->default(0);
            $table->decimal('purchase_price', 12, 2)->nullable();
            $table->decimal('sale_price', 12, 2)->nullable();
            $table->decimal('rental_price', 12, 2)->nullable();
            $table->string('unit')->nullable();
            $table->string('condition')->nullable();
            $table->string('location')->nullable();
            $table->string('status')->default('Available');
            $table->timestamps();

            $table->index('name');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
        Schema::dropIfExists('suppliers');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('categories');
    }
};
