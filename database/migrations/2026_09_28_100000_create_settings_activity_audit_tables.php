<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('settings')) {
            Schema::create('settings', function (Blueprint $table) {
                $table->id();
                $table->string('key', 100)->unique();
                $table->text('value')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('activity_logs')) {
            Schema::create('activity_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('user_name')->nullable();
                $table->string('action', 50);
                $table->string('module', 50);
                $table->string('subject_type')->nullable();
                $table->unsignedBigInteger('subject_id')->nullable();
                $table->string('subject_label')->nullable();
                $table->string('description', 500);
                $table->string('ip_address', 45)->nullable();
                $table->timestamps();

                $table->index(['module', 'created_at']);
                $table->index(['subject_type', 'subject_id']);
                $table->index('created_at');
            });
        }

        if (! Schema::hasTable('audit_logs')) {
            Schema::create('audit_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('user_name')->nullable();
                $table->string('action', 50);
                $table->string('auditable_type');
                $table->unsignedBigInteger('auditable_id')->nullable();
                $table->string('auditable_label')->nullable();
                $table->json('old_values')->nullable();
                $table->json('new_values')->nullable();
                $table->string('ip_address', 45)->nullable();
                $table->string('user_agent', 500)->nullable();
                $table->timestamps();

                $table->index(['auditable_type', 'auditable_id']);
                $table->index('created_at');
            });
        }

        if (! Schema::hasTable('rental_return_items')) {
            Schema::create('rental_return_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('rental_return_id')->constrained('rental_returns')->cascadeOnDelete();
                $table->foreignId('rental_item_id')->constrained('rental_items')->cascadeOnDelete();
                $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
                $table->unsignedInteger('returned_quantity')->default(0);
                $table->unsignedInteger('damaged_quantity')->default(0);
                $table->unsignedInteger('missing_quantity')->default(0);
                $table->timestamps();

                $table->index('rental_item_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('rental_return_items');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('settings');
    }
};
