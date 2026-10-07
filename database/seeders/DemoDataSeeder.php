<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Category;
use App\Models\Customer;
use App\Models\EquipmentCheck;
use App\Models\Expense;
use App\Models\ExpensePayment;
use App\Models\Income;
use App\Models\IncomePayment;
use App\Models\MaintenanceRecord;
use App\Models\Notification;
use App\Models\Product;
use App\Models\Rental;
use App\Models\RentalItem;
use App\Models\RentalPayment;
use App\Models\RentalReturn;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Fictional demo business data for local development only.
 * Never runs automatically: `php artisan db:seed --class=DemoDataSeeder`.
 */
class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->warn('DemoDataSeeder skipped: demo data must not be seeded in production.');

            return;
        }

        $this->call(RolesAndPermissionsSeeder::class);

        // Only seed into an empty catalogue so existing data is never mixed with demo records.
        if (Product::query()->exists()) {
            return;
        }

        $admin = User::query()->where('email', 'admin@buildtrack.local')->first();
        if (! $admin) {
            return;
        }

        $categories = collect([
            ['name' => 'Power Tools', 'description' => 'Drills, grinders, rotary hammers'],
            ['name' => 'Hand Tools', 'description' => 'Manual construction tools'],
            ['name' => 'Concrete Equipment', 'description' => 'Mixers and concrete tools'],
            ['name' => 'Power Equipment', 'description' => 'Generators and power units'],
            ['name' => 'Welding Equipment', 'description' => 'Welders and accessories'],
            ['name' => 'Scaffolding', 'description' => 'Scaffolding sets and frames'],
            ['name' => 'Safety Equipment', 'description' => 'Safety and access gear'],
            ['name' => 'Ladders', 'description' => 'Extension and step ladders'],
        ])->mapWithKeys(function (array $row) {
            $category = Category::query()->create([
                ...$row,
                'status' => 'Active',
            ]);

            return [$row['name'] => $category];
        });

        $customers = collect([
            ['customer_code' => 'CUST-001', 'name' => 'ABC Construction Pvt Ltd', 'phone' => '+94 11 234 5601', 'email' => 'accounts@abcconstruction.lk', 'address' => '120 Industrial Avenue, Colombo 10', 'company_name' => 'ABC Construction Pvt Ltd'],
            ['customer_code' => 'CUST-002', 'name' => 'BuildPro Engineering', 'phone' => '+94 11 234 5602', 'email' => 'finance@buildpro.lk', 'address' => '88 Summit Road, Kandy', 'company_name' => 'BuildPro Engineering'],
            ['customer_code' => 'CUST-003', 'name' => 'Metro Builders', 'phone' => '+94 11 234 5603', 'email' => 'ops@metrobuilders.lk', 'address' => '45 Oak Street, Galle', 'company_name' => 'Metro Builders'],
            ['customer_code' => 'CUST-004', 'name' => 'GreenLine Contractors', 'phone' => '+94 11 234 5604', 'email' => 'hello@greenline.lk', 'address' => '9 Bridge Way, Negombo', 'company_name' => 'GreenLine Contractors'],
            ['customer_code' => 'CUST-005', 'name' => 'Royal Construction Services', 'phone' => '+94 11 234 5605', 'email' => 'contact@royalconstruction.lk', 'address' => '210 Market Street, Jaffna', 'company_name' => 'Royal Construction Services'],
            ['customer_code' => 'CUST-006', 'name' => 'Summit Structures', 'phone' => '+94 11 234 5606', 'email' => 'contact@summitstruct.lk', 'address' => '77 Ridge Boulevard, Kurunegala', 'company_name' => 'Summit Structures'],
        ])->map(fn (array $row) => Customer::query()->create([...$row, 'status' => 'Active']));

        $suppliers = collect([
            ['supplier_code' => 'SUP-001', 'name' => 'Apex Industrial Supply', 'contact_person' => 'James Carter', 'email' => 'james@apexsupply.com', 'phone' => '+1 (555) 100-2001', 'outstanding' => 2500],
            ['supplier_code' => 'SUP-002', 'name' => 'ToolForge Distributors', 'contact_person' => 'Maria Lopez', 'email' => 'maria@toolforge.com', 'phone' => '+1 (555) 100-2002', 'outstanding' => 0],
            ['supplier_code' => 'SUP-003', 'name' => 'PowerGen Partners', 'contact_person' => 'David Kim', 'email' => 'david@powergen.com', 'phone' => '+1 (555) 100-2003', 'outstanding' => 4800],
            ['supplier_code' => 'SUP-004', 'name' => 'BuildTech Suppliers', 'contact_person' => 'Anusha Jay', 'email' => 'orders@buildtech.lk', 'phone' => '+94 11 234 5604', 'outstanding' => 145000],
            ['supplier_code' => 'SUP-005', 'name' => 'ABC Equipment Services', 'contact_person' => 'Nimal Fernando', 'email' => 'service@abcequip.lk', 'phone' => '+94 11 234 5601', 'outstanding' => 0],
        ])->map(fn (array $row) => Supplier::query()->create([
            ...$row,
            'company_name' => $row['name'],
            'status' => 'Active',
        ]));

        $products = collect([
            ['serial_number' => 'CME-001', 'name' => 'Concrete Mixer', 'category' => 'Concrete Equipment', 'quantity' => 8, 'available_quantity' => 5, 'rented_quantity' => 2, 'minimum_stock' => 2, 'purchase_price' => 185000, 'sale_price' => 235000, 'rental_price' => 6500, 'unit' => 'Unit', 'condition' => 'Used', 'status' => 'Available', 'location' => 'Warehouse A — Bay 03', 'image' => '/images/product-1.svg', 'description' => 'Heavy-duty drum concrete mixer with 350L capacity.'],
            ['serial_number' => 'GEN-002', 'name' => 'Portable Generator', 'category' => 'Power Equipment', 'quantity' => 5, 'available_quantity' => 2, 'rented_quantity' => 2, 'minimum_stock' => 1, 'purchase_price' => 320000, 'sale_price' => 410000, 'rental_price' => 12000, 'unit' => 'Unit', 'condition' => 'Used', 'status' => 'Available', 'location' => 'Yard B', 'image' => '/images/product-3.svg', 'description' => 'Portable diesel generator for site power.'],
            ['serial_number' => 'PDR-003', 'name' => 'Power Drill', 'category' => 'Power Tools', 'quantity' => 30, 'available_quantity' => 18, 'rented_quantity' => 8, 'minimum_stock' => 5, 'purchase_price' => 18500, 'sale_price' => 28500, 'rental_price' => 1500, 'unit' => 'Unit', 'condition' => 'New', 'status' => 'Available', 'location' => 'Tool Room', 'image' => '/images/product-2.svg', 'description' => 'Cordless power drill kit.'],
            ['serial_number' => 'AGR-004', 'name' => 'Angle Grinder', 'category' => 'Power Tools', 'quantity' => 20, 'available_quantity' => 10, 'rented_quantity' => 6, 'minimum_stock' => 4, 'purchase_price' => 14500, 'sale_price' => 22000, 'rental_price' => 1200, 'unit' => 'Unit', 'condition' => 'Used', 'status' => 'Available', 'location' => 'Tool Room', 'image' => '/images/product-4.svg', 'description' => 'Heavy-duty angle grinder.'],
            ['serial_number' => 'SCF-005', 'name' => 'Scaffolding Set', 'category' => 'Scaffolding', 'quantity' => 12, 'available_quantity' => 6, 'rented_quantity' => 5, 'minimum_stock' => 2, 'purchase_price' => 95000, 'sale_price' => 135000, 'rental_price' => 4500, 'unit' => 'Set', 'condition' => 'Used', 'status' => 'Available', 'location' => 'Yard A', 'image' => '/images/product-1.svg', 'description' => 'Modular scaffolding set.'],
            ['serial_number' => 'WLD-006', 'name' => 'Welding Machine', 'category' => 'Welding Equipment', 'quantity' => 6, 'available_quantity' => 3, 'rented_quantity' => 2, 'minimum_stock' => 1, 'purchase_price' => 210000, 'sale_price' => 275000, 'rental_price' => 8500, 'unit' => 'Unit', 'condition' => 'Refurbished', 'status' => 'Available', 'location' => 'Workshop', 'image' => '/images/product-3.svg', 'description' => 'Industrial welding machine.'],
            ['serial_number' => 'LAD-007', 'name' => 'Extension Ladder', 'category' => 'Ladders', 'quantity' => 15, 'available_quantity' => 9, 'rented_quantity' => 4, 'minimum_stock' => 3, 'purchase_price' => 22000, 'sale_price' => 32000, 'rental_price' => 1800, 'unit' => 'Unit', 'condition' => 'Used', 'status' => 'Available', 'location' => 'Yard A', 'image' => '/images/product-2.svg', 'description' => 'Aluminum extension ladder.'],
            ['serial_number' => 'RHM-008', 'name' => 'Rotary Hammer', 'category' => 'Power Tools', 'quantity' => 10, 'available_quantity' => 4, 'rented_quantity' => 3, 'minimum_stock' => 2, 'purchase_price' => 56000, 'sale_price' => 78000, 'rental_price' => 3200, 'unit' => 'Unit', 'condition' => 'Used', 'status' => 'Maintenance', 'location' => 'Workshop', 'image' => '/images/product-4.svg', 'description' => 'SDS rotary hammer drill.'],
        ])->map(function (array $row) use ($categories) {
            $categoryName = $row['category'];
            unset($row['category']);

            return Product::query()->create([
                ...$row,
                'category_id' => $categories[$categoryName]->id,
            ]);
        });

        $sale1 = Sale::query()->create([
            'invoice_number' => 'INV-2026-001',
            'customer_id' => $customers[0]->id,
            'sale_date' => '2026-09-24',
            'subtotal' => 87000,
            'discount' => 0,
            'tax' => 0,
            'total_amount' => 87000,
            'paid_amount' => 87000,
            'balance' => 0,
            'payment_status' => 'Paid',
            'payment_method' => 'Bank Transfer',
            'payment_date' => '2026-09-24',
            'sale_status' => 'Completed',
            'notes' => 'Site tools package',
        ]);
        SaleItem::query()->create([
            'sale_id' => $sale1->id,
            'product_id' => $products[2]->id,
            'quantity' => 2,
            'unit_price' => 28500,
            'discount' => 0,
            'subtotal' => 57000,
        ]);
        SaleItem::query()->create([
            'sale_id' => $sale1->id,
            'product_id' => $products[3]->id,
            'quantity' => 1,
            'unit_price' => 30000,
            'discount' => 0,
            'subtotal' => 30000,
        ]);

        $sale2 = Sale::query()->create([
            'invoice_number' => 'INV-2026-002',
            'customer_id' => $customers[1]->id,
            'sale_date' => '2026-09-18',
            'subtotal' => 135000,
            'discount' => 5000,
            'tax' => 0,
            'total_amount' => 130000,
            'paid_amount' => 65000,
            'balance' => 65000,
            'payment_status' => 'Partial',
            'payment_method' => 'Cash',
            'payment_date' => '2026-09-18',
            'sale_status' => 'Completed',
        ]);
        SaleItem::query()->create([
            'sale_id' => $sale2->id,
            'product_id' => $products[4]->id,
            'quantity' => 1,
            'unit_price' => 135000,
            'discount' => 5000,
            'subtotal' => 130000,
        ]);

        $sale3 = Sale::query()->create([
            'invoice_number' => 'INV-2026-003',
            'customer_id' => $customers[2]->id,
            'sale_date' => '2026-09-10',
            'subtotal' => 220000,
            'discount' => 0,
            'tax' => 0,
            'total_amount' => 220000,
            'paid_amount' => 0,
            'balance' => 220000,
            'payment_status' => 'Pending',
            'payment_method' => null,
            'payment_date' => null,
            'sale_status' => 'Pending',
        ]);
        SaleItem::query()->create([
            'sale_id' => $sale3->id,
            'product_id' => $products[5]->id,
            'quantity' => 1,
            'unit_price' => 220000,
            'discount' => 0,
            'subtotal' => 220000,
        ]);

        $rental1 = Rental::query()->create([
            'rental_number' => 'RNT-2026-001',
            'customer_id' => $customers[0]->id,
            'start_date' => '2026-09-20',
            'expected_return_date' => '2026-09-27',
            'actual_return_date' => null,
            'subtotal' => 45500,
            'discount' => 0,
            'deposit' => 10000,
            'late_fee' => 0,
            'damage_fee' => 0,
            'total_amount' => 45500,
            'paid_amount' => 45500,
            'balance' => 0,
            'payment_status' => 'Paid',
            'payment_method' => 'Bank Transfer',
            'status' => 'Active',
            'notes' => 'Mixer rental for foundation pour',
        ]);
        RentalItem::query()->create([
            'rental_id' => $rental1->id,
            'product_id' => $products[0]->id,
            'quantity' => 1,
            'rental_rate' => 6500,
            'rental_days' => 7,
            'subtotal' => 45500,
        ]);
        RentalPayment::query()->create([
            'rental_id' => $rental1->id,
            'payment_date' => '2026-09-20',
            'amount' => 45500,
            'payment_method' => 'Bank Transfer',
            'reference' => 'PAY-RNT-001',
        ]);

        $rental2 = Rental::query()->create([
            'rental_number' => 'RNT-2026-002',
            'customer_id' => $customers[3]->id,
            'start_date' => '2026-09-01',
            'expected_return_date' => '2026-09-08',
            'actual_return_date' => '2026-09-10',
            'subtotal' => 8400,
            'discount' => 0,
            'deposit' => 3000,
            'late_fee' => 3600,
            'damage_fee' => 0,
            'total_amount' => 12000,
            'paid_amount' => 8400,
            'balance' => 3600,
            'payment_status' => 'Partial',
            'payment_method' => 'Cash',
            'status' => 'Returned',
        ]);
        RentalItem::query()->create([
            'rental_id' => $rental2->id,
            'product_id' => $products[3]->id,
            'quantity' => 1,
            'rental_rate' => 1200,
            'rental_days' => 7,
            'subtotal' => 8400,
        ]);
        RentalReturn::query()->create([
            'rental_id' => $rental2->id,
            'return_date' => '2026-09-10',
            'returned_quantity' => 1,
            'damaged_quantity' => 0,
            'missing_quantity' => 0,
            'condition' => 'Used',
            'late_days' => 2,
            'late_fee' => 3600,
            'damage_fee' => 0,
            'status' => 'Completed',
        ]);

        $rental3 = Rental::query()->create([
            'rental_number' => 'RNT-2026-003',
            'customer_id' => $customers[4]->id,
            'start_date' => '2026-09-15',
            'expected_return_date' => '2026-09-22',
            'actual_return_date' => null,
            'subtotal' => 84000,
            'discount' => 0,
            'deposit' => 20000,
            'late_fee' => 0,
            'damage_fee' => 0,
            'total_amount' => 84000,
            'paid_amount' => 0,
            'balance' => 84000,
            'payment_status' => 'Overdue',
            'payment_method' => null,
            'status' => 'Overdue',
        ]);
        RentalItem::query()->create([
            'rental_id' => $rental3->id,
            'product_id' => $products[1]->id,
            'quantity' => 1,
            'rental_rate' => 12000,
            'rental_days' => 7,
            'subtotal' => 84000,
        ]);

        $booking1 = Booking::query()->create([
            'booking_number' => 'BKG-2026-001',
            'customer_id' => $customers[1]->id,
            'booking_date' => '2026-09-12',
            'start_date' => '2026-09-28',
            'end_date' => '2026-10-05',
            'status' => 'Confirmed',
            'deposit' => 5000,
            'estimated_amount' => 31500,
            'notes' => 'Scaffolding for facade work',
        ]);
        BookingItem::query()->create([
            'booking_id' => $booking1->id,
            'product_id' => $products[4]->id,
            'quantity' => 1,
            'rental_rate' => 4500,
        ]);

        $booking2 = Booking::query()->create([
            'booking_number' => 'BKG-2026-002',
            'customer_id' => $customers[5]->id,
            'booking_date' => '2026-09-20',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-04',
            'status' => 'Pending',
            'deposit' => 0,
            'estimated_amount' => 9600,
        ]);
        BookingItem::query()->create([
            'booking_id' => $booking2->id,
            'product_id' => $products[2]->id,
            'quantity' => 2,
            'rental_rate' => 1500,
        ]);

        $income1 = Income::query()->create([
            'reference' => 'INC-001',
            'date' => '2026-09-24',
            'source' => 'Sale',
            'category' => 'Product Sales',
            'customer_id' => $customers[0]->id,
            'amount' => 87000,
            'paid_amount' => 87000,
            'balance' => 0,
            'payment_method' => 'Bank Transfer',
            'status' => 'Paid',
            'related_type' => 'sale',
            'related_id' => $sale1->id,
            'description' => 'Payment for INV-2026-001',
        ]);
        IncomePayment::query()->create([
            'income_id' => $income1->id,
            'payment_date' => '2026-09-24',
            'amount' => 87000,
            'payment_method' => 'Bank Transfer',
            'reference' => 'PAY-INC-001',
        ]);

        $income2 = Income::query()->create([
            'reference' => 'INC-002',
            'date' => '2026-09-20',
            'source' => 'Rental',
            'category' => 'Equipment Rental',
            'customer_id' => $customers[0]->id,
            'amount' => 45500,
            'paid_amount' => 45500,
            'balance' => 0,
            'payment_method' => 'Bank Transfer',
            'status' => 'Paid',
            'related_type' => 'rental',
            'related_id' => $rental1->id,
            'description' => 'Rental income RNT-2026-001',
        ]);
        IncomePayment::query()->create([
            'income_id' => $income2->id,
            'payment_date' => '2026-09-20',
            'amount' => 45500,
            'payment_method' => 'Bank Transfer',
            'reference' => 'PAY-INC-002',
        ]);

        $income3 = Income::query()->create([
            'reference' => 'INC-003',
            'date' => '2026-09-18',
            'source' => 'Sale',
            'category' => 'Product Sales',
            'customer_id' => $customers[1]->id,
            'amount' => 130000,
            'paid_amount' => 65000,
            'balance' => 65000,
            'payment_method' => 'Cash',
            'status' => 'Partial',
            'due_date' => '2026-09-30',
            'related_type' => 'sale',
            'related_id' => $sale2->id,
        ]);
        IncomePayment::query()->create([
            'income_id' => $income3->id,
            'payment_date' => '2026-09-18',
            'amount' => 65000,
            'payment_method' => 'Cash',
            'reference' => 'PAY-INC-003',
        ]);

        $expense1 = Expense::query()->create([
            'reference' => 'EXP-001',
            'date' => '2026-09-05',
            'category' => 'Equipment Purchase',
            'supplier_id' => $suppliers[0]->id,
            'product_id' => $products[0]->id,
            'amount' => 185000,
            'paid_amount' => 185000,
            'balance' => 0,
            'payment_method' => 'Bank Transfer',
            'status' => 'Paid',
            'description' => 'Concrete mixer stock replenishment',
        ]);
        ExpensePayment::query()->create([
            'expense_id' => $expense1->id,
            'payment_date' => '2026-09-05',
            'amount' => 185000,
            'payment_method' => 'Bank Transfer',
            'reference' => 'PAY-EXP-001',
        ]);

        $expense2 = Expense::query()->create([
            'reference' => 'EXP-002',
            'date' => '2026-09-12',
            'category' => 'Maintenance',
            'supplier_id' => $suppliers[4]->id,
            'product_id' => $products[7]->id,
            'amount' => 28500,
            'paid_amount' => 10000,
            'balance' => 18500,
            'payment_method' => 'Cash',
            'status' => 'Partial',
            'due_date' => '2026-09-30',
            'description' => 'Rotary hammer service',
        ]);
        ExpensePayment::query()->create([
            'expense_id' => $expense2->id,
            'payment_date' => '2026-09-12',
            'amount' => 10000,
            'payment_method' => 'Cash',
            'reference' => 'PAY-EXP-002',
        ]);

        $expense3 = Expense::query()->create([
            'reference' => 'EXP-003',
            'date' => '2026-09-15',
            'category' => 'Fuel',
            'supplier_id' => $suppliers[2]->id,
            'amount' => 45000,
            'paid_amount' => 0,
            'balance' => 45000,
            'payment_method' => null,
            'status' => 'Pending',
            'due_date' => '2026-09-28',
            'description' => 'Generator fuel stock',
        ]);

        EquipmentCheck::query()->create([
            'check_number' => 'CHK-2026-001',
            'product_id' => $products[0]->id,
            'check_type' => 'Safety Inspection',
            'scheduled_date' => '2026-09-26',
            'completed_date' => null,
            'frequency' => 'Monthly',
            'status' => 'Scheduled',
            'priority' => 'High',
            'assigned_to' => 'Mike Torres',
            'notes' => 'Drum and motor inspection',
        ]);
        EquipmentCheck::query()->create([
            'check_number' => 'CHK-2026-002',
            'product_id' => $products[1]->id,
            'check_type' => 'Oil & Filter Check',
            'scheduled_date' => '2026-09-20',
            'completed_date' => '2026-09-20',
            'frequency' => 'Every 3 Months',
            'status' => 'Completed',
            'priority' => 'Medium',
            'result' => 'Passed',
            'assigned_to' => 'Sara Patel',
        ]);

        MaintenanceRecord::query()->create([
            'maintenance_number' => 'MNT-2026-001',
            'product_id' => $products[7]->id,
            'maintenance_type' => 'Repair',
            'start_date' => '2026-09-18',
            'expected_completion' => '2026-09-28',
            'completed_date' => null,
            'cost' => null,
            'estimated_cost' => 28500,
            'status' => 'In Progress',
            'priority' => 'High',
            'technician' => 'Nimal Fernando',
            'notes' => 'Chuck assembly replacement',
        ]);
        MaintenanceRecord::query()->create([
            'maintenance_number' => 'MNT-2026-002',
            'product_id' => $products[0]->id,
            'maintenance_type' => 'Preventive Maintenance',
            'start_date' => '2026-08-28',
            'expected_completion' => '2026-08-29',
            'completed_date' => '2026-08-29',
            'cost' => 12500,
            'estimated_cost' => 12000,
            'status' => 'Completed',
            'priority' => 'Medium',
            'technician' => 'Mike Torres',
            'next_maintenance_date' => '2026-11-28',
        ]);

        Notification::query()->create([
            'user_id' => $admin->id,
            'type' => 'Info',
            'category' => 'System',
            'priority' => 'Low',
            'title' => 'Welcome to BuildTrack',
            'message' => 'Backend API and MySQL foundation are ready for development.',
            'link' => '/settings/notifications',
            'is_read' => true,
            'read_at' => now(),
        ]);
        Notification::query()->create([
            'user_id' => $admin->id,
            'type' => 'Warning',
            'category' => 'Inventory',
            'priority' => 'High',
            'title' => 'Low stock alert',
            'message' => 'Portable Generator available quantity is near minimum stock.',
            'related_type' => 'product',
            'related_id' => $products[1]->id,
            'link' => '/products/2',
            'is_read' => false,
        ]);
    }
}
