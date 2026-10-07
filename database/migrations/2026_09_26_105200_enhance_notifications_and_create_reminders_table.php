<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            if (! Schema::hasColumn('notifications', 'status')) {
                $table->string('status', 30)->default('Unread')->after('is_read');
            }
            if (! Schema::hasColumn('notifications', 'action_url')) {
                $table->string('action_url')->nullable()->after('link');
            }
            $table->index(['type', 'related_type', 'related_id', 'status'], 'notifications_alert_lookup_idx');
            $table->index('status');
            $table->index('priority');
        });

        if (! Schema::hasTable('reminders')) {
            Schema::create('reminders', function (Blueprint $table) {
                $table->id();
                $table->string('reminder_number')->nullable()->unique();
                $table->string('title');
                $table->text('message')->nullable();
                $table->date('due_date');
                $table->string('status')->default('Pending');
                $table->string('priority')->nullable()->default('Medium');
                $table->string('related_type')->nullable();
                $table->unsignedBigInteger('related_id')->nullable();
                $table->string('link')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['status', 'due_date']);
                $table->index(['related_type', 'related_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('reminders');

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('notifications_alert_lookup_idx');
            if (Schema::hasColumn('notifications', 'status')) {
                $table->dropColumn('status');
            }
            if (Schema::hasColumn('notifications', 'action_url')) {
                $table->dropColumn('action_url');
            }
        });
    }
};
