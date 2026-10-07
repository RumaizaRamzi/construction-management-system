import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from '../components/layouts/MainLayout'
import ProtectedRoute from './ProtectedRoute'
import RequirePermission from '../components/auth/RequirePermission'
import RequireAdmin from '../components/auth/RequireAdmin'
import LoadingState from '../components/ui/LoadingState'

const Login = lazy(() => import('../pages/auth/Login'))
const Dashboard = lazy(() => import('../pages/dashboard/Dashboard'))
const Products = lazy(() => import('../pages/products/Products'))
const ProductDetails = lazy(() => import('../pages/products/ProductDetails'))
const ProductUsageDetails = lazy(() => import('../pages/products/ProductUsageDetails'))
const Categories = lazy(() => import('../pages/categories/Categories'))
const StockHistory = lazy(() => import('../pages/stock/StockHistory'))
const ProductStockHistory = lazy(() => import('../pages/stock/ProductStockHistory'))
const Purchases = lazy(() => import('../pages/purchases/Purchases'))
const PurchaseFormPage = lazy(() => import('../pages/purchases/PurchaseFormPage'))
const PurchaseDetails = lazy(() => import('../pages/purchases/PurchaseDetails'))
const Sales = lazy(() => import('../pages/sales/Sales'))
const SaleFormPage = lazy(() => import('../pages/sales/SaleFormPage'))
const SaleDetails = lazy(() => import('../pages/sales/SaleDetails'))
const SaleInvoice = lazy(() => import('../pages/sales/SaleInvoice'))
const Invoice = lazy(() => import('../pages/invoices/Invoice'))
const Rentals = lazy(() => import('../pages/rentals/Rentals'))
const RentalFormPage = lazy(() => import('../pages/rentals/RentalFormPage'))
const RentalDetails = lazy(() => import('../pages/rentals/RentalDetails'))
const RentalReturn = lazy(() => import('../pages/rentals/RentalReturn'))
const RentalAgreementPage = lazy(() => import('../pages/rentals/RentalAgreementPage'))
const Bookings = lazy(() => import('../pages/bookings/Bookings'))
const Returns = lazy(() => import('../pages/returns/Returns'))
const Customers = lazy(() => import('../pages/customers/Customers'))
const CustomerDetails = lazy(() => import('../pages/customers/CustomerDetails'))
const Suppliers = lazy(() => import('../pages/suppliers/Suppliers'))
const SupplierDetails = lazy(() => import('../pages/suppliers/SupplierDetails'))
const Income = lazy(() => import('../pages/income/Income'))
const IncomeDetails = lazy(() => import('../pages/income/IncomeDetails'))
const Cheques = lazy(() => import('../pages/cheques/Cheques'))
const ChequeFormPage = lazy(() => import('../pages/cheques/ChequeFormPage'))
const ChequeReports = lazy(() => import('../pages/reports/ChequeReports'))
const Expenses = lazy(() => import('../pages/expenses/Expenses'))
const ExpenseDetails = lazy(() => import('../pages/expenses/ExpenseDetails'))
const Checks = lazy(() => import('../pages/checks/Checks'))
const CheckDetails = lazy(() => import('../pages/checks/CheckDetails'))
const Maintenance = lazy(() => import('../pages/maintenance/Maintenance'))
const MaintenanceDetails = lazy(() => import('../pages/maintenance/MaintenanceDetails'))
const Vehicles = lazy(() => import('../pages/vehicles/Vehicles'))
const VehicleDetails = lazy(() => import('../pages/vehicles/VehicleDetails'))
const VehicleRentals = lazy(() => import('../pages/vehicles/VehicleRentals'))
const VehicleMaintenance = lazy(() => import('../pages/vehicles/VehicleMaintenance'))
const Staff = lazy(() => import('../pages/staff/Staff'))
const StaffFormPage = lazy(() => import('../pages/staff/StaffFormPage'))
const StaffDetails = lazy(() => import('../pages/staff/StaffDetails'))
const Attendance = lazy(() => import('../pages/staff/Attendance'))
const Reminders = lazy(() => import('../pages/reminders/Reminders'))
const RecurringReminders = lazy(() => import('../pages/reminders/RecurringReminders'))
const CalendarPage = lazy(() => import('../pages/calendar/CalendarPage'))
const AvailabilityCalendarPage = lazy(() => import('../pages/calendar/AvailabilityCalendarPage'))
const Reports = lazy(() => import('../pages/reports/Reports'))
const SalesReports = lazy(() => import('../pages/reports/SalesReports'))
const RentalReports = lazy(() => import('../pages/reports/RentalReports'))
const InventoryReports = lazy(() => import('../pages/reports/InventoryReports'))
const ProductUsageReport = lazy(() => import('../pages/reports/ProductUsageReport'))
const EquipmentReports = lazy(() => import('../pages/reports/EquipmentReports'))
const FinancialReports = lazy(() => import('../pages/reports/FinancialReports'))
const CustomerReports = lazy(() => import('../pages/reports/CustomerReports'))
const CustomerTransactionReport = lazy(() => import('../pages/reports/CustomerTransactionReport'))
const Notifications = lazy(() => import('../pages/notifications/Notifications'))
const Settings = lazy(() => import('../pages/settings/Settings'))
const NotificationSettingsPage = lazy(() => import('../pages/settings/NotificationSettingsPage'))
const AdminUsers = lazy(() => import('../pages/admin/AdminUsers'))
const AdminRoles = lazy(() => import('../pages/admin/AdminRoles'))
const AdminSettings = lazy(() => import('../pages/admin/AdminSettings'))
const ActivityHistory = lazy(() => import('../pages/history/ActivityHistory'))
const AuditLogs = lazy(() => import('../pages/history/AuditLogs'))
const NotFound = lazy(() => import('../pages/system/NotFound'))
const Forbidden = lazy(() => import('../pages/system/Forbidden'))

function PageFallback() {
  return <LoadingState label="Loading page…" />
}

function P({ any, children }) {
  return <RequirePermission any={any}>{children}</RequirePermission>
}

function A({ children }) {
  return <RequireAdmin>{children}</RequireAdmin>
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<P any={['products.view']}><Products /></P>} />
              <Route path="products/:id/usage" element={<P any={['products.view']}><ProductUsageDetails /></P>} />
              <Route path="products/:id" element={<P any={['products.view']}><ProductDetails /></P>} />
              <Route path="categories" element={<P any={['categories.view', 'products.view']}><Categories /></P>} />
              <Route path="stock-history" element={<P any={['products.view']}><StockHistory /></P>} />
              <Route path="stock-history/:id" element={<P any={['products.view']}><ProductStockHistory /></P>} />
              <Route path="purchases" element={<P any={['purchases.view']}><Purchases /></P>} />
              <Route path="purchases/new" element={<P any={['purchases.create']}><PurchaseFormPage /></P>} />
              <Route path="purchases/:id/edit" element={<P any={['purchases.edit']}><PurchaseFormPage /></P>} />
              <Route path="purchases/:id" element={<P any={['purchases.view']}><PurchaseDetails /></P>} />
              <Route path="sales" element={<P any={['sales.view']}><Sales /></P>} />
              <Route path="sales/new" element={<P any={['sales.create']}><SaleFormPage /></P>} />
              <Route path="sales/:id/edit" element={<P any={['sales.update']}><SaleFormPage /></P>} />
              <Route path="sales/:id/invoice" element={<P any={['sales.view']}><SaleInvoice /></P>} />
              <Route path="sales/:id" element={<P any={['sales.view']}><SaleDetails /></P>} />
              <Route path="invoices" element={<P any={['sales.view']}><Invoice /></P>} />
              <Route path="rentals" element={<P any={['rentals.view']}><Rentals /></P>} />
              <Route path="rentals/new" element={<P any={['rentals.create']}><RentalFormPage /></P>} />
              <Route path="rentals/:id/edit" element={<P any={['rentals.update']}><RentalFormPage /></P>} />
              <Route path="rentals/:id/return" element={<P any={['rentals.return']}><RentalReturn /></P>} />
              <Route path="rentals/:id/agreement" element={<P any={['rentals.view']}><RentalAgreementPage /></P>} />
              <Route path="rentals/:id" element={<P any={['rentals.view']}><RentalDetails /></P>} />
              <Route path="bookings" element={<P any={['bookings.view']}><Bookings /></P>} />
              <Route path="returns" element={<P any={['rentals.view', 'rentals.return']}><Returns /></P>} />
              <Route path="customers" element={<P any={['customers.view']}><Customers /></P>} />
              <Route path="customers/:id" element={<P any={['customers.view']}><CustomerDetails /></P>} />
              <Route path="suppliers" element={<P any={['suppliers.view']}><Suppliers /></P>} />
              <Route path="suppliers/:id" element={<P any={['suppliers.view']}><SupplierDetails /></P>} />
              <Route path="income" element={<P any={['income.view']}><Income /></P>} />
              <Route path="income/:id" element={<P any={['income.view']}><IncomeDetails /></P>} />
              <Route path="cheques" element={<P any={['cheques.view']}><Cheques /></P>} />
              <Route path="cheques/new" element={<P any={['cheques.create']}><ChequeFormPage /></P>} />
              <Route path="cheques/:id" element={<P any={['cheques.view']}><ChequeFormPage /></P>} />
              <Route path="expenses" element={<P any={['expenses.view']}><Expenses /></P>} />
              <Route path="expenses/:id" element={<P any={['expenses.view']}><ExpenseDetails /></P>} />
              <Route path="checks" element={<P any={['checks.view']}><Checks /></P>} />
              <Route path="checks/:id" element={<P any={['checks.view']}><CheckDetails /></P>} />
              <Route path="maintenance" element={<P any={['maintenance.view']}><Maintenance /></P>} />
              <Route path="maintenance/:id" element={<P any={['maintenance.view']}><MaintenanceDetails /></P>} />
              <Route path="vehicles" element={<P any={['vehicles.view']}><Vehicles /></P>} />
              <Route path="vehicles/new" element={<P any={['vehicles.create']}><Vehicles createMode /></P>} />
              <Route path="vehicles/details" element={<P any={['vehicles.view']}><VehicleDetails /></P>} />
              <Route path="vehicles/rentals" element={<P any={['vehicles.view']}><VehicleRentals /></P>} />
              <Route path="vehicles/maintenance" element={<P any={['vehicles.view']}><VehicleMaintenance /></P>} />
              <Route path="vehicles/:id" element={<P any={['vehicles.view']}><VehicleDetails /></P>} />
              <Route path="staff" element={<P any={['staff.view']}><Staff /></P>} />
              <Route path="staff/create" element={<P any={['staff.create']}><StaffFormPage /></P>} />
              <Route path="staff/attendance" element={<P any={['staff.attendance', 'staff.view']}><Attendance /></P>} />
              <Route path="staff/roles" element={<Navigate to="/admin/roles?tab=staff" replace />} />
              <Route path="staff/:id" element={<P any={['staff.view']}><StaffDetails /></P>} />
              <Route path="staff/:id/edit" element={<P any={['staff.update']}><StaffFormPage /></P>} />
              <Route path="reminders" element={<P any={['checks.view', 'notifications.view']}><Reminders /></P>} />
              <Route path="reminders/recurring" element={<P any={['checks.view', 'notifications.view']}><RecurringReminders /></P>} />
              <Route path="calendar" element={<P any={['bookings.view', 'rentals.view']}><CalendarPage /></P>} />
              <Route path="calendar/availability" element={<P any={['bookings.view', 'rentals.view']}><AvailabilityCalendarPage /></P>} />
              <Route path="reports" element={<P any={['reports.view']}><Reports /></P>} />
              <Route path="reports/sales" element={<P any={['reports.view']}><SalesReports /></P>} />
              <Route path="reports/rentals" element={<P any={['reports.view']}><RentalReports /></P>} />
              <Route path="reports/inventory" element={<P any={['reports.view']}><InventoryReports /></P>} />
              <Route path="reports/inventory/usage" element={<P any={['reports.view']}><ProductUsageReport /></P>} />
              <Route path="reports/equipment" element={<P any={['reports.view']}><EquipmentReports /></P>} />
              <Route path="reports/financial" element={<P any={['reports.view']}><P any={['income.view', 'expenses.view']}><FinancialReports /></P></P>} />
              <Route path="reports/customers" element={<P any={['reports.view']}><CustomerReports /></P>} />
              <Route path="reports/customers/:customerId" element={<P any={['reports.view']}><CustomerTransactionReport /></P>} />
              <Route path="reports/cheques" element={<P any={['reports.view']}><P any={['cheques.view']}><ChequeReports /></P></P>} />
              <Route path="notifications" element={<P any={['notifications.view']}><Notifications /></P>} />
              <Route path="activity" element={<P any={['activity.view']}><ActivityHistory /></P>} />
              <Route path="audit-logs" element={<P any={['audit.view']}><AuditLogs /></P>} />
              <Route path="users" element={<Navigate to="/admin/users" replace />} />
              <Route path="admin" element={<Navigate to="/admin/users" replace />} />
              <Route path="admin/users" element={<A><AdminUsers /></A>} />
              <Route path="admin/roles" element={<A><AdminRoles /></A>} />
              <Route path="admin/activity-logs" element={<A><ActivityHistory admin /></A>} />
              <Route path="admin/settings" element={<A><AdminSettings /></A>} />
              <Route path="settings" element={<Settings />} />
              <Route path="settings/notifications" element={<NotificationSettingsPage />} />
              <Route path="403" element={<Forbidden />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
