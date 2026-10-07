<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('equipment_checks', function (Blueprint $table) {
            $table->id();
            $table->string('check_number')->unique();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->string('check_type');
            $table->date('scheduled_date');
            $table->date('completed_date')->nullable();
            $table->string('frequency')->nullable();
            $table->string('status')->default('Scheduled');
            $table->string('priority')->nullable();
            $table->string('result')->nullable();
            $table->string('assigned_to')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('scheduled_date');
            $table->index('status');
        });

        Schema::create('maintenance_records', function (Blueprint $table) {
            $table->id();
            $table->string('maintenance_number')->unique();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->string('maintenance_type');
            $table->date('start_date');
            $table->date('expected_completion')->nullable();
            $table->date('completed_date')->nullable();
            $table->decimal('cost', 12, 2)->nullable();
            $table->decimal('estimated_cost', 12, 2)->nullable();
            $table->string('status')->default('Scheduled');
            $table->string('priority')->nullable();
            $table->string('technician')->nullable();
            $table->date('next_maintenance_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('start_date');
            $table->index('status');
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type');
            $table->string('category')->nullable();
            $table->string('priority')->nullable();
            $table->string('title');
            $table->text('message');
            $table->string('related_type')->nullable();
            $table->unsignedBigInteger('related_id')->nullable();
            $table->string('link')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index('is_read');
            $table->index(['related_type', 'related_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('maintenance_records');
        Schema::dropIfExists('equipment_checks');
    }
};
