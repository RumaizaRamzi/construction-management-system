/**
 * Reports overview helpers — date presets and summary builders.
 * Reuses financial utilities; ready for future Laravel report APIs.
 */

import { getFinancialOverview, getTodayISO } from './financialHelpers'

export const REPORT_DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
]

const toISO = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const startOfDay = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const endOfDay = (date) => {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export const resolveReportDateRange = (preset, customFrom = '', customTo = '', today = new Date()) => {
  const now = startOfDay(today)

  if (preset === 'custom') {
    const from = customFrom || toISO(now)
    const to = customTo || toISO(now)
    return { from, to, label: 'Custom Range' }
  }

  if (preset === 'today') {
    const iso = toISO(now)
    return { from: iso, to: iso, label: 'Today' }
  }

  if (preset === 'this_week') {
    const day = now.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const start = new Date(now)
    start.setDate(now.getDate() + mondayOffset)
    return { from: toISO(start), to: toISO(now), label: 'This Week' }
  }

  if (preset === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: toISO(start), to: toISO(now), label: 'This Month' }
  }

  if (preset === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return { from: toISO(start), to: toISO(end), label: 'Last Month' }
  }

  if (preset === 'this_quarter') {
    const quarter = Math.floor(now.getMonth() / 3)
    const start = new Date(now.getFullYear(), quarter * 3, 1)
    return { from: toISO(start), to: toISO(now), label: 'This Quarter' }
  }

  if (preset === 'this_year') {
    const start = new Date(now.getFullYear(), 0, 1)
    return { from: toISO(start), to: toISO(now), label: 'This Year' }
  }

  const iso = toISO(now)
  return { from: iso, to: iso, label: 'Today' }
}

export const isDateInRange = (date, from, to) => {
  if (!date) return false
  const d = startOfDay(new Date(date))
  if (Number.isNaN(d.getTime())) return false
  const fromDate = from ? startOfDay(new Date(from)) : null
  const toDate = to ? endOfDay(new Date(to)) : null
  if (fromDate && d < fromDate) return false
  if (toDate && d > toDate) return false
  return true
}

export const filterByDateRange = (records, dateKey, from, to) =>
  records.filter((r) => isDateInRange(r[dateKey], from, to))

/** Named aliases expected by Reports module — wrap shared financial overview. */
export const calculateTotalIncome = (income = []) =>
  income.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)

export const calculateTotalExpenses = (expenses = []) =>
  expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

export const calculateNetCashFlow = (incomePayments = [], expensePayments = []) => {
  const paidIncome = incomePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const paidExpenses = expensePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  return paidIncome - paidExpenses
}

export const REPORT_CATEGORIES = [
  {
    id: 'sales',
    title: 'Sales Reports',
    description: 'Track sales transactions, revenue and sales activity.',
    icon: 'ShoppingCart',
    tone: 'green',
    reports: [
      'Sales Summary',
      'Sales Transactions',
      'Sales by Product',
      'Sales by Customer',
    ],
  },
  {
    id: 'rentals',
    title: 'Rental Reports',
    description: 'Track equipment rentals, rental income and utilization.',
    icon: 'KeyRound',
    tone: 'blue',
    reports: [
      'Rental Summary',
      'Rental Transactions',
      'Rental Income',
      'Equipment Rental Usage',
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory Reports',
    description: 'Monitor stock, product movement and equipment usage.',
    icon: 'Package',
    tone: 'brand',
    reports: [
      'Inventory Summary',
      'Stock Movement',
      'Product Usage',
      'Low Stock Report',
    ],
  },
  {
    id: 'financial',
    title: 'Financial Reports',
    description: 'Monitor income, expenses and cash flow.',
    icon: 'Wallet',
    tone: 'violet',
    reports: [
      'Income Summary',
      'Expense Summary',
      'Net Cash Flow',
      'Income vs Expenses',
    ],
  },
  {
    id: 'cheques',
    title: 'Cheque Reports',
    description: 'Track pending, cleared, bounced and upcoming cheques.',
    icon: 'Landmark',
    tone: 'blue',
    reports: [
      'Pending Cheques',
      'Upcoming Cheques',
      'Overdue Cheques',
      'Cleared and Bounced Cheques',
    ],
  },
  {
    id: 'customers',
    title: 'Customer Reports',
    description: 'View customer activity and transaction history.',
    icon: 'Users',
    tone: 'slate',
    reports: [
      'Customer Summary',
      'Customer Transactions',
      'Customer Rental History',
    ],
  },
  {
    id: 'equipment',
    title: 'Equipment Reports',
    description: 'Monitor equipment activity and lifecycle information.',
    icon: 'Wrench',
    tone: 'red',
    reports: [
      'Equipment Usage',
      'Rental Frequency',
      'Maintenance History',
      'Equipment Status',
    ],
  },
]

/**
 * Build report overview metrics for the selected date range.
 * Financial figures reuse getFinancialOverview on filtered records/payments.
 */
export const buildReportOverview = ({
  sales = [],
  rentals = [],
  products = [],
  income = [],
  expenses = [],
  incomePayments = [],
  expensePayments = [],
  from,
  to,
}) => {
  const rangedSales = filterByDateRange(sales, 'date', from, to)
  const rangedRentals = filterByDateRange(rentals, 'startDate', from, to)
  const rangedIncome = filterByDateRange(income, 'date', from, to)
  const rangedExpenses = filterByDateRange(expenses, 'date', from, to)
  const rangedIncomePayments = filterByDateRange(incomePayments, 'paymentDate', from, to)
  const rangedExpensePayments = filterByDateRange(expensePayments, 'paymentDate', from, to)

  const financial = getFinancialOverview(
    rangedIncome,
    rangedExpenses,
    rangedIncomePayments,
    rangedExpensePayments
  )

  const totalSales = rangedSales.reduce((s, sale) => s + (Number(sale.total) || 0), 0)
  const totalRentalIncome = rangedRentals.reduce((s, r) => s + (Number(r.total) || 0), 0)
  const totalTransactions = rangedSales.length + rangedRentals.length + rangedIncome.length + rangedExpenses.length

  const totalProducts = products.length
  const availableProducts = products.reduce((s, p) => s + (Number(p.available) || 0), 0)
  const rentedProducts = products.reduce((s, p) => s + (Number(p.rented) || 0), 0)
  const lowStockProducts = products.filter(
    (p) => Number(p.available) <= Number(p.minStock)
  ).length

  return {
    from,
    to,
    summary: {
      totalSales,
      totalRentalIncome,
      totalIncome: financial.totalIncome,
      totalExpenses: financial.totalExpenses,
      netCashFlow: financial.netCashFlow,
      totalTransactions,
      outstandingIncome: financial.outstandingIncome,
      outstandingExpenses: financial.outstandingExpenses,
      paidIncome: financial.paidIncome,
      paidExpenses: financial.paidExpenses,
    },
    preview: {
      sales: {
        count: rangedSales.length,
        amount: totalSales,
      },
      rentals: {
        count: rangedRentals.length,
        income: totalRentalIncome,
      },
      inventory: {
        totalProducts,
        availableProducts,
        rentedProducts,
        lowStockProducts,
      },
      financial: {
        totalIncome: financial.totalIncome,
        totalExpenses: financial.totalExpenses,
        netCashFlow: financial.netCashFlow,
        outstandingIncome: financial.outstandingIncome,
        outstandingExpenses: financial.outstandingExpenses,
      },
    },
  }
}

export const formatReportRangeLabel = (from, to, presetLabel) => {
  if (!from || !to) return presetLabel || 'Selected period'
  if (from === to) return `${presetLabel || 'Period'} · ${from}`
  return `${presetLabel || 'Period'} · ${from} → ${to}`
}

export { getTodayISO }
