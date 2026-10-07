import { formatCurrency } from './helpers'

export const FINANCIAL_PAYMENT_METHODS = [
  'Cash',
  'Bank Transfer',
  'Card',
  'Online Payment',
  'Cheque',
]

export const getTodayISO = (today = new Date()) => today.toISOString().slice(0, 10)

/**
 * Shared payment status calculation for income & expense transactions.
 */
export const deriveFinancialPaymentStatus = ({
  amount,
  paidAmount,
  dueDate,
  today = new Date(),
} = {}) => {
  const total = Number(amount) || 0
  const paid = Math.max(0, Number(paidAmount) || 0)
  const remaining = Math.max(0, total - paid)
  const todayISO = getTodayISO(today)

  if (total > 0 && paid >= total) return 'Paid'
  if (paid > 0 && paid < total) {
    if (dueDate && dueDate < todayISO) return 'Overdue'
    return 'Partial'
  }
  if (paid === 0) {
    if (dueDate && dueDate < todayISO) return 'Overdue'
    return 'Pending'
  }
  return remaining > 0 && dueDate && dueDate < todayISO ? 'Overdue' : 'Pending'
}

export const calcRemainingAmount = (amount, paidAmount) =>
  Math.max(0, (Number(amount) || 0) - Math.max(0, Number(paidAmount) || 0))

export const sumPaymentAmounts = (payments = []) =>
  payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

export const applyPaymentsToTransaction = (record, payments = []) => {
  const amount = Number(record.amount) || 0
  const paidAmount = sumPaymentAmounts(payments)
  const remainingAmount = calcRemainingAmount(amount, paidAmount)
  const paymentStatus = deriveFinancialPaymentStatus({
    amount,
    paidAmount,
    dueDate: record.dueDate,
  })
  const lastPayment = [...payments].sort((a, b) =>
    String(a.paymentDate).localeCompare(String(b.paymentDate))
  ).at(-1)

  return {
    ...record,
    paidAmount,
    remainingAmount,
    paymentStatus,
    paymentMethod: lastPayment?.paymentMethod || record.paymentMethod,
  }
}

export const generatePaymentId = (payments = [], prefix = 'PAY') => {
  const maxNum = payments.reduce((max, p) => {
    const match = String(p.paymentId || '').match(/(\d+)$/)
    return match ? Math.max(max, parseInt(match[1], 10)) : max
  }, 0)
  return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`
}

export const emptyPaymentForm = (defaults = {}) => ({
  paymentDate: getTodayISO(),
  amount: defaults.amount ?? '',
  paymentMethod: defaults.paymentMethod || 'Cash',
  reference: '',
  notes: '',
})

export const paymentToForm = (payment) => ({
  paymentDate: payment.paymentDate || getTodayISO(),
  amount: payment.amount ?? '',
  paymentMethod: payment.paymentMethod || 'Cash',
  reference: payment.reference || '',
  notes: payment.notes || '',
})

export const validatePaymentForm = (form, { remaining = Infinity, excludeAmount = 0 } = {}) => {
  const errors = {}
  const amount = Number(form.amount) || 0
  const allowed = remaining + (Number(excludeAmount) || 0)

  if (!form.paymentDate) errors.paymentDate = 'Payment date is required'
  if (!form.paymentMethod) errors.paymentMethod = 'Payment method is required'
  if (amount <= 0) errors.amount = 'Amount must be greater than 0'
  else if (amount > allowed) {
    errors.amount = `Amount cannot exceed remaining ${formatCurrency(allowed)}`
  }
  return errors
}

export const buildFinancialTimeline = ({
  type = 'income',
  record,
  payments = [],
}) => {
  if (!record) return []
  const events = []

  events.push({
    id: 'created',
    title: type === 'income' ? 'Income Created' : 'Expense Created',
    date: record.date,
    description: record.description || record.incomeId || record.expenseId,
    tone: 'slate',
  })

  const sorted = [...payments].sort((a, b) =>
    String(a.paymentDate).localeCompare(String(b.paymentDate))
  )

  sorted.forEach((p, index) => {
    events.push({
      id: p.paymentId || `pay-${p.id}`,
      title:
        index === 0
          ? type === 'income'
            ? 'Payment Received'
            : 'Supplier Payment'
          : 'Additional Payment',
      date: p.paymentDate,
      description: `${formatCurrency(p.amount)} via ${p.paymentMethod}`,
      tone: 'blue',
      meta: p.reference || p.notes || '',
    })
  })

  const paid = sumPaymentAmounts(payments)
  const total = Number(record.amount) || 0
  if (total > 0 && paid >= total) {
    events.push({
      id: 'fully-paid',
      title: 'Fully Paid',
      date: sorted.at(-1)?.paymentDate || record.date,
      description: 'Balance cleared',
      tone: 'green',
    })
  }

  return events
}

export const getFinancialOverview = (income = [], expenses = [], incomePayments = [], expensePayments = [], today = new Date()) => {
  const totalIncome = income.reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const paidIncome = sumPaymentAmounts(incomePayments)
  const paidExpenses = sumPaymentAmounts(expensePayments)
  const outstandingIncome = Math.max(0, totalIncome - paidIncome)
  const outstandingExpenses = Math.max(0, totalExpenses - paidExpenses)
  const netCashFlow = paidIncome - paidExpenses

  const monthPrefix = getTodayISO(today).slice(0, 7)
  const monthPaidIncome = incomePayments
    .filter((p) => (p.paymentDate || '').startsWith(monthPrefix))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const monthPaidExpenses = expensePayments
    .filter((p) => (p.paymentDate || '').startsWith(monthPrefix))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const thisMonth = monthPaidIncome - monthPaidExpenses

  return {
    totalIncome,
    totalExpenses,
    paidIncome,
    paidExpenses,
    outstandingIncome,
    outstandingExpenses,
    netCashFlow,
    thisMonth,
    monthPaidIncome,
    monthPaidExpenses,
  }
}

export const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const sumByMonthPrefix = (records, dateKey, amountKey, prefix) =>
  records
    .filter((r) => (r[dateKey] || '').startsWith(prefix))
    .reduce((s, r) => s + (Number(r[amountKey]) || 0), 0)

/**
 * Monthly income vs expenses + net cash flow series.
 * Built only from live income/expense records; months without data are zero.
 */
export const getMonthlyFinancialSeries = (
  income = [],
  expenses = [],
  incomePayments = [],
  expensePayments = [],
  { year = new Date().getFullYear() } = {}
) => {
  return MONTH_LABELS.map((month, index) => {
    const prefix = `${year}-${String(index + 1).padStart(2, '0')}`
    const incomeAmount = sumByMonthPrefix(income, 'date', 'amount', prefix)
    const expenseAmount = sumByMonthPrefix(expenses, 'date', 'amount', prefix)
    const paidIncome = sumByMonthPrefix(incomePayments, 'paymentDate', 'amount', prefix)
    const paidExpenses = sumByMonthPrefix(expensePayments, 'paymentDate', 'amount', prefix)

    return {
      month,
      monthKey: prefix,
      income: incomeAmount,
      expenses: expenseAmount,
      paidIncome,
      paidExpenses,
      netCashFlow: paidIncome - paidExpenses,
    }
  })
}

export const getIncomeBySourceBreakdown = (income = []) => {
  const buckets = {
    Sales: 0,
    Rentals: 0,
    Bookings: 0,
    Other: 0,
  }

  income.forEach((record) => {
    const source = record.source || record.type || 'Other'
    const amount = Number(record.amount) || 0
    if (source === 'Sale' || source === 'Sales') buckets.Sales += amount
    else if (source === 'Rental' || source === 'Rentals') buckets.Rentals += amount
    else if (source === 'Booking' || source === 'Bookings') buckets.Bookings += amount
    else buckets.Other += amount
  })

  const total = Object.values(buckets).reduce((s, v) => s + v, 0) || 1

  return Object.entries(buckets)
    .map(([source, amount]) => ({
      source,
      name: source,
      amount,
      value: amount,
      percentage: Math.round((amount / total) * 1000) / 10,
    }))
    .filter((row) => row.amount > 0)
}

export const paymentsForIncome = (incomePayments, incomeRecord) => {
  if (!incomeRecord) return []
  return incomePayments.filter(
    (p) =>
      p.incomeRecordId === incomeRecord.id ||
      p.incomeId === incomeRecord.incomeId
  )
}

export const paymentsForExpense = (expensePayments, expenseRecord) => {
  if (!expenseRecord) return []
  return expensePayments.filter(
    (p) =>
      p.expenseRecordId === expenseRecord.id ||
      p.expenseId === expenseRecord.expenseId
  )
}
