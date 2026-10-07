/**
 * Rental module option lists (statuses, payment methods).
 */

export const RENTAL_STATUSES = [
  'Pending',
  'Confirmed',
  'Active',
  'Returned',
  'Overdue',
  'Cancelled',
  'Maintenance',
]

export const RENTAL_PAYMENT_STATUSES = ['Paid', 'Partial', 'Pending', 'Overdue', 'Refunded']
export const RENTAL_PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Card', 'Online Payment', 'Cheque']
