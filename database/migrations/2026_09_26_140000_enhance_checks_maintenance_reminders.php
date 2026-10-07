<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('equipment_checks', function (Blueprint $table) {
            if (! Schema::hasColumn('equipment_checks', 'rental_id')) {
                $table->foreignId('rental_id')->nullable()->after('product_id')->constrained('rentals')->nullOnDelete();
            }
            if (! Schema::hasColumn('equipment_checks', 'customer_id')) {
                $table->foreignId('customer_id')->nullable()->after('rental_id')->constrained('customers')->nullOnDelete();
            }
            if (! Schema::hasColumn('equipment_checks', 'description')) {
                $table->text('description')->nullable()->after('check_type');
            }
            if (! Schema::hasColumn('equipment_checks', 'condition')) {
                $table->string('condition', 50)->nullable()->after('result');
            }
            if (! Schema::hasColumn('equipment_checks', 'checklist_data')) {
                $table->json('checklist_data')->nullable()->after('condition');
            }
            if (! Schema::hasColumn('equipment_checks', 'checked_by')) {
                $table->foreignId('checked_by')->nullable()->after('assigned_to')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('equipment_checks', 'reminder_before')) {
                $table->string('reminder_before', 50)->nullable()->after('priority');
            }
            if (! Schema::hasColumn('equipment_checks', 'next_check_date')) {
                $table->date('next_check_date')->nullable()->after('completed_date');
            }
        });

        Schema::table('maintenance_records', function (Blueprint $table) {
            if (! Schema::hasColumn('maintenance_records', 'description')) {
                $table->text('description')->nullable()->after('maintenance_type');
            }
            if (! Schema::hasColumn('maintenance_records', 'supplier_id')) {
                $table->foreignId('supplier_id')->nullable()->after('product_id')->constrained('suppliers')->nullOnDelete();
            }
            if (! Schema::hasColumn('maintenance_records', 'scheduled_date')) {
                $table->date('scheduled_date')->nullable()->after('maintenance_type');
            }
            if (! Schema::hasColumn('maintenance_records', 'started_date')) {
                $table->date('started_date')->nullable()->after('start_date');
            }
        });

        Schema::table('reminders', function (Blueprint $table) {
            if (! Schema::hasColumn('reminders', 'reminder_type')) {
                $table->string('reminder_type', 50)->nullable()->default('Manual')->after('title');
            }
            if (! Schema::hasColumn('reminders', 'description')) {
                $table->text('description')->nullable()->after('message');
            }
            if (! Schema::hasColumn('reminders', 'product_id')) {
                $table->foreignId('product_id')->nullable()->after('related_id')->constrained('products')->nullOnDelete();
            }
            if (! Schema::hasColumn('reminders', 'frequency')) {
                $table->string('frequency', 50)->nullable()->after('priority');
            }
            if (! Schema::hasColumn('reminders', 'is_recurring')) {
                $table->boolean('is_recurring')->default(false)->after('frequency');
            }
            if (! Schema::hasColumn('reminders', 'next_reminder')) {
                $table->date('next_reminder')->nullable()->after('due_date');
            }
            if (! Schema::hasColumn('reminders', 'last_sent')) {
                $table->date('last_sent')->nullable()->after('next_reminder');
            }
            if (! Schema::hasColumn('reminders', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('status');
            }
            if (! Schema::hasColumn('reminders', 'dismissed_at')) {
                $table->timestamp('dismissed_at')->nullable()->after('completed_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('equipment_checks', function (Blueprint $table) {
            foreach (['next_check_date', 'reminder_before', 'checked_by', 'checklist_data', 'condition', 'description', 'customer_id', 'rental_id'] as $col) {
                if (Schema::hasColumn('equipment_checks', $col)) {
                    if (in_array($col, ['rental_id', 'customer_id', 'checked_by'], true)) {
                        $table->dropConstrainedForeignId($col);
                    } else {
                        $table->dropColumn($col);
                    }
                }
            }
        });

        Schema::table('maintenance_records', function (Blueprint $table) {
            foreach (['started_date', 'scheduled_date', 'supplier_id', 'description'] as $col) {
                if (Schema::hasColumn('maintenance_records', $col)) {
                    if ($col === 'supplier_id') {
                        $table->dropConstrainedForeignId($col);
                    } else {
                        $table->dropColumn($col);
                    }
                }
            }
        });

        Schema::table('reminders', function (Blueprint $table) {
            foreach ([
                'dismissed_at', 'completed_at', 'last_sent', 'next_reminder',
                'is_recurring', 'frequency', 'product_id', 'description', 'reminder_type',
            ] as $col) {
                if (Schema::hasColumn('reminders', $col)) {
                    if ($col === 'product_id') {
                        $table->dropConstrainedForeignId($col);
                    } else {
                        $table->dropColumn($col);
                    }
                }
            }
        });
    }
};
