<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\Admin\AdminRoleController;
use App\Http\Controllers\Api\Admin\AdminUserController;
use App\Http\Controllers\Api\Admin\SmsGatewayController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CheckController;
use App\Http\Controllers\Api\ChequeController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\IncomeController;
use App\Http\Controllers\Api\InvoiceSmsController;
use App\Http\Controllers\Api\MaintenanceController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\RentalController;
use App\Http\Controllers\Api\ReminderController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\SearchController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\StaffAssignmentController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\StaffRoleController;
use App\Http\Controllers\Api\StockMovementController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\PurchaseController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\VehicleController;
use App\Http\Controllers\Api\VehicleMaintenanceController;
use App\Http\Controllers\Api\VehicleRentalController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'success' => true,
        'message' => 'BuildTrack API is running.',
        'data' => [
            'app' => 'BuildTrack Construction Management System',
            'version' => '1.0.0',
        ],
    ]);
});

Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:login');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);

    Route::get('/search', SearchController::class)->middleware('throttle:search');

    Route::middleware('permission:users.view')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::get('/users/{user}', [UserController::class, 'show']);
    });
    Route::post('/users', [UserController::class, 'store'])->middleware('permission:users.create');
    Route::put('/users/{user}', [UserController::class, 'update'])->middleware('permission:users.update');
    Route::patch('/users/{user}', [UserController::class, 'update'])->middleware('permission:users.update');
    Route::delete('/users/{user}', [UserController::class, 'destroy'])->middleware('permission:users.delete');
    Route::get('/roles', [UserController::class, 'roles'])->middleware('permission:users.view,roles.manage');
    Route::get('/permissions', [UserController::class, 'permissions'])->middleware('permission:roles.manage,users.view');

    Route::get('/customers', [CustomerController::class, 'index'])->middleware('permission:customers.view');
    Route::post('/customers', [CustomerController::class, 'store'])->middleware('permission:customers.create');
    Route::get('/customers/{customer}', [CustomerController::class, 'show'])->middleware('permission:customers.view');
    Route::put('/customers/{customer}', [CustomerController::class, 'update'])->middleware('permission:customers.update');
    Route::patch('/customers/{customer}', [CustomerController::class, 'update'])->middleware('permission:customers.update');
    Route::delete('/customers/{customer}', [CustomerController::class, 'destroy'])->middleware('permission:customers.delete');
    Route::get('/customers/{customer}/id-photo', [CustomerController::class, 'showIdPhoto'])->middleware('permission:customers.view');
    Route::post('/customers/{customer}/id-photo', [CustomerController::class, 'uploadIdPhoto'])->middleware('permission:customers.create,customers.update');
    Route::delete('/customers/{customer}/id-photo', [CustomerController::class, 'destroyIdPhoto'])->middleware('permission:customers.update');

    Route::get('/suppliers', [SupplierController::class, 'index'])->middleware('permission:suppliers.view');
    Route::post('/suppliers', [SupplierController::class, 'store'])->middleware('permission:suppliers.create');
    Route::get('/suppliers/{supplier}', [SupplierController::class, 'show'])->middleware('permission:suppliers.view');
    Route::put('/suppliers/{supplier}', [SupplierController::class, 'update'])->middleware('permission:suppliers.update');
    Route::patch('/suppliers/{supplier}', [SupplierController::class, 'update'])->middleware('permission:suppliers.update');
    Route::delete('/suppliers/{supplier}', [SupplierController::class, 'destroy'])->middleware('permission:suppliers.delete');

    Route::get('/branches', [BranchController::class, 'index']);
    Route::post('/branches', [BranchController::class, 'store'])->middleware('permission:branches.manage');
    Route::put('/branches/{branch}', [BranchController::class, 'update'])->middleware('permission:branches.manage');
    Route::patch('/branches/{branch}', [BranchController::class, 'update'])->middleware('permission:branches.manage');
    Route::delete('/branches/{branch}', [BranchController::class, 'destroy'])->middleware('permission:branches.manage');

    Route::get('/categories', [CategoryController::class, 'index'])->middleware('permission:categories.view,products.view');
    Route::post('/categories', [CategoryController::class, 'store'])->middleware('permission:categories.manage');
    Route::get('/categories/{category}', [CategoryController::class, 'show'])->middleware('permission:categories.view,products.view');
    Route::put('/categories/{category}', [CategoryController::class, 'update'])->middleware('permission:categories.manage');
    Route::patch('/categories/{category}', [CategoryController::class, 'update'])->middleware('permission:categories.manage');
    Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->middleware('permission:categories.manage');

    Route::get('/products', [ProductController::class, 'index'])->middleware('permission:products.view');
    Route::post('/products', [ProductController::class, 'store'])->middleware('permission:products.create');
    Route::get('/products/{product}', [ProductController::class, 'show'])->middleware('permission:products.view');
    Route::put('/products/{product}', [ProductController::class, 'update'])->middleware('permission:products.update');
    Route::patch('/products/{product}', [ProductController::class, 'update'])->middleware('permission:products.update');
    Route::delete('/products/{product}', [ProductController::class, 'destroy'])->middleware('permission:products.delete');
    Route::post('/products/{product}/adjust-stock', [ProductController::class, 'adjustStock'])->middleware('permission:products.update');
    Route::post('/products/{product}/transfer-to-sale', [ProductController::class, 'transferToSale'])->middleware('permission:products.update');

    Route::get('/stock-movements', [StockMovementController::class, 'index'])
        ->middleware('permission:products.view');
    Route::get('/stock-movements/summary', [StockMovementController::class, 'summary'])
        ->middleware('permission:products.view');
    Route::get('/products/{product}/stock-history', [StockMovementController::class, 'productHistory'])
        ->middleware('permission:products.view');

    Route::get('/sales', [SaleController::class, 'index'])->middleware('permission:sales.view');
    Route::post('/sales', [SaleController::class, 'store'])->middleware('permission:sales.create');
    Route::get('/sales/{sale}', [SaleController::class, 'show'])->middleware('permission:sales.view');
    Route::put('/sales/{sale}', [SaleController::class, 'update'])->middleware('permission:sales.update');
    Route::patch('/sales/{sale}', [SaleController::class, 'update'])->middleware('permission:sales.update');
    Route::delete('/sales/{sale}', [SaleController::class, 'destroy'])->middleware('permission:sales.delete');
    Route::post('/sales/{sale}/payments', [SaleController::class, 'paymentsStore'])->middleware('permission:payments.manage,sales.update');
    Route::get('/sales/{sale}/invoice-sms', [InvoiceSmsController::class, 'salePreview'])->middleware('permission:sales.create,sales.update');
    Route::post('/sales/{sale}/invoice-sms', [InvoiceSmsController::class, 'saleSend'])->middleware(['permission:sales.create,sales.update', 'throttle:20,1']);

    Route::get('/rentals', [RentalController::class, 'index'])->middleware('permission:rentals.view');
    Route::post('/rentals', [RentalController::class, 'store'])->middleware('permission:rentals.create');
    Route::get('/rentals/{rental}', [RentalController::class, 'show'])->middleware('permission:rentals.view');
    Route::put('/rentals/{rental}', [RentalController::class, 'update'])->middleware('permission:rentals.update');
    Route::patch('/rentals/{rental}', [RentalController::class, 'update'])->middleware('permission:rentals.update');
    Route::delete('/rentals/{rental}', [RentalController::class, 'destroy'])->middleware('permission:rentals.delete');
    Route::get('/rentals/{rental}/payments', [RentalController::class, 'paymentsIndex'])->middleware('permission:rentals.view,payments.manage');
    Route::post('/rentals/{rental}/payments', [RentalController::class, 'paymentsStore'])->middleware('permission:payments.manage,rentals.update');
    Route::put('/rentals/{rental}/payments/{payment}', [RentalController::class, 'paymentsUpdate'])->middleware('permission:payments.manage,rentals.update');
    Route::patch('/rentals/{rental}/payments/{payment}', [RentalController::class, 'paymentsUpdate'])->middleware('permission:payments.manage,rentals.update');
    Route::delete('/rentals/{rental}/payments/{payment}', [RentalController::class, 'paymentsDestroy'])->middleware('permission:payments.manage,rentals.update');
    Route::get('/rentals/{rental}/return', [RentalController::class, 'returnShow'])->middleware('permission:rentals.return,rentals.view');
    Route::post('/rentals/{rental}/return', [RentalController::class, 'returnStore'])->middleware('permission:rentals.return');
    Route::get('/rentals/{rental}/invoice-sms', [InvoiceSmsController::class, 'rentalPreview'])->middleware('permission:rentals.create,rentals.update,rentals.return');
    Route::post('/rentals/{rental}/invoice-sms', [InvoiceSmsController::class, 'rentalSend'])->middleware(['permission:rentals.create,rentals.update,rentals.return', 'throttle:20,1']);

    Route::get('/bookings/availability', [BookingController::class, 'availability'])->middleware('permission:bookings.view');
    Route::get('/bookings', [BookingController::class, 'index'])->middleware('permission:bookings.view');
    Route::post('/bookings', [BookingController::class, 'store'])->middleware('permission:bookings.create');
    Route::get('/bookings/{booking}', [BookingController::class, 'show'])->middleware('permission:bookings.view');
    Route::put('/bookings/{booking}', [BookingController::class, 'update'])->middleware('permission:bookings.update');
    Route::patch('/bookings/{booking}', [BookingController::class, 'update'])->middleware('permission:bookings.update');
    Route::delete('/bookings/{booking}', [BookingController::class, 'destroy'])->middleware('permission:bookings.delete');
    Route::patch('/bookings/{booking}/status', [BookingController::class, 'updateStatus'])->middleware('permission:bookings.update');
    Route::post('/bookings/{booking}/convert-to-rental', [BookingController::class, 'convertToRental'])->middleware('permission:bookings.update,rentals.create');

    Route::get('/purchases', [PurchaseController::class, 'index'])->middleware('permission:purchases.view');
    Route::post('/purchases', [PurchaseController::class, 'store'])->middleware('permission:purchases.create');
    Route::get('/purchases/{purchase}', [PurchaseController::class, 'show'])->middleware('permission:purchases.view');
    Route::put('/purchases/{purchase}', [PurchaseController::class, 'update'])->middleware('permission:purchases.edit');
    Route::post('/purchases/{purchase}/cancel', [PurchaseController::class, 'cancel'])->middleware('permission:purchases.edit');

    Route::get('/vehicles', [VehicleController::class, 'index'])->middleware('permission:vehicles.view');
    Route::post('/vehicles', [VehicleController::class, 'store'])->middleware('permission:vehicles.create');
    Route::get('/vehicles/{vehicle}', [VehicleController::class, 'show'])->middleware('permission:vehicles.view');
    Route::put('/vehicles/{vehicle}', [VehicleController::class, 'update'])->middleware('permission:vehicles.update');
    Route::patch('/vehicles/{vehicle}', [VehicleController::class, 'update'])->middleware('permission:vehicles.update');
    Route::delete('/vehicles/{vehicle}', [VehicleController::class, 'destroy'])->middleware('permission:vehicles.delete');
    Route::get('/vehicles/{vehicle}/photo', [VehicleController::class, 'showPhoto'])->middleware('permission:vehicles.view');
    Route::post('/vehicles/{vehicle}/photo', [VehicleController::class, 'uploadPhoto'])->middleware('permission:vehicles.create,vehicles.update');
    Route::delete('/vehicles/{vehicle}/photo', [VehicleController::class, 'destroyPhoto'])->middleware('permission:vehicles.update');

    Route::get('/vehicle-rentals', [VehicleRentalController::class, 'index'])->middleware('permission:vehicles.view');
    Route::post('/vehicle-rentals', [VehicleRentalController::class, 'store'])->middleware('permission:vehicles.rentals');
    Route::get('/vehicle-rentals/{vehicleRental}', [VehicleRentalController::class, 'show'])->middleware('permission:vehicles.view');
    Route::put('/vehicle-rentals/{vehicleRental}', [VehicleRentalController::class, 'update'])->middleware('permission:vehicles.rentals');
    Route::patch('/vehicle-rentals/{vehicleRental}', [VehicleRentalController::class, 'update'])->middleware('permission:vehicles.rentals');
    Route::delete('/vehicle-rentals/{vehicleRental}', [VehicleRentalController::class, 'destroy'])->middleware('permission:vehicles.delete');

    Route::get('/vehicle-maintenance', [VehicleMaintenanceController::class, 'index'])->middleware('permission:vehicles.view');
    Route::post('/vehicle-maintenance', [VehicleMaintenanceController::class, 'store'])->middleware('permission:vehicles.maintenance');
    Route::get('/vehicle-maintenance/{vehicleMaintenance}', [VehicleMaintenanceController::class, 'show'])->middleware('permission:vehicles.view');
    Route::put('/vehicle-maintenance/{vehicleMaintenance}', [VehicleMaintenanceController::class, 'update'])->middleware('permission:vehicles.maintenance');
    Route::patch('/vehicle-maintenance/{vehicleMaintenance}', [VehicleMaintenanceController::class, 'update'])->middleware('permission:vehicles.maintenance');
    Route::delete('/vehicle-maintenance/{vehicleMaintenance}', [VehicleMaintenanceController::class, 'destroy'])->middleware('permission:vehicles.maintenance');
    Route::get('/vehicle-maintenance/{vehicleMaintenance}/receipt', [VehicleMaintenanceController::class, 'showReceipt'])->middleware('permission:vehicles.view');
    Route::post('/vehicle-maintenance/{vehicleMaintenance}/receipt', [VehicleMaintenanceController::class, 'uploadReceipt'])->middleware('permission:vehicles.maintenance');
    Route::delete('/vehicle-maintenance/{vehicleMaintenance}/receipt', [VehicleMaintenanceController::class, 'destroyReceipt'])->middleware('permission:vehicles.maintenance');

    Route::get('/staff', [StaffController::class, 'index'])->middleware('permission:staff.view');
    Route::get('/staff/summary', [StaffController::class, 'summary'])->middleware('permission:staff.view');
    Route::post('/staff', [StaffController::class, 'store'])->middleware('permission:staff.create');
    Route::get('/staff/{staff}', [StaffController::class, 'show'])->middleware('permission:staff.view');
    Route::put('/staff/{staff}', [StaffController::class, 'update'])->middleware('permission:staff.update');
    Route::patch('/staff/{staff}', [StaffController::class, 'update'])->middleware('permission:staff.update');
    Route::delete('/staff/{staff}', [StaffController::class, 'destroy'])->middleware('permission:staff.delete');
    Route::get('/staff/{staff}/photo', [StaffController::class, 'showPhoto'])->middleware('permission:staff.view');
    Route::post('/staff/{staff}/photo', [StaffController::class, 'uploadPhoto'])->middleware('permission:staff.create,staff.update');
    Route::delete('/staff/{staff}/photo', [StaffController::class, 'destroyPhoto'])->middleware('permission:staff.update');
    Route::get('/staff/{staff}/assignments', [StaffAssignmentController::class, 'index'])->middleware('permission:staff.view');
    Route::post('/staff/{staff}/assignments', [StaffAssignmentController::class, 'store'])->middleware('permission:staff.update');
    Route::delete('/staff-assignments/{staffAssignment}', [StaffAssignmentController::class, 'destroy'])->middleware('permission:staff.update');

    Route::get('/staff-roles', [StaffRoleController::class, 'index'])->middleware('permission:staff.view,staff.roles,staff.create,staff.update');
    Route::post('/staff-roles', [StaffRoleController::class, 'store'])->middleware('permission:staff.roles');
    Route::put('/staff-roles/{staffRole}', [StaffRoleController::class, 'update'])->middleware('permission:staff.roles');
    Route::patch('/staff-roles/{staffRole}', [StaffRoleController::class, 'update'])->middleware('permission:staff.roles');
    Route::delete('/staff-roles/{staffRole}', [StaffRoleController::class, 'destroy'])->middleware('permission:staff.roles');

    Route::get('/attendance', [AttendanceController::class, 'index'])->middleware('permission:staff.attendance,staff.view');
    Route::get('/attendance/summary', [AttendanceController::class, 'summary'])->middleware('permission:staff.attendance,staff.view');
    Route::post('/attendance', [AttendanceController::class, 'store'])->middleware('permission:staff.attendance');
    Route::post('/attendance/bulk', [AttendanceController::class, 'bulk'])->middleware('permission:staff.attendance');

    Route::get('/income', [IncomeController::class, 'index'])->middleware('permission:income.view');
    Route::post('/income', [IncomeController::class, 'store'])->middleware('permission:income.create');
    Route::get('/income/{income}', [IncomeController::class, 'show'])->middleware('permission:income.view');
    Route::put('/income/{income}', [IncomeController::class, 'update'])->middleware('permission:income.update');
    Route::patch('/income/{income}', [IncomeController::class, 'update'])->middleware('permission:income.update');
    Route::delete('/income/{income}', [IncomeController::class, 'destroy'])->middleware('permission:income.delete');
    Route::get('/income/{income}/payments', [IncomeController::class, 'paymentsIndex'])->middleware('permission:income.view,payments.manage');
    Route::post('/income/{income}/payments', [IncomeController::class, 'paymentsStore'])->middleware('permission:payments.manage,income.update');
    Route::put('/income/{income}/payments/{payment}', [IncomeController::class, 'paymentsUpdate'])->middleware('permission:payments.manage,income.update');
    Route::patch('/income/{income}/payments/{payment}', [IncomeController::class, 'paymentsUpdate'])->middleware('permission:payments.manage,income.update');
    Route::delete('/income/{income}/payments/{payment}', [IncomeController::class, 'paymentsDestroy'])->middleware('permission:payments.manage,income.update');

    Route::get('/expenses', [ExpenseController::class, 'index'])->middleware('permission:expenses.view');
    Route::post('/expenses', [ExpenseController::class, 'store'])->middleware('permission:expenses.create');
    Route::get('/expenses/{expense}', [ExpenseController::class, 'show'])->middleware('permission:expenses.view');
    Route::put('/expenses/{expense}', [ExpenseController::class, 'update'])->middleware('permission:expenses.update');
    Route::patch('/expenses/{expense}', [ExpenseController::class, 'update'])->middleware('permission:expenses.update');
    Route::delete('/expenses/{expense}', [ExpenseController::class, 'destroy'])->middleware('permission:expenses.delete');
    Route::get('/expenses/{expense}/payments', [ExpenseController::class, 'paymentsIndex'])->middleware('permission:expenses.view,payments.manage');
    Route::post('/expenses/{expense}/payments', [ExpenseController::class, 'paymentsStore'])->middleware('permission:payments.manage,expenses.update');
    Route::put('/expenses/{expense}/payments/{payment}', [ExpenseController::class, 'paymentsUpdate'])->middleware('permission:payments.manage,expenses.update');
    Route::patch('/expenses/{expense}/payments/{payment}', [ExpenseController::class, 'paymentsUpdate'])->middleware('permission:payments.manage,expenses.update');
    Route::delete('/expenses/{expense}/payments/{payment}', [ExpenseController::class, 'paymentsDestroy'])->middleware('permission:payments.manage,expenses.update');

    Route::get('/cheques', [ChequeController::class, 'index'])->middleware('permission:cheques.view');
    Route::get('/cheques/summary', [ChequeController::class, 'summary'])->middleware('permission:cheques.view');
    Route::get('/cheques/link-options', [ChequeController::class, 'linkOptions'])->middleware('permission:cheques.create,cheques.update');
    Route::post('/cheques', [ChequeController::class, 'store'])->middleware('permission:cheques.create');
    Route::get('/cheques/{cheque}', [ChequeController::class, 'show'])->middleware('permission:cheques.view');
    Route::put('/cheques/{cheque}', [ChequeController::class, 'update'])->middleware('permission:cheques.update');
    Route::patch('/cheques/{cheque}', [ChequeController::class, 'update'])->middleware('permission:cheques.update');
    Route::patch('/cheques/{cheque}/status', [ChequeController::class, 'updateStatus'])->middleware('permission:cheques.update');
    Route::delete('/cheques/{cheque}', [ChequeController::class, 'destroy'])->middleware('permission:cheques.delete');
    Route::get('/reports/cheques', [ChequeController::class, 'report'])
        ->middleware(['permission:reports.view', 'permission:cheques.view', 'throttle:reports']);

    Route::get('/checks', [CheckController::class, 'index'])->middleware('permission:checks.view');
    Route::post('/checks', [CheckController::class, 'store'])->middleware('permission:checks.manage');
    Route::get('/checks/{check}', [CheckController::class, 'show'])->middleware('permission:checks.view');
    Route::put('/checks/{check}', [CheckController::class, 'update'])->middleware('permission:checks.manage');
    Route::patch('/checks/{check}', [CheckController::class, 'update'])->middleware('permission:checks.manage');
    Route::post('/checks/{check}/complete', [CheckController::class, 'complete'])->middleware('permission:checks.manage');
    Route::delete('/checks/{check}', [CheckController::class, 'destroy'])->middleware('permission:checks.manage');

    Route::get('/maintenance', [MaintenanceController::class, 'index'])->middleware('permission:maintenance.view');
    Route::post('/maintenance', [MaintenanceController::class, 'store'])->middleware('permission:maintenance.manage');
    Route::get('/maintenance/{maintenance}', [MaintenanceController::class, 'show'])->middleware('permission:maintenance.view');
    Route::put('/maintenance/{maintenance}', [MaintenanceController::class, 'update'])->middleware('permission:maintenance.manage');
    Route::patch('/maintenance/{maintenance}', [MaintenanceController::class, 'update'])->middleware('permission:maintenance.manage');
    Route::post('/maintenance/{maintenance}/complete', [MaintenanceController::class, 'complete'])->middleware('permission:maintenance.manage');
    Route::post('/maintenance/{maintenance}/cancel', [MaintenanceController::class, 'cancel'])->middleware('permission:maintenance.manage');
    Route::delete('/maintenance/{maintenance}', [MaintenanceController::class, 'destroy'])->middleware('permission:maintenance.manage');

    Route::get('/reminders', [ReminderController::class, 'index'])->middleware('permission:reminders.view,checks.view,notifications.view');
    Route::post('/reminders', [ReminderController::class, 'store'])->middleware('permission:reminders.manage,checks.manage,notifications.manage');
    Route::get('/reminders/{reminder}', [ReminderController::class, 'show'])->middleware('permission:reminders.view,checks.view,notifications.view');
    Route::put('/reminders/{reminder}', [ReminderController::class, 'update'])->middleware('permission:reminders.manage,checks.manage,notifications.manage');
    Route::patch('/reminders/{reminder}', [ReminderController::class, 'update'])->middleware('permission:reminders.manage,checks.manage,notifications.manage');
    Route::post('/reminders/{reminder}/complete', [ReminderController::class, 'complete'])->middleware('permission:reminders.manage,checks.manage,notifications.manage');
    Route::post('/reminders/{reminder}/dismiss', [ReminderController::class, 'dismiss'])->middleware('permission:reminders.manage,checks.manage,notifications.manage');
    Route::delete('/reminders/{reminder}', [ReminderController::class, 'destroy'])->middleware('permission:reminders.manage,checks.manage,notifications.manage');

    Route::get('/notifications', [NotificationController::class, 'index'])->middleware('permission:notifications.view');
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount'])->middleware('permission:notifications.view');
    Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllAsRead'])->middleware('permission:notifications.view');
    Route::put('/notifications/mark-all-read', [NotificationController::class, 'markAllAsRead'])->middleware('permission:notifications.view');
    Route::put('/notifications/read-all', [NotificationController::class, 'markAllAsRead'])->middleware('permission:notifications.view');
    Route::post('/notifications/generate', [NotificationController::class, 'generate'])->middleware('permission:notifications.manage');
    Route::post('/notifications', [NotificationController::class, 'store'])->middleware('permission:notifications.manage');
    Route::get('/notifications/{notification}', [NotificationController::class, 'show'])->middleware('permission:notifications.view');
    Route::put('/notifications/{notification}', [NotificationController::class, 'update'])->middleware('permission:notifications.manage');
    Route::patch('/notifications/{notification}', [NotificationController::class, 'update'])->middleware('permission:notifications.manage');
    Route::delete('/notifications/{notification}', [NotificationController::class, 'destroy'])->middleware('permission:notifications.manage');
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markAsRead'])->middleware('permission:notifications.view');
    Route::put('/notifications/{notification}/read', [NotificationController::class, 'markAsRead'])->middleware('permission:notifications.view');
    Route::post('/notifications/{notification}/dismiss', [NotificationController::class, 'dismiss'])->middleware('permission:notifications.view');

    Route::middleware('permission:reports.view')->middleware('throttle:reports')->group(function () {
        Route::get('/reports/dashboard', [ReportController::class, 'dashboard']);
        Route::get('/reports/summary', [ReportController::class, 'summary']);
        Route::get('/reports/sales', [ReportController::class, 'sales']);
        Route::get('/reports/rentals', [ReportController::class, 'rentals']);
        Route::get('/reports/inventory', [ReportController::class, 'inventory']);
        Route::get('/reports/inventory/usage', [ReportController::class, 'inventoryUsage']);
        Route::get('/reports/equipment', [ReportController::class, 'equipment']);
        Route::get('/reports/financial', [ReportController::class, 'financial'])->middleware('permission:income.view,expenses.view');
        Route::post('/reports/export', [ReportController::class, 'authorizeExport'])->middleware('permission:reports.export');
        Route::get('/reports/customers', [ReportController::class, 'customers']);
        Route::get('/reports/customers/{customerId}', [ReportController::class, 'customerDetails']);
    });

    Route::get('/settings', [SettingController::class, 'show']);
    Route::put('/settings', [SettingController::class, 'update'])->middleware('permission:settings.manage');
    Route::post('/settings/logo', [SettingController::class, 'uploadLogo'])->middleware('permission:settings.manage');
    Route::delete('/settings/logo', [SettingController::class, 'removeLogo'])->middleware('permission:settings.manage');

    Route::prefix('admin')->middleware('admin')->group(function () {
        Route::get('/users', [AdminUserController::class, 'index']);
        Route::get('/users/options', [AdminUserController::class, 'options']);
        Route::post('/users', [AdminUserController::class, 'store']);
        Route::put('/users/{user}', [AdminUserController::class, 'update']);
        Route::patch('/users/{user}', [AdminUserController::class, 'update']);
        Route::post('/users/{user}/reset-password', [AdminUserController::class, 'resetPassword']);
        Route::patch('/users/{user}/status', [AdminUserController::class, 'updateStatus']);
        Route::delete('/users/{user}', [AdminUserController::class, 'destroy']);

        Route::get('/roles', [AdminRoleController::class, 'index']);
        Route::get('/permissions', [AdminRoleController::class, 'permissions']);
        Route::post('/roles', [AdminRoleController::class, 'store']);
        Route::put('/roles/{role}', [AdminRoleController::class, 'update']);
        Route::patch('/roles/{role}', [AdminRoleController::class, 'update']);
        Route::delete('/roles/{role}', [AdminRoleController::class, 'destroy']);

        Route::get('/activity-logs', [ActivityLogController::class, 'index']);

        Route::get('/branches', [BranchController::class, 'index']);
        Route::post('/branches', [BranchController::class, 'store']);
        Route::put('/branches/{branch}', [BranchController::class, 'update']);
        Route::delete('/branches/{branch}', [BranchController::class, 'destroy']);

        Route::get('/sms-gateway', [SmsGatewayController::class, 'show']);
        Route::put('/sms-gateway', [SmsGatewayController::class, 'update']);
        Route::post('/sms-gateway/test', [SmsGatewayController::class, 'test'])->middleware('throttle:10,1');
    });

    Route::get('/activity-logs', [ActivityLogController::class, 'index'])->middleware('permission:activity.view');
    Route::get('/audit-logs', [AuditLogController::class, 'index'])->middleware('permission:audit.view');
    Route::get('/audit-logs/{auditLog}', [AuditLogController::class, 'show'])->middleware('permission:audit.view');
});
