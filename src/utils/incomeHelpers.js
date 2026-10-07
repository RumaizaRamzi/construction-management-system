import {
  INCOME_CATEGORIES,
  INCOME_PAYMENT_METHODS,
  INCOME_PAYMENT_STATUSES,
  INCOME_SOURCES,
} from '../data/incomeData'
import { formatCurrency } from './helpers'
import {
  calcRemainingAmount,
  deriveFinancialPaymentStatus,
  getTodayISO,
} from './financialHelpers'

export {
  INCOME_CATEGORIES,
  INCOME_PAYMENT_METHODS,
  INCOME_PAYMENT_STATUSES,
  INCOME_SOURCES,
}

export { getTodayISO }

export const derivePaymentStatus = deriveFinancialPaymentStatus

export const calcRemaining = calcRemainingAmount

export const generateIncomeId = (records = []) => {
  const maxNum = records.reduce((max, r) => {
    const match = String(r.incomeId || '').match(/INC-(\d+)/)
    return match ? Math.max(max, parseInt(match[1], 10)) : max
  }, 0)
  return `INC-${String(maxNum + 1).padStart(3, '0')}`
}

export const categoryForSource = (source) => {
  switch (source) {
    case 'Sale':
      return 'Product Sales'
    case 'Rental':
      return 'Equipment Rental'
    case 'Booking':
      return 'Booking Advance'
    default:
      return 'Other Income'
  }
}

export const legacyTypeForSource = (source) => (source === 'Sale' ? 'Sales' : source)

export const getIncomeStats = (records = [], today = new Date()) => {
  const todayISO = getTodayISO(today)
  const monthPrefix = todayISO.slice(0, 7)

  const total = records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const todayIncome = records
    .filter((r) => r.date === todayISO)
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const monthIncome = records
    .filter((r) => (r.date || '').startsWith(monthPrefix))
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const rentalIncome = records
    .filter((r) => r.source === 'Rental' || r.type === 'Rental')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const salesIncome = records
    .filter((r) => r.source === 'Sale' || r.type === 'Sales')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const bookingIncome = records
    .filter((r) => r.source === 'Booking')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const otherIncome = records
    .filter((r) => r.source === 'Other' || r.type === 'Other')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const pendingIncome = records
    .filter((r) => ['Pending', 'Partial', 'Overdue'].includes(r.paymentStatus))
    .reduce((sum, r) => sum + (Number(r.remainingAmount) || calcRemaining(r.amount, r.paidAmount)), 0)
  const paidIncome = records
    .filter((r) => r.paymentStatus === 'Paid')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)

  return {
    total,
    todayIncome,
    monthIncome,
    rentalIncome,
    salesIncome,
    bookingIncome,
    otherIncome,
    pendingIncome,
    paidIncome,
  }
}

export const emptyIncomeForm = () => ({
  date: getTodayISO(),
  source: 'Sale',
  customerId: '',
  customer: '',
  reference: '',
  relatedId: '',
  category: 'Product Sales',
  description: '',
  amount: '',
  paidAmount: '',
  paymentMethod: 'Cash',
  paymentStatus: 'Pending',
  dueDate: '',
  notes: '',
  branchId: '',
})

export const incomeToForm = (record) => ({
  date: record.date || getTodayISO(),
  source: record.source || (record.type === 'Sales' ? 'Sale' : record.type) || 'Other',
  customerId: record.customerId ? String(record.customerId) : '',
  customer: record.customer || '',
  reference: record.reference || '',
  relatedId: record.relatedId ? String(record.relatedId) : '',
  category: record.category || categoryForSource(record.source),
  description: record.description || '',
  amount: record.amount ?? '',
  paidAmount: record.paidAmount ?? '',
  paymentMethod: record.paymentMethod || 'Cash',
  paymentStatus: record.paymentStatus || 'Pending',
  dueDate: record.dueDate || '',
  notes: record.notes || '',
  branchId: record.branchId != null ? String(record.branchId) : '',
})

export const validateIncomeForm = (form) => {
  const errors = {}
  if (!form.date) errors.date = 'Date is required'
  if (!form.source) errors.source = 'Income source is required'
  if (!form.customer?.trim() && !form.customerId) errors.customer = 'Customer is required'
  if (!form.category) errors.category = 'Category is required'
  if (!form.description?.trim()) errors.description = 'Description is required'
  if (Number(form.amount) <= 0) errors.amount = 'Amount must be greater than 0'
  if (Number(form.paidAmount) < 0) errors.paidAmount = 'Paid amount cannot be negative'
  if (Number(form.paidAmount) > Number(form.amount)) {
    errors.paidAmount = 'Paid amount cannot exceed total amount'
  }
  if (!form.paymentMethod) errors.paymentMethod = 'Payment method is required'
  return errors
}

export const normalizeIncomePayload = (form, incomeId, existing = null) => {
  const amount = Number(form.amount) || 0
  const paidAmount = Number(form.paidAmount) || 0
  const remainingAmount = calcRemaining(amount, paidAmount)
  const paymentStatus = derivePaymentStatus({
    amount,
    paidAmount,
    dueDate: form.dueDate || null,
  })
  const source = form.source || 'Other'
  const relatedId = form.relatedId ? Number(form.relatedId) : null
  const relatedType = ['Sale', 'Rental', 'Booking'].includes(source) ? source : null

  return {
    incomeId,
    date: form.date,
    source,
    type: legacyTypeForSource(source),
    customerId: form.customerId ? Number(form.customerId) : null,
    customer: form.customer,
    reference: form.reference || '',
    relatedId,
    relatedType,
    saleId: source === 'Sale' ? relatedId : null,
    rentalId: source === 'Rental' ? relatedId : null,
    bookingId: source === 'Booking' ? relatedId : null,
    description: form.description.trim(),
    amount,
    paidAmount,
    remainingAmount,
    paymentMethod: form.paymentMethod,
    paymentStatus,
    category: form.category || categoryForSource(source),
    dueDate: form.dueDate || null,
    notes: form.notes || '',
    branchId: form.branchId || null,
  }
}

export const filterIncome = (records, filters) => {
  const q = (filters.search || '').trim().toLowerCase()
  return records.filter((r) => {
    if (q) {
      const hay =
        `${r.incomeId} ${r.customer} ${r.reference} ${r.description} ${r.source} ${r.category}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (filters.dateFrom && r.date < filters.dateFrom) return false
    if (filters.dateTo && r.date > filters.dateTo) return false
    if (filters.source && r.source !== filters.source) return false
    if (filters.category && r.category !== filters.category) return false
    if (filters.customer && r.customer !== filters.customer) return false
    if (filters.paymentMethod && r.paymentMethod !== filters.paymentMethod) return false
    if (filters.paymentStatus && r.paymentStatus !== filters.paymentStatus) return false
    return true
  })
}

export const sortIncome = (records, sortBy, sortDir = 'desc') => {
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
      case 'customer':
        av = a.customer || ''
        bv = b.customer || ''
        break
      case 'source':
        av = a.source || ''
        bv = b.source || ''
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

export const defaultIncomeFilters = () => ({
  search: '',
  dateFrom: '',
  dateTo: '',
  source: '',
  category: '',
  customer: '',
  paymentMethod: '',
  paymentStatus: '',
})

export const incomeBySourceChart = (records = []) => {
  const stats = getIncomeStats(records)
  return [
    { name: 'Sales', value: stats.salesIncome },
    { name: 'Rental', value: stats.rentalIncome },
    { name: 'Booking', value: stats.bookingIncome },
    { name: 'Other', value: stats.otherIncome },
  ].filter((d) => d.value > 0)
}

export const formatIncomeAmount = (value) => formatCurrency(value)
