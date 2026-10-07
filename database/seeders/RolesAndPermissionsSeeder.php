<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            // Products
            ['name' => 'View Products', 'slug' => 'products.view', 'group' => 'Products'],
            ['name' => 'Create Products', 'slug' => 'products.create', 'group' => 'Products'],
            ['name' => 'Update Products', 'slug' => 'products.update', 'group' => 'Products'],
            ['name' => 'Delete Products', 'slug' => 'products.delete', 'group' => 'Products'],
            // Customers
            ['name' => 'View Customers', 'slug' => 'customers.view', 'group' => 'Customers'],
            ['name' => 'Create Customers', 'slug' => 'customers.create', 'group' => 'Customers'],
            ['name' => 'Update Customers', 'slug' => 'customers.update', 'group' => 'Customers'],
            ['name' => 'Delete Customers', 'slug' => 'customers.delete', 'group' => 'Customers'],
            // Suppliers
            ['name' => 'View Suppliers', 'slug' => 'suppliers.view', 'group' => 'Suppliers'],
            ['name' => 'Create Suppliers', 'slug' => 'suppliers.create', 'group' => 'Suppliers'],
            ['name' => 'Update Suppliers', 'slug' => 'suppliers.update', 'group' => 'Suppliers'],
            ['name' => 'Delete Suppliers', 'slug' => 'suppliers.delete', 'group' => 'Suppliers'],
            // Sales
            ['name' => 'View Sales', 'slug' => 'sales.view', 'group' => 'Sales'],
            ['name' => 'Create Sales', 'slug' => 'sales.create', 'group' => 'Sales'],
            ['name' => 'Update Sales', 'slug' => 'sales.update', 'group' => 'Sales'],
            ['name' => 'Delete Sales', 'slug' => 'sales.delete', 'group' => 'Sales'],
            // Rentals
            ['name' => 'View Rentals', 'slug' => 'rentals.view', 'group' => 'Rentals'],
            ['name' => 'Create Rentals', 'slug' => 'rentals.create', 'group' => 'Rentals'],
            ['name' => 'Update Rentals', 'slug' => 'rentals.update', 'group' => 'Rentals'],
            ['name' => 'Delete Rentals', 'slug' => 'rentals.delete', 'group' => 'Rentals'],
            ['name' => 'Return Rentals', 'slug' => 'rentals.return', 'group' => 'Rentals'],
            // Bookings
            ['name' => 'View Bookings', 'slug' => 'bookings.view', 'group' => 'Bookings'],
            ['name' => 'Create Bookings', 'slug' => 'bookings.create', 'group' => 'Bookings'],
            ['name' => 'Update Bookings', 'slug' => 'bookings.update', 'group' => 'Bookings'],
            ['name' => 'Delete Bookings', 'slug' => 'bookings.delete', 'group' => 'Bookings'],
            // Finance
            ['name' => 'View Income', 'slug' => 'income.view', 'group' => 'Finance'],
            ['name' => 'Create Income', 'slug' => 'income.create', 'group' => 'Finance'],
            ['name' => 'Update Income', 'slug' => 'income.update', 'group' => 'Finance'],
            ['name' => 'Delete Income', 'slug' => 'income.delete', 'group' => 'Finance'],
            ['name' => 'View Expenses', 'slug' => 'expenses.view', 'group' => 'Finance'],
            ['name' => 'Create Expenses', 'slug' => 'expenses.create', 'group' => 'Finance'],
            ['name' => 'Update Expenses', 'slug' => 'expenses.update', 'group' => 'Finance'],
            ['name' => 'Delete Expenses', 'slug' => 'expenses.delete', 'group' => 'Finance'],
            ['name' => 'Manage Payments', 'slug' => 'payments.manage', 'group' => 'Finance'],
            // Cheques
            ['name' => 'View Cheques', 'slug' => 'cheques.view', 'group' => 'Cheques'],
            ['name' => 'Create Cheques', 'slug' => 'cheques.create', 'group' => 'Cheques'],
            ['name' => 'Update Cheques', 'slug' => 'cheques.update', 'group' => 'Cheques'],
            ['name' => 'Delete Cheques', 'slug' => 'cheques.delete', 'group' => 'Cheques'],
            // Maintenance
            ['name' => 'View Checks', 'slug' => 'checks.view', 'group' => 'Maintenance'],
            ['name' => 'Manage Checks', 'slug' => 'checks.manage', 'group' => 'Maintenance'],
            ['name' => 'View Maintenance', 'slug' => 'maintenance.view', 'group' => 'Maintenance'],
            ['name' => 'Manage Maintenance', 'slug' => 'maintenance.manage', 'group' => 'Maintenance'],
            ['name' => 'View Reminders', 'slug' => 'reminders.view', 'group' => 'Maintenance'],
            ['name' => 'Manage Reminders', 'slug' => 'reminders.manage', 'group' => 'Maintenance'],
            // Vehicles
            ['name' => 'View Vehicles', 'slug' => 'vehicles.view', 'group' => 'Vehicles'],
            ['name' => 'Create Vehicles', 'slug' => 'vehicles.create', 'group' => 'Vehicles'],
            ['name' => 'Update Vehicles', 'slug' => 'vehicles.update', 'group' => 'Vehicles'],
            ['name' => 'Delete Vehicles', 'slug' => 'vehicles.delete', 'group' => 'Vehicles'],
            ['name' => 'Manage Vehicle Rentals', 'slug' => 'vehicles.rentals', 'group' => 'Vehicles'],
            ['name' => 'Manage Vehicle Maintenance', 'slug' => 'vehicles.maintenance', 'group' => 'Vehicles'],
            ['name' => 'View Purchases', 'slug' => 'purchases.view', 'group' => 'Purchases'],
            ['name' => 'Create Purchases', 'slug' => 'purchases.create', 'group' => 'Purchases'],
            ['name' => 'Edit / Cancel Purchases', 'slug' => 'purchases.edit', 'group' => 'Purchases'],
            // Staff
            ['name' => 'View Staff', 'slug' => 'staff.view', 'group' => 'Staff'],
            ['name' => 'Create Staff', 'slug' => 'staff.create', 'group' => 'Staff'],
            ['name' => 'Update / Deactivate Staff', 'slug' => 'staff.update', 'group' => 'Staff'],
            ['name' => 'Delete Staff', 'slug' => 'staff.delete', 'group' => 'Staff'],
            ['name' => 'Manage Staff Attendance', 'slug' => 'staff.attendance', 'group' => 'Staff'],
            ['name' => 'Manage Staff Roles', 'slug' => 'staff.roles', 'group' => 'Staff'],
            // Reports
            ['name' => 'View Reports', 'slug' => 'reports.view', 'group' => 'Reports'],
            ['name' => 'Export Reports', 'slug' => 'reports.export', 'group' => 'Reports'],
            // Notifications
            ['name' => 'View Notifications', 'slug' => 'notifications.view', 'group' => 'Notifications'],
            ['name' => 'Manage Notifications', 'slug' => 'notifications.manage', 'group' => 'Notifications'],
            // Users
            ['name' => 'View Users', 'slug' => 'users.view', 'group' => 'Users'],
            ['name' => 'Create Users', 'slug' => 'users.create', 'group' => 'Users'],
            ['name' => 'Update Users', 'slug' => 'users.update', 'group' => 'Users'],
            ['name' => 'Delete Users', 'slug' => 'users.delete', 'group' => 'Users'],
            ['name' => 'Manage Roles', 'slug' => 'roles.manage', 'group' => 'Users'],
            // Settings / categories
            ['name' => 'Manage Settings', 'slug' => 'settings.manage', 'group' => 'Settings'],
            ['name' => 'Manage Branches', 'slug' => 'branches.manage', 'group' => 'Settings'],
            ['name' => 'View Categories', 'slug' => 'categories.view', 'group' => 'Products'],
            ['name' => 'Manage Categories', 'slug' => 'categories.manage', 'group' => 'Products'],
            // History
            ['name' => 'View Activity History', 'slug' => 'activity.view', 'group' => 'History'],
            ['name' => 'View Audit Logs', 'slug' => 'audit.view', 'group' => 'History'],
        ];

        foreach ($permissions as $permission) {
            Permission::query()->updateOrCreate(
                ['slug' => $permission['slug']],
                $permission
            );
        }

        $allSlugs = collect($permissions)->pluck('slug')->all();

        $roleMap = [
            'Admin' => [
                'description' => 'Full system access',
                'permissions' => $allSlugs,
            ],
            'Manager' => [
                'description' => 'Operations and reporting without user administration',
                'permissions' => array_values(array_filter($allSlugs, function ($slug) {
                    return ! in_array($slug, [
                        'users.view', 'users.create', 'users.update', 'users.delete', 'roles.manage',
                        'branches.manage', 'purchases.create', 'purchases.edit',
                    ], true);
                })),
            ],
            'Staff' => [
                'description' => 'Day-to-day operational access',
                'permissions' => [
                    'products.view', 'categories.view',
                    'customers.view', 'customers.create', 'customers.update',
                    'suppliers.view',
                    'sales.view', 'sales.create',
                    'rentals.view', 'rentals.create', 'rentals.update', 'rentals.return',
                    'bookings.view', 'bookings.create', 'bookings.update',
                    'checks.view', 'maintenance.view',
                    'reminders.view',
                    'notifications.view',
                    'reports.view',
                    'vehicles.view', 'vehicles.rentals',
                    'purchases.view',
                    'cheques.view',
                ],
            ],
            'Accountant' => [
                'description' => 'Financial records and reports',
                'permissions' => [
                    'sales.view',
                    'rentals.view',
                    'customers.view',
                    'income.view', 'income.create', 'income.update', 'income.delete',
                    'expenses.view', 'expenses.create', 'expenses.update', 'expenses.delete',
                    'payments.manage',
                    'cheques.view', 'cheques.create', 'cheques.update', 'cheques.delete',
                    'reports.view', 'reports.export',
                    'notifications.view',
                    'activity.view',
                    'vehicles.view',
                    'staff.view',
                ],
            ],
        ];

        $permissionIds = Permission::query()->pluck('id', 'slug');

        foreach ($roleMap as $name => $config) {
            $role = Role::query()->updateOrCreate(
                ['slug' => strtolower($name)],
                [
                    'name' => $name,
                    'description' => $config['description'],
                ]
            );

            $ids = collect($config['permissions'])
                ->map(fn ($slug) => $permissionIds[$slug] ?? null)
                ->filter()
                ->values()
                ->all();

            $role->permissions()->sync($ids);
        }

        $adminRole = Role::query()->where('slug', 'admin')->first();

        $admin = User::query()->firstOrNew(['email' => 'admin@buildtrack.local']);
        if (! $admin->exists) {
            // Initial credentials only; re-running the seeder must never reset a changed password.
            $admin->fill([
                'name' => 'Admin',
                'password' => 'password',
                'status' => 'Active',
            ]);
            $admin->email_verified_at = now();
        }
        $admin->role_id = $adminRole?->id;
        $admin->role = 'Admin';
        $admin->save();

        // Align any existing Admin users without role_id
        User::query()
            ->whereNull('role_id')
            ->where('role', 'Admin')
            ->update(['role_id' => $adminRole?->id]);
    }
}
