import {
  EQUIPMENT_EXPENSE_CATEGORIES,
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_STATUSES,
  EXPENSE_SUMMARY_CATEGORIES,
  OPERATING_EXPENSE_CATEGORIES,
} from '../data/expensesData'
import { formatCurrency } from './helpers'
import {
  calcRemainingAmount,
  deriveFinancialPaymentStatus,
  getTodayISO,
} from './financialHelpers'

export {
  EQUIPMENT_EXPENSE_CATEGORIES,
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_STATUSES,
  EXPENSE_SUMMARY_CATEGORIES,
  OPERATING_EXPENSE_CATEGORIES,
}

export { getTodayISO }

export const deriveExpensePaymentStatus = deriveFinancialPaymentStatus

export const calcRemaining = calcRemainingAmount

export const generateExpenseId = (records = []) => {
  const maxNum = records.reduce((max, r) => {
    const match = String(r.expenseId || '').match(/EXP-(\d+)/)
    return match ? Math.max(max, parseInt(match[1], 10)) : max
  }, 0)
  return `EXP-${String(maxNum + 1).padStart(3, '0')}`
}

export const getExpenseStats = (records = [], today = new Date()) => {
  const todayISO = getTodayISO(today)
  const monthPrefix = todayISO.slice(0, 7)

  const total = records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const todayExpenses = records
    .filter((r) => r.date === todayISO)
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const monthExpenses = records
    .filter((r) => (r.date || '').startsWith(monthPrefix))
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const equipmentExpenses = records
    .filter((r) => EQUIPMENT_EXPENSE_CATEGORIES.includes(r.category))
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const operatingExpenses = records
    .filter((r) => OPERATING_EXPENSE_CATEGORIES.includes(r.category))
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const pendingExpenses = records
    .filter((r) => ['Pending', 'Partial', 'Overdue'].includes(r.paymentStatus))
    .reduce(
      (sum, r) => sum + (Number(r.remainingAmount) || calcRemaining(r.amount, r.paidAmount)),
      0
    )
  const paidExpenses = records
    .filter((r) => r.paymentStatus === 'Paid')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const outstandingExpenses = records.reduce(
    (sum, r) => sum + (Number(r.remainingAmount) || calcRemaining(r.amount, r.paidAmount)),
    0
  )

  return {
    total,
    todayExpenses,
    monthExpenses,
    equipmentExpenses,
    operatingExpenses,
    pendingExpenses,
    paidExpenses,
    outstandingExpenses,
  }
}

export const getCategorySummary = (records = []) => {
  const total = records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0) || 1

  const namedCategories = EXPENSE_SUMMARY_CATEGORIES.filter((c) => c !== 'Other')

  const bucketAmount = (label) => {
    if (label === 'Other') {
      return records
        .filter((r) => !namedCategories.includes(r.category))
        .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
    }
    return records
      .filter((r) => r.category === label)
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  }

  return EXPENSE_SUMMARY_CATEGORIES.map((category) => {
    const amount = bucketAmount(category)
    return {
      category,
      amount,
      percentage: Math.round((amount / total) * 1000) / 10,
    }
  }).filter((row) => row.amount > 0)
}

export const expensesByCategoryChart = (records = []) =>
  getCategorySummary(records).map((row) => ({
    name: row.category,
    value: row.amount,
    percentage: row.percentage,
  }))

export const emptyExpenseForm = () => ({
  date: getTodayISO(),
  category: 'Maintenance',
  supplierId: '',
  supplier: '',
  reference: '',
  description: '',
  amount: '',
  productId: '',
  product: '',
  maintenanceId: '',
  maintenanceLabel: '',
  paidAmount: '',
  paymentMethod: 'Cash',
  paymentStatus: 'Pending',
  dueDate: '',
  notes: '',
  branchId: '',
})

export const expenseToForm = (record) => ({
  date: record.date || getTodayISO(),
  category: record.category || 'Other Expense',
  supplierId: record.supplierId ? String(record.supplierId) : '',
  supplier: record.supplier || '',
  reference: record.reference || record.receipt || '',
  description: record.description || '',
  amount: record.amount ?? '',
  productId: record.productId ? String(record.productId) : '',
  product: record.product || record.related || '',
  maintenanceId: record.maintenanceId ? String(record.maintenanceId) : '',
  maintenanceLabel: record.maintenanceLabel || '',
  paidAmount: record.paidAmount ?? '',
  paymentMethod: record.paymentMethod || 'Cash',
  paymentStatus: record.paymentStatus || 'Pending',
  dueDate: record.dueDate || '',
  notes: record.notes || '',
  branchId: record.branchId != null ? String(record.branchId) : '',
})

export const validateExpenseForm = (form) => {
  const errors = {}
  if (!form.date) errors.date = 'Date is required'
  if (!form.category) errors.category = 'Category is required'
  if (!form.supplier?.trim() && !form.supplierId) {
    errors.supplier = 'Supplier / payee is required'
  }
  if (!form.description?.trim()) errors.description = 'Description is required'
  if (Number(form.amount) <= 0) errors.amount = 'Amount must be greater than 0'
  if (Number(form.paidAmount) < 0) errors.paidAmount = 'Paid amount cannot be negative'
  if (Number(form.paidAmount) > Number(form.amount)) {
    errors.paidAmount = 'Paid amount cannot exceed the total expense.'
  }
  if (!form.paymentMethod) errors.paymentMethod = 'Payment method is required'
  return errors
}

export const normalizeExpensePayload = (form, expenseId, existing = null) => {
  const amount = Number(form.amount) || 0
  const paidAmount = Number(form.paidAmount) || 0
  const remainingAmount = calcRemaining(amount, paidAmount)
  const paymentStatus = deriveExpensePaymentStatus({
    amount,
    paidAmount,
    dueDate: form.dueDate || null,
  })
  const product = form.product || ''
  const reference = form.reference || ''

  return {
    expenseId,
    date: form.date,
    category: form.category,
    supplierId: form.supplierId ? Number(form.supplierId) : null,
    supplier: form.supplier,
    productId: form.productId ? Number(form.productId) : null,
    product,
    maintenanceId: form.maintenanceId ? Number(form.maintenanceId) : null,
    maintenanceLabel: form.maintenanceLabel || '',
    reference,
    description: form.description.trim(),
    amount,
    paidAmount,
    remainingAmount,
    paymentMethod: form.paymentMethod,
    paymentStatus,
    dueDate: form.dueDate || null,
    notes: form.notes || '',
    branchId: form.branchId || null,
    related: product,
    receipt: reference,
  }
}

export const filterExpenses = (records, filters) => {
  const q = (filters.search || '').trim().toLowerCase()
  return records.filter((r) => {
    if (q) {
      const hay =
        `${r.expenseId} ${r.supplier} ${r.reference} ${r.description} ${r.category} ${r.product}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (filters.dateFrom && r.date < filters.dateFrom) return false
    if (filters.dateTo && r.date > filters.dateTo) return false
    if (filters.category && r.category !== filters.category) return false
    if (filters.supplier && r.supplier !== filters.supplier) return false
    if (filters.paymentMethod && r.paymentMethod !== filters.paymentMethod) return false
    if (filters.paymentStatus && r.paymentStatus !== filters.paymentStatus) return false
    if (filters.product && r.product !== filters.product) return false
    return true
  })
}

export const sortExpenses = (records, sortBy, sortDir = 'desc') => {
  const dir = sortDir === 'asc' ? 1 : -1
  const sorted = [...records]
  sorted.sort((a, b) => {
    let av
    let bv
    switch (sortBy) {
      case 'amount':
        av = Number(a.amount) || 0
        bv = Number(b.amount) || 0
        break
      case 'category':
        av = a.category || ''
        bv = b.category || ''
        break
      case 'supplier':
        av = a.supplier || ''
        bv = b.supplier || ''
        break
      case 'paymentStatus':
        av = a.paymentStatus || ''
        bv = b.paymentStatus || ''
        break
      case 'date':
      default:
        av = a.date || ''
        bv = b.date || ''
        break
    }
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return 0
  })
  return sorted
}

export const defaultExpenseFilters = () => ({
  search: '',
  dateFrom: '',
  dateTo: '',
  category: '',
  supplier: '',
  paymentMethod: '',
  paymentStatus: '',
  product: '',
})

export const formatExpenseAmount = (value) => formatCurrency(value)
