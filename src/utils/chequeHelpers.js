export const CHEQUE_STATUSES = ['Pending', 'Deposited', 'Cleared', 'Bounced']

export const CHEQUE_TYPES = [
  { value: 'received', label: 'Received' },
  { value: 'issued', label: 'Issued' },
]

export const CHEQUE_REFERENCE_TYPES = [
  { value: 'sale', label: 'Invoice / Sale' },
  { value: 'rental', label: 'Rental' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'purchase', label: 'Purchase' },
]

export const chequeTypeLabel = (type) => (type === 'issued' ? 'Issued' : 'Received')

export const emptyChequeForm = () => ({
  chequeNumber: '',
  bank: '',
  amount: '',
  chequeDate: new Date().toISOString().slice(0, 10),
  type: 'received',
  customerId: '',
  supplierId: '',
  status: 'Pending',
  notes: '',
  referenceType: '',
  referenceId: '',
  referenceLabel: '',
})

export function mapChequeFromApi(row) {
  if (!row) return null
  return {
    id: row.id,
    chequeNumber: row.cheque_number || '',
    bank: row.bank || '',
    amount: Number(row.amount || 0),
    chequeDate: row.cheque_date || '',
    type: row.type || 'received',
    customerId: row.customer_id ?? '',
    customerName: row.customer_name || '',
    supplierId: row.supplier_id ?? '',
    supplierName: row.supplier_name || '',
    partyName: row.party_name || '',
    status: row.status || 'Pending',
    statusChangedAt: row.status_changed_at || null,
    notes: row.notes || '',
    referenceType: row.reference_type || '',
    referenceId: row.reference_id ?? '',
    referenceLabel: row.reference_label || '',
    referenceUrl: row.reference_url || '',
    paymentType: row.payment_type || '',
    paymentId: row.payment_id ?? null,
    isOverdue: Boolean(row.is_overdue),
    daysUntil: row.days_until ?? null,
    createdByName: row.created_by_name || '',
    createdAt: row.created_at || null,
  }
}

export function mapChequeToApi(form) {
  const isIssued = form.type === 'issued'
  return {
    cheque_number: form.chequeNumber.trim(),
    bank: form.bank.trim(),
    amount: Number(form.amount),
    cheque_date: form.chequeDate,
    type: form.type,
    customer_id: !isIssued && form.customerId ? Number(form.customerId) : null,
    supplier_id: isIssued && form.supplierId ? Number(form.supplierId) : null,
    status: form.status,
    notes: form.notes.trim() || null,
    reference_type: form.referenceType || null,
    reference_id: form.referenceType && form.referenceId ? Number(form.referenceId) : null,
  }
}

const API_FIELD = {
  cheque_number: 'chequeNumber',
  cheque_date: 'chequeDate',
  customer_id: 'customerId',
  supplier_id: 'supplierId',
  reference_type: 'referenceType',
  reference_id: 'referenceId',
}

/** Maps server validation keys (snake_case) onto form field names. */
export const mapChequeErrors = (errors = {}) =>
  Object.fromEntries(Object.entries(errors).map(([key, message]) => [API_FIELD[key] || key, message]))

export function validateChequeForm(form) {
  const errors = {}
  if (!form.chequeNumber.trim()) errors.chequeNumber = 'Please enter the cheque number.'
  else if (form.chequeNumber.trim().length > 50) errors.chequeNumber = 'Cheque number may not be longer than 50 characters.'
  if (!form.bank.trim()) errors.bank = 'Please enter the bank name.'
  const amount = Number(form.amount)
  if (form.amount === '' || Number.isNaN(amount)) errors.amount = 'Please enter the cheque amount.'
  else if (amount <= 0) errors.amount = 'The cheque amount must be greater than zero.'
  if (!form.chequeDate) errors.chequeDate = 'Please enter the cheque date.'
  if (form.referenceType && !form.referenceId) errors.referenceId = 'Please choose the record to link this cheque to.'
  return errors
}

/** "in 3 days", "today", "2 days overdue" for pending cheques. */
export function chequeDueText(cheque) {
  if (!cheque || cheque.status !== 'Pending' || cheque.daysUntil === null) return ''
  const d = cheque.daysUntil
  if (d === 0) return 'Due today'
  if (d === 1) return 'Due tomorrow'
  if (d > 1) return `Due in ${d} days`
  return `${Math.abs(d)} day${d === -1 ? '' : 's'} overdue`
}
