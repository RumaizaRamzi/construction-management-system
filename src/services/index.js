/**
 * Service layer for Laravel REST API integration.
 * Live APIs: Products, Categories, Suppliers, Customers, Sales, Rentals, Bookings,
 * Income, Expenses, Notifications, Checks, Maintenance, Reminders.
 */
import api from './api'
import categoryService from './categoryService'
import customerService from './customerService'
import productService from './productService'
import supplierService from './supplierService'
import checkService from './checkService'
import maintenanceService from './maintenanceService'
import reminderService from './reminderService'

export { categoryService, customerService, productService, supplierService }
export { default as saleService } from './saleService'
export { default as stockMovementService } from './stockMovementService'
export { default as rentalService } from './rentalService'
export { default as bookingService } from './bookingService'
export { default as calendarService } from './calendarService'
export { default as incomeService } from './incomeService'
export { default as expenseService } from './expenseService'
export { default as notificationService } from './notificationService'
export { default as reportService } from './reportService'
export { default as authService } from './authService'
export { checkService, maintenanceService, reminderService }
export { default as searchService } from './searchService'

export const settingsService = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
}
