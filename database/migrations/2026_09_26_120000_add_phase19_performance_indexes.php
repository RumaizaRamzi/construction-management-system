<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addIndexIfMissing('users', ['status'], 'users_status_index');
        $this->addIndexIfMissing('products', ['name'], 'products_name_index');
        $this->addIndexIfMissing('products', ['status'], 'products_status_index');
        $this->addIndexIfMissing('customers', ['name'], 'customers_name_index');
        $this->addIndexIfMissing('customers', ['status'], 'customers_status_index');
        $this->addIndexIfMissing('customers', ['email'], 'customers_email_index');
        $this->addIndexIfMissing('customers', ['phone'], 'customers_phone_index');
        $this->addIndexIfMissing('suppliers', ['name'], 'suppliers_name_index');
        $this->addIndexIfMissing('suppliers', ['status'], 'suppliers_status_index');
        $this->addIndexIfMissing('sales', ['sale_date'], 'sales_sale_date_index');
        $this->addIndexIfMissing('sales', ['payment_status'], 'sales_payment_status_index');
        $this->addIndexIfMissing('rentals', ['start_date'], 'rentals_start_date_index');
        $this->addIndexIfMissing('rentals', ['expected_return_date'], 'rentals_expected_return_date_index');
        $this->addIndexIfMissing('rentals', ['status'], 'rentals_status_index');
        $this->addIndexIfMissing('rentals', ['payment_status'], 'rentals_payment_status_index');
        $this->addIndexIfMissing('bookings', ['start_date'], 'bookings_start_date_index');
        $this->addIndexIfMissing('bookings', ['end_date'], 'bookings_end_date_index');
        $this->addIndexIfMissing('bookings', ['status'], 'bookings_status_index');
        $this->addIndexIfMissing('income', ['date'], 'income_date_index');
        $this->addIndexIfMissing('income', ['status'], 'income_status_index');
        $this->addIndexIfMissing('expenses', ['date'], 'expenses_date_index');
        $this->addIndexIfMissing('expenses', ['status'], 'expenses_status_index');
        $this->addIndexIfMissing('expenses', ['category'], 'expenses_category_index');
        $this->addIndexIfMissing('notifications', ['user_id', 'status', 'created_at'], 'notifications_user_status_created_index');
    }

    public function down(): void
    {
        $this->dropIndexIfExists('users', 'users_status_index');
        $this->dropIndexIfExists('products', 'products_name_index');
        $this->dropIndexIfExists('products', 'products_status_index');
        $this->dropIndexIfExists('customers', 'customers_name_index');
        $this->dropIndexIfExists('customers', 'customers_status_index');
        $this->dropIndexIfExists('customers', 'customers_email_index');
        $this->dropIndexIfExists('customers', 'customers_phone_index');
        $this->dropIndexIfExists('suppliers', 'suppliers_name_index');
        $this->dropIndexIfExists('suppliers', 'suppliers_status_index');
        $this->dropIndexIfExists('sales', 'sales_sale_date_index');
        $this->dropIndexIfExists('sales', 'sales_payment_status_index');
        $this->dropIndexIfExists('rentals', 'rentals_start_date_index');
        $this->dropIndexIfExists('rentals', 'rentals_expected_return_date_index');
        $this->dropIndexIfExists('rentals', 'rentals_status_index');
        $this->dropIndexIfExists('rentals', 'rentals_payment_status_index');
        $this->dropIndexIfExists('bookings', 'bookings_start_date_index');
        $this->dropIndexIfExists('bookings', 'bookings_end_date_index');
        $this->dropIndexIfExists('bookings', 'bookings_status_index');
        $this->dropIndexIfExists('income', 'income_date_index');
        $this->dropIndexIfExists('income', 'income_status_index');
        $this->dropIndexIfExists('expenses', 'expenses_date_index');
        $this->dropIndexIfExists('expenses', 'expenses_status_index');
        $this->dropIndexIfExists('expenses', 'expenses_category_index');
        $this->dropIndexIfExists('notifications', 'notifications_user_status_created_index');
    }

    private function addIndexIfMissing(string $table, array $columns, string $indexName): void
    {
        if (! Schema::hasTable($table) || $this->indexExists($table, $indexName)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($columns, $indexName) {
            $blueprint->index($columns, $indexName);
        });
    }

    private function dropIndexIfExists(string $table, string $indexName): void
    {
        if (! Schema::hasTable($table) || ! $this->indexExists($table, $indexName)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($indexName) {
            $blueprint->dropIndex($indexName);
        });
    }

    private function indexExists(string $table, string $indexName): bool
    {
        return Schema::hasIndex($table, $indexName);
    }
};
