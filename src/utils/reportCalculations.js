/**
 * Inventory / equipment / financial / customer report calculations.
 * Derived from AppContext datasets — no hardcoded report totals.
 */

import { filterByDateRange, isDateInRange } from './reportHelpers'
import {
  getFinancialOverview,
  MONTH_LABELS,
  paymentsForIncome,
} from './financialHelpers'

const ACTIVE_RENTAL_STATUSES = ['Active', 'Confirmed', 'Overdue', 'Pending']

export const calculateInventorySummary = (products = []) => {
  const totalProducts = products.length
  const totalAvailable = products.reduce((s, p) => s + (Number(p.available) || 0), 0)
  const currentlyRented = products.reduce((s, p) => s + (Number(p.rented) || 0), 0)
  const underMaintenance = products.filter(
    (p) => String(p.status).toLowerCase() === 'maintenance'
  ).length
  const lowStock = products.filter(
    (p) => Number(p.available) <= Number(p.minStock || 0)
  ).length

  const hasCost = products.some((p) => Number(p.purchaseCost) > 0)
  const totalInventoryValue = hasCost
    ? products.reduce(
        (s, p) => s + (Number(p.quantity) || 0) * (Number(p.purchaseCost) || 0),
        0
      )
    : null

  return {
    totalProducts,
    totalAvailable,
    currentlyRented,
    underMaintenance,
    lowStock,
    totalInventoryValue,
    hasCost,
  }
}

export const calculateInventoryByStatus = (products = []) => {
  const buckets = {
    Available: 0,
    Rented: 0,
    Reserved: 0,
    Maintenance: 0,
    'Out of Stock': 0,
    Inactive: 0,
  }

  products.forEach((p) => {
    const status = p.status || 'Available'
    const available = Number(p.available) || 0
    const rented = Number(p.rented) || 0
    const reserved = Number(p.reserved) || 0

    if (String(status).toLowerCase() === 'inactive') {
      buckets.Inactive += Number(p.quantity) || 1
      return
    }
    if (String(status).toLowerCase() === 'maintenance') {
      buckets.Maintenance += 1
    }
    buckets.Available += available
    buckets.Rented += rented
    buckets.Reserved += reserved
    if (available <= 0) buckets['Out of Stock'] += 1
  })

  const totalUnits = Object.values(buckets).reduce((s, v) => s + v, 0) || 1

  return Object.entries(buckets).map(([status, quantity]) => ({
    status,
    quantity,
    percentage: Math.round((quantity / totalUnits) * 1000) / 10,
  }))
}

export const calculateLowStockProducts = (products = []) =>
  products
    .filter((p) => Number(p.available) <= Number(p.minStock || 0))
    .map((p) => ({
      id: p.id,
      product: p.name,
      serial_number: p.serial_number || '—',
      category: p.category || '—',
      availableQuantity: Number(p.available) || 0,
      minimumStock: Number(p.minStock) || 0,
      difference: (Number(p.available) || 0) - (Number(p.minStock) || 0),
      status: p.status || 'Low Stock',
      image: p.image,
    }))
    .sort((a, b) => a.difference - b.difference)

const normalizeMovementType = (type = '') => {
  const t = String(type).toLowerCase()
  if (t.includes('purchase') || t.includes('stock added') || t === 'in') {
    return 'Purchase / Stock Added'
  }
  if (t.includes('sale')) return 'Sale'
  if (t.includes('rental out') || t === 'rental-out') return 'Rental Out'
  if (t.includes('rental in') || t.includes('return') || t.includes('rental return')) {
    return 'Rental Return'
  }
  if (t.includes('adjust')) return 'Adjustment'
  if (t.includes('damage')) return 'Damaged'
  if (t.includes('maintenance')) return 'Maintenance'
  if (t.includes('removed') || t.includes('stock removed')) return 'Stock Removed'
  return type || 'Adjustment'
}

export const calculateStockMovement = (stockHistory = [], { from, to, search = '' } = {}) => {
  const q = search.trim().toLowerCase()
  return stockHistory
    .filter((row) => {
      if (from || to) {
        if (!isDateInRange(row.date, from, to)) return false
      }
      if (q) {
        const hay = `${row.product} ${row.reference} ${row.type} ${row.user || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    .map((row) => {
      const qty = Number(row.quantity) || 0
      const newQty = Number(row.balance)
      const previousQuantity = Number.isFinite(newQty) ? newQty - qty : null
      return {
        id: row.id,
        date: row.date,
        reference: row.reference || '—',
        product: row.product || '—',
        movementType: normalizeMovementType(row.type),
        quantity: qty,
        previousQuantity,
        newQuantity: Number.isFinite(newQty) ? newQty : null,
        relatedParty: row.user || row.customer || row.supplier || '—',
        notes: row.notes || '',
      }
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

export const calculateStockMovementSummary = (movements = []) => {
  const summary = {
    stockAdded: 0,
    stockSold: 0,
    stockRented: 0,
    stockReturned: 0,
    stockAdjustments: 0,
  }

  movements.forEach((m) => {
    const qty = Math.abs(Number(m.quantity) || 0)
    switch (m.movementType) {
      case 'Purchase / Stock Added':
        summary.stockAdded += qty
        break
      case 'Sale':
        summary.stockSold += qty
        break
      case 'Rental Out':
        summary.stockRented += qty
        break
      case 'Rental Return':
        summary.stockReturned += qty
        break
      default:
        summary.stockAdjustments += qty
        break
    }
  })

  return summary
}

export const calculateProductUsage = (products = [], rentals = [], sales = [], maintenance = []) => {
  const productsRented = products.filter((p) =>
    rentals.some((r) => Number(r.productId) === Number(p.id))
  ).length

  const totalRentalTransactions = rentals.length
  const totalRentalDays = rentals.reduce((s, r) => s + (Number(r.duration) || 0), 0)
  const totalRentalIncome = rentals.reduce((s, r) => s + (Number(r.total) || 0), 0)
  const productsWithNoRental = products.filter(
    (p) => !rentals.some((r) => Number(r.productId) === Number(p.id))
  ).length

  return {
    totalProducts: products.length,
    productsRented,
    totalRentalTransactions,
    totalRentalDays,
    totalRentalIncome,
    productsWithNoRentalActivity: productsWithNoRental,
    salesCount: sales.length,
    maintenanceCount: maintenance.length,
  }
}

export const calculateRentalFrequencyByProduct = (products = [], rentals = []) => {
  return products
    .map((p) => {
      const related = rentals.filter((r) => r.rentalStatus !== 'Cancelled' && Number(r.productId) === Number(p.id))
      const last = [...related].sort((a, b) =>
        String(b.startDate).localeCompare(String(a.startDate))
      )[0]
      return {
        productId: p.id,
        equipment: p.name,
        serial_number: p.serial_number || '—',
        category: p.category || '—',
        timesRented: related.length,
        totalRentalDays: related.reduce((s, r) => s + (Number(r.duration) || 0), 0),
        rentalIncome: related.reduce((s, r) => s + (Number(r.total) || 0), 0),
        lastRentedDate: last?.startDate || null,
        currentStatus: p.status || '—',
        image: p.image,
      }
    })
    .sort((a, b) => b.timesRented - a.timesRented)
}

export const calculateRentalIncomeByProduct = (products = [], rentals = []) => {
  return products
    .map((p) => {
      const related = rentals.filter((r) => r.rentalStatus !== 'Cancelled' && Number(r.productId) === Number(p.id))
      return {
        productId: p.id,
        equipment: p.name,
        rentalCount: related.length,
        rentalDays: related.reduce((s, r) => s + (Number(r.duration) || 0), 0),
        rentalIncome: related.reduce((s, r) => s + (Number(r.total) || 0), 0),
        paidAmount: related.reduce((s, r) => s + (Number(r.amountPaid) || 0), 0),
        outstandingAmount: related.reduce((s, r) => s + (Number(r.balance) || 0), 0),
      }
    })
    .filter((row) => row.rentalCount > 0)
    .sort((a, b) => b.rentalIncome - a.rentalIncome)
}

export const calculateEquipmentStatus = (products = [], rentals = [], maintenance = []) => {
  const summary = {
    totalEquipment: products.length,
    available: products.filter((p) => String(p.status).toLowerCase() === 'available').length,
    rented: products.filter(
      (p) => (Number(p.rented) || 0) > 0 || String(p.status).toLowerCase() === 'rented'
    ).length,
    reserved: products.filter((p) => (Number(p.reserved) || 0) > 0).length,
    maintenance: products.filter((p) => String(p.status).toLowerCase() === 'maintenance').length,
    inactive: products.filter((p) => String(p.status).toLowerCase() === 'inactive').length,
    lowStock: products.filter((p) => String(p.status).toLowerCase() === 'low stock').length,
  }

  const rows = products.map((p) => {
    const relatedRentals = rentals.filter((r) => r.rentalStatus !== 'Cancelled' && Number(r.productId) === Number(p.id))
    const relatedMaint = maintenance.filter((m) => Number(m.productId) === Number(p.id))
    const lastRental = [...relatedRentals].sort((a, b) =>
      String(b.startDate).localeCompare(String(a.startDate))
    )[0]
    const lastMaint = [...relatedMaint].sort((a, b) =>
      String(b.startDate || b.completedDate || '').localeCompare(
        String(a.startDate || a.completedDate || '')
      )
    )[0]

    return {
      productId: p.id,
      equipment: p.name,
      serial_number: p.serial_number || '—',
      category: p.category || '—',
      condition: p.condition || '—',
      currentStatus: p.status || '—',
      rentalCount: relatedRentals.length,
      totalRentalDays: relatedRentals.reduce((s, r) => s + (Number(r.duration) || 0), 0),
      rentalIncome: relatedRentals.reduce((s, r) => s + (Number(r.total) || 0), 0),
      lastRental: lastRental?.startDate || null,
      lastMaintenance: lastMaint?.completedDate || lastMaint?.startDate || null,
      image: p.image,
    }
  })

  return { summary, rows }
}

export const calculateEquipmentMaintenanceHistory = (
  maintenance = [],
  { from, to, productId = '', status = '', search = '' } = {}
) => {
  const q = search.trim().toLowerCase()
  return maintenance
    .filter((m) => {
      const date = m.startDate || m.completedDate
      if ((from || to) && date && !isDateInRange(date, from, to)) return false
      if (productId && String(m.productId) !== String(productId)) return false
      if (status && m.status !== status) return false
      if (q) {
        const hay = `${m.product} ${m.maintenanceType} ${m.maintenanceId} ${m.notes}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    .map((m) => ({
      id: m.id,
      equipment: m.product,
      productId: m.productId,
      maintenanceType: m.maintenanceType,
      date: m.startDate || m.completedDate,
      status: m.status,
      cost: Number(m.cost) > 0 ? Number(m.cost) : null,
      nextMaintenance: m.expectedCompletion || null,
      notes: m.notes || m.description || '',
      maintenanceId: m.maintenanceId,
    }))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
}

export const calculateEquipmentCheckHistory = (
  checks = [],
  { from, to, productId = '', status = '', search = '' } = {}
) => {
  const q = search.trim().toLowerCase()
  return checks
    .filter((c) => {
      const date = c.checkDate || c.nextCheck
      if ((from || to) && date && !isDateInRange(date, from, to)) return false
      if (productId && String(c.productId) !== String(productId)) return false
      if (status && c.status !== status) return false
      if (q) {
        const hay = `${c.checkId} ${c.product} ${c.check} ${c.notes}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    .map((c) => ({
      id: c.id,
      checkId: c.checkId,
      equipment: c.product,
      productId: c.productId,
      checkType: c.check || c.name,
      scheduledDate: c.checkDate || c.nextCheck,
      completedDate: c.lastCompleted,
      status: c.status,
      result: c.status === 'Completed' ? 'Completed' : c.status || '—',
      notes: c.notes || c.description || '',
    }))
    .sort((a, b) =>
      String(b.scheduledDate || '').localeCompare(String(a.scheduledDate || ''))
    )
}

export const calculateProductLifecycle = (products = [], rentals = [], maintenance = []) => {
  return products.map((p) => {
    const history = Array.isArray(p.usageHistory) ? p.usageHistory : []
    const lastEvent = [...history].sort((a, b) =>
      String(b.date).localeCompare(String(a.date))
    )[0]
    const relatedRentals = rentals.filter((r) => r.rentalStatus !== 'Cancelled' && Number(r.productId) === Number(p.id))
    const relatedMaint = maintenance.filter((m) => Number(m.productId) === Number(p.id))
    const lastRental = [...relatedRentals].sort((a, b) =>
      String(b.startDate).localeCompare(String(a.startDate))
    )[0]
    const lastMaint = [...relatedMaint].sort((a, b) =>
      String(b.startDate || '').localeCompare(String(a.startDate || ''))
    )[0]

    const stage =
      lastEvent?.event ||
      (String(p.status).toLowerCase() === 'maintenance'
        ? 'Maintenance'
        : (Number(p.rented) || 0) > 0
          ? 'Rented'
          : 'Available')

    return {
      productId: p.id,
      product: p.name,
      currentStage: stage,
      lastActivity: lastEvent?.date || null,
      lastActivityNote: lastEvent?.note || '',
      lastRental: lastRental?.startDate || null,
      lastMaintenance: lastMaint?.completedDate || lastMaint?.startDate || null,
      currentStatus: p.status || '—',
    }
  })
}

export const calculateProductUsageDetails = (
  product,
  rentals = [],
  sales = [],
  maintenance = []
) => {
  if (!product) return null
  const relatedRentals = rentals.filter((r) => r.rentalStatus !== 'Cancelled' && Number(r.productId) === Number(product.id))
  const relatedSales = sales.filter((s) =>
    (s.items || []).some((i) => Number(i.productId) === Number(product.id))
  )
  const relatedMaint = maintenance.filter((m) => Number(m.productId) === Number(product.id))

  let salesQuantity = 0
  let salesRevenue = 0
  relatedSales.forEach((s) => {
    ;(s.items || []).forEach((i) => {
      if (Number(i.productId) === Number(product.id)) {
        salesQuantity += Number(i.quantity) || 0
        salesRevenue += Number(i.total ?? i.quantity * i.unitPrice) || 0
      }
    })
  })

  const lastRental = [...relatedRentals].sort((a, b) =>
    String(b.startDate).localeCompare(String(a.startDate))
  )[0]
  const lastSale = [...relatedSales].sort((a, b) =>
    String(b.date).localeCompare(String(a.date))
  )[0]
  const lastMaint = [...relatedMaint].sort((a, b) =>
    String(b.startDate || '').localeCompare(String(a.startDate || ''))
  )[0]

  return {
    product,
    rentalCount: relatedRentals.length,
    totalRentalDays: relatedRentals.reduce((s, r) => s + (Number(r.duration) || 0), 0),
    rentalIncome: relatedRentals.reduce((s, r) => s + (Number(r.total) || 0), 0),
    salesQuantity,
    salesRevenue,
    currentStock: Number(product.available) || 0,
    maintenanceCount: relatedMaint.length,
    lastRental: lastRental?.startDate || null,
    lastSale: lastSale?.date || null,
    lastMaintenance: lastMaint?.completedDate || lastMaint?.startDate || null,
    rentals: relatedRentals,
    sales: relatedSales,
    maintenance: relatedMaint,
  }
}

export const getInventoryOverviewRows = (products = [], bookings = []) => {
  const reservedByProduct = {}
  bookings.forEach((b) => {
    if (['Confirmed', 'Pending', 'Reserved'].includes(b.status || b.bookingStatus)) {
      const pid = b.productId
      if (!pid) return
      reservedByProduct[pid] = (reservedByProduct[pid] || 0) + (Number(b.quantity) || 0)
    }
  })

  return products.map((p) => {
    const reserved = Number(p.reserved) || reservedByProduct[p.id] || 0
    const leftover =
      (Number(p.quantity) || 0) - (Number(p.available) || 0) - (Number(p.rented) || 0)
    const maintenanceQty =
      String(p.status).toLowerCase() === 'maintenance' ? Math.max(0, leftover || 1) : 0

    let stockStatus = 'OK'
    if (Number(p.available) <= 0) stockStatus = 'Out of Stock'
    else if (Number(p.available) <= Number(p.minStock || 0)) stockStatus = 'Low Stock'

    return {
      id: p.id,
      image: p.image,
      name: p.name,
      serial_number: p.serial_number || '—',
      category: p.category || '—',
      totalQuantity: Number(p.quantity) || 0,
      availableQuantity: Number(p.available) || 0,
      rentedQuantity: Number(p.rented) || 0,
      reservedQuantity: reserved,
      maintenanceQuantity: maintenanceQty,
      minimumStock: Number(p.minStock) || 0,
      stockStatus,
      currentStatus: p.status || '—',
    }
  })
}

export { filterByDateRange, isDateInRange, ACTIVE_RENTAL_STATUSES }

export const calculateFinancialReport = ({
  income = [],
  expenses = [],
  incomePayments = [],
  expensePayments = [],
  from,
  to,
} = {}) => {
  const rangedIncome = filterByDateRange(income, 'date', from, to)
  const rangedExpenses = filterByDateRange(expenses, 'date', from, to)
  const rangedIncomePayments = filterByDateRange(incomePayments, 'paymentDate', from, to)
  const rangedExpensePayments = filterByDateRange(expensePayments, 'paymentDate', from, to)

  const overview = getFinancialOverview(
    rangedIncome,
    rangedExpenses,
    rangedIncomePayments,
    rangedExpensePayments
  )

  return {
    ...overview,
    recordedNetCashFlow: overview.totalIncome - overview.totalExpenses,
    outstandingTotal: overview.outstandingIncome + overview.outstandingExpenses,
    rangedIncome,
    rangedExpenses,
    rangedIncomePayments,
    rangedExpensePayments,
  }
}

export const calculateMonthlyCashFlow = (income = [], expenses = [], { from, to } = {}) => {
  const fromDate = from ? new Date(from) : null
  const toDate = to ? new Date(to) : null
  const year = toDate?.getFullYear() || fromDate?.getFullYear() || new Date().getFullYear()

  return MONTH_LABELS.map((month, index) => {
    const prefix = `${year}-${String(index + 1).padStart(2, '0')}`
    const monthStart = `${prefix}-01`
    const monthEndDate = new Date(year, index + 1, 0)
    const monthEnd = `${prefix}-${String(monthEndDate.getDate()).padStart(2, '0')}`
    const intersects = (!from || monthEnd >= from) && (!to || monthStart <= to)
    if (!intersects) return null

    const incomeAmount = income
      .filter((r) => (r.date || '').startsWith(prefix))
      .reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const expenseAmount = expenses
      .filter((r) => (r.date || '').startsWith(prefix))
      .reduce((s, r) => s + (Number(r.amount) || 0), 0)

    return {
      month: month.slice(0, 3),
      monthFull: month,
      monthKey: prefix,
      income: incomeAmount,
      expenses: expenseAmount,
      netCashFlow: incomeAmount - expenseAmount,
    }
  }).filter(Boolean)
}

const mapIncomeSourceLabel = (record) => {
  const source = record.source || record.type || ''
  const category = record.category || ''
  if (source === 'Sale' || source === 'Sales') return 'Sales'
  if (source === 'Rental' || source === 'Rentals') return 'Rentals'
  if (source === 'Booking' || source === 'Bookings') return 'Bookings'
  if (category === 'Service Income') return 'Service Income'
  return 'Other Income'
}

export const calculateIncomeBySource = (income = []) => {
  const map = new Map()
  income.forEach((record) => {
    const source = mapIncomeSourceLabel(record)
    const existing = map.get(source) || {
      source,
      name: source,
      transactionCount: 0,
      totalAmount: 0,
      paidAmount: 0,
      outstandingAmount: 0,
    }
    existing.transactionCount += 1
    existing.totalAmount += Number(record.amount) || 0
    existing.paidAmount += Number(record.paidAmount) || 0
    existing.outstandingAmount += Number(record.remainingAmount) || Math.max(0, (Number(record.amount) || 0) - (Number(record.paidAmount) || 0))
    map.set(source, existing)
  })

  return [...map.values()]
    .map((row) => ({ ...row, value: row.totalAmount }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
}

export const calculateExpensesByCategory = (expenses = []) => {
  const map = new Map()
  expenses.forEach((record) => {
    const category = record.category || 'Other Expense'
    const existing = map.get(category) || {
      category,
      name: category,
      transactionCount: 0,
      totalAmount: 0,
      paidAmount: 0,
      outstandingAmount: 0,
    }
    existing.transactionCount += 1
    existing.totalAmount += Number(record.amount) || 0
    existing.paidAmount += Number(record.paidAmount) || 0
    existing.outstandingAmount +=
      Number(record.remainingAmount) ||
      Math.max(0, (Number(record.amount) || 0) - (Number(record.paidAmount) || 0))
    map.set(category, existing)
  })

  return [...map.values()]
    .map((row) => ({ ...row, value: row.totalAmount }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
}

const PAYMENT_STATUSES = ['Paid', 'Partial', 'Pending', 'Overdue']

export const calculatePaymentStatusSummary = (records = []) =>
  PAYMENT_STATUSES.map((status) => {
    const rows = records.filter((r) => r.paymentStatus === status)
    const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const paidAmount = rows.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0)
    return {
      status,
      transactionCount: rows.length,
      totalAmount,
      paidAmount,
      outstandingAmount: Math.max(0, totalAmount - paidAmount),
    }
  })

export const calculateOutstandingIncomeReport = (income = []) =>
  income
    .filter((r) => ['Partial', 'Pending', 'Overdue'].includes(r.paymentStatus))
    .map((r) => ({
      id: r.id,
      incomeId: r.incomeId,
      date: r.date,
      source: r.source || r.type,
      customer: r.customer || r.reference || '—',
      totalAmount: Number(r.amount) || 0,
      paid: Number(r.paidAmount) || 0,
      outstanding:
        Number(r.remainingAmount) ||
        Math.max(0, (Number(r.amount) || 0) - (Number(r.paidAmount) || 0)),
      status: r.paymentStatus,
    }))
    .sort((a, b) => b.outstanding - a.outstanding)

export const calculateOutstandingExpenseReport = (expenses = []) =>
  expenses
    .filter((r) => ['Partial', 'Pending', 'Overdue'].includes(r.paymentStatus))
    .map((r) => ({
      id: r.id,
      expenseId: r.expenseId,
      date: r.date,
      category: r.category,
      supplier: r.supplier || r.reference || '—',
      totalAmount: Number(r.amount) || 0,
      paid: Number(r.paidAmount) || 0,
      outstanding:
        Number(r.remainingAmount) ||
        Math.max(0, (Number(r.amount) || 0) - (Number(r.paidAmount) || 0)),
      status: r.paymentStatus,
    }))
    .sort((a, b) => b.outstanding - a.outstanding)

export const calculateCustomerSummary = ({
  customers = [],
  sales = [],
  rentals = [],
  from,
  to,
} = {}) => {
  const rangedSales = filterByDateRange(sales, 'date', from, to)
  const rangedRentals = filterByDateRange(rentals, 'startDate', from, to)

  const activeIds = new Set([
    ...rangedSales.map((s) => s.customerId).filter(Boolean),
    ...rangedRentals.map((r) => r.customerId).filter(Boolean),
  ])
  const salesCustomerIds = new Set(rangedSales.map((s) => s.customerId).filter(Boolean))
  const rentalCustomerIds = new Set(rangedRentals.map((r) => r.customerId).filter(Boolean))

  return {
    totalCustomers: customers.length,
    activeCustomers: activeIds.size,
    salesCustomers: salesCustomerIds.size,
    rentalCustomers: rentalCustomerIds.size,
    totalCustomerSales: rangedSales.reduce((s, sale) => s + (Number(sale.total) || 0), 0),
    totalCustomerRentals: rangedRentals.reduce((s, r) => s + (Number(r.total) || 0), 0),
    rangedSales,
    rangedRentals,
  }
}

export const calculateActiveCustomers = calculateCustomerSummary

export const calculateCustomerSales = (customers = [], sales = []) => {
  return customers
    .map((c) => {
      const related = sales.filter((s) => Number(s.customerId) === Number(c.id))
      if (!related.length) return null
      const last = [...related].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]
      return {
        customerId: c.id,
        customer: c.name,
        numberOfSales: related.length,
        itemsPurchased: related.reduce(
          (s, sale) =>
            s +
            (Array.isArray(sale.items)
              ? sale.items.reduce((q, i) => q + (Number(i.quantity) || 0), 0)
              : Number(sale.quantity) || 0),
          0
        ),
        salesAmount: related.reduce((s, sale) => s + (Number(sale.total) || 0), 0),
        paidAmount: related.reduce((s, sale) => s + (Number(sale.amountPaid) || 0), 0),
        outstandingAmount: related.reduce((s, sale) => s + (Number(sale.balance) || 0), 0),
        lastSaleDate: last?.date || null,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.salesAmount - a.salesAmount)
}

export const calculateCustomerRentals = (customers = [], rentals = []) => {
  return customers
    .map((c) => {
      const related = rentals.filter((r) => r.rentalStatus !== 'Cancelled' && Number(r.customerId) === Number(c.id))
      if (!related.length) return null
      const last = [...related].sort((a, b) =>
        String(b.startDate).localeCompare(String(a.startDate))
      )[0]
      return {
        customerId: c.id,
        customer: c.name,
        numberOfRentals: related.length,
        equipmentItems: related.reduce((s, r) => s + (Number(r.quantity) || 0), 0),
        rentalDays: related.reduce((s, r) => s + (Number(r.duration) || 0), 0),
        rentalAmount: related.reduce((s, r) => s + (Number(r.total) || 0), 0),
        paidAmount: related.reduce((s, r) => s + (Number(r.amountPaid) || 0), 0),
        outstandingAmount: related.reduce((s, r) => s + (Number(r.balance) || 0), 0),
        lastRentalDate: last?.startDate || null,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.rentalAmount - a.rentalAmount)
}

export const calculateCustomerActivity = (customers = [], sales = [], rentals = []) => {
  return customers.map((c) => {
    const custSales = sales.filter((s) => Number(s.customerId) === Number(c.id))
    const custRentals = rentals.filter((r) => r.rentalStatus !== 'Cancelled' && Number(r.customerId) === Number(c.id))
    const dates = [
      ...custSales.map((s) => s.date),
      ...custRentals.map((r) => r.startDate),
    ].filter(Boolean)
    const lastActivityDate = dates.sort().at(-1) || null
    const salesAmount = custSales.reduce((s, sale) => s + (Number(sale.total) || 0), 0)
    const rentalAmount = custRentals.reduce((s, r) => s + (Number(r.total) || 0), 0)

    return {
      customerId: c.id,
      customer: c.name,
      phone: c.phone || '—',
      email: c.email || '—',
      salesCount: custSales.length,
      salesAmount,
      rentalCount: custRentals.length,
      rentalAmount,
      totalActivity: salesAmount + rentalAmount,
      lastActivityDate,
      hasSales: custSales.length > 0,
      hasRentals: custRentals.length > 0,
    }
  })
}

export const calculateCustomerTransactionHistory = (
  customer,
  sales = [],
  rentals = [],
  { from, to } = {}
) => {
  if (!customer) return null
  const custSales = filterByDateRange(
    sales.filter((s) => Number(s.customerId) === Number(customer.id)),
    'date',
    from,
    to
  )
  const custRentals = filterByDateRange(
    rentals.filter((r) => r.rentalStatus !== 'Cancelled' && Number(r.customerId) === Number(customer.id)),
    'startDate',
    from,
    to
  )

  const totalSales = custSales.reduce((s, sale) => s + (Number(sale.total) || 0), 0)
  const totalRentals = custRentals.reduce((s, r) => s + (Number(r.total) || 0), 0)
  const totalPaid =
    custSales.reduce((s, sale) => s + (Number(sale.amountPaid) || 0), 0) +
    custRentals.reduce((s, r) => s + (Number(r.amountPaid) || 0), 0)
  const totalOutstanding =
    custSales.reduce((s, sale) => s + (Number(sale.balance) || 0), 0) +
    custRentals.reduce((s, r) => s + (Number(r.balance) || 0), 0)

  return {
    customer,
    sales: custSales,
    rentals: custRentals,
    financialSummary: {
      totalSales,
      totalRentals,
      totalPaid,
      totalOutstanding,
    },
  }
}

export const calculateCustomerPaymentHistory = ({
  customerId,
  sales = [],
  rentals = [],
  income = [],
  incomePayments = [],
} = {}) => {
  const payments = []

  sales
    .filter((s) => Number(s.customerId) === Number(customerId) && Number(s.amountPaid) > 0)
    .forEach((s) => {
      payments.push({
        id: `sale-${s.id}`,
        date: s.paymentDate || s.date,
        reference: s.invoiceNumber,
        type: 'Sale',
        paymentMethod: s.paymentMethod || '—',
        amount: Number(s.amountPaid) || 0,
        status: s.paymentStatus,
      })
    })

  rentals
    .filter((r) => Number(r.customerId) === Number(customerId) && Number(r.amountPaid) > 0)
    .forEach((r) => {
      payments.push({
        id: `rental-${r.id}`,
        date: r.startDate,
        reference: r.rentalId,
        type: 'Rental',
        paymentMethod: r.paymentMethod || '—',
        amount: Number(r.amountPaid) || 0,
        status: r.paymentStatus,
      })
    })

  income
    .filter((i) => Number(i.customerId) === Number(customerId))
    .forEach((inc) => {
      const related = paymentsForIncome(incomePayments, inc)
      if (related.length) {
        related.forEach((p) => {
          payments.push({
            id: `inc-pay-${p.id}`,
            date: p.paymentDate,
            reference: p.reference || inc.incomeId,
            type: 'Other Income',
            paymentMethod: p.paymentMethod || '—',
            amount: Number(p.amount) || 0,
            status: 'Paid',
          })
        })
      } else if (Number(inc.paidAmount) > 0) {
        payments.push({
          id: `inc-${inc.id}`,
          date: inc.date,
          reference: inc.incomeId,
          type: 'Other Income',
          paymentMethod: inc.paymentMethod || '—',
          amount: Number(inc.paidAmount) || 0,
          status: inc.paymentStatus,
        })
      }
    })

  return payments.sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

export const calculateCustomerActivityTimeline = ({
  customerId,
  sales = [],
  rentals = [],
  incomePayments = [],
  income = [],
} = {}) => {
  const events = []

  sales
    .filter((s) => Number(s.customerId) === Number(customerId))
    .forEach((s) => {
      events.push({
        id: `sale-created-${s.id}`,
        date: s.date,
        activity: 'Sale created',
        reference: s.invoiceNumber,
        amount: Number(s.total) || 0,
      })
      if (Number(s.amountPaid) > 0) {
        events.push({
          id: `sale-paid-${s.id}`,
          date: s.paymentDate || s.date,
          activity: 'Payment received',
          reference: s.invoiceNumber,
          amount: Number(s.amountPaid) || 0,
        })
      }
    })

  rentals
    .filter((r) => Number(r.customerId) === Number(customerId))
    .forEach((r) => {
      events.push({
        id: `rental-created-${r.id}`,
        date: r.startDate,
        activity: 'Rental created',
        reference: r.rentalId,
        amount: Number(r.total) || 0,
      })
      if (r.actualReturnDate || r.rentalStatus === 'Returned') {
        events.push({
          id: `rental-return-${r.id}`,
          date: r.actualReturnDate || r.expectedReturn,
          activity: 'Rental returned',
          reference: r.rentalId,
          amount: Number(r.total) || 0,
        })
      }
      if (Number(r.amountPaid) > 0) {
        events.push({
          id: `rental-paid-${r.id}`,
          date: r.startDate,
          activity: 'Payment added',
          reference: r.rentalId,
          amount: Number(r.amountPaid) || 0,
        })
      }
    })

  income
    .filter((i) => Number(i.customerId) === Number(customerId))
    .forEach((inc) => {
      paymentsForIncome(incomePayments, inc).forEach((p) => {
        events.push({
          id: `income-pay-${p.id}`,
          date: p.paymentDate,
          activity: 'Payment added',
          reference: p.paymentId || inc.incomeId,
          amount: Number(p.amount) || 0,
        })
      })
    })

  return events.sort((a, b) => String(b.date).localeCompare(String(a.date)))
}
