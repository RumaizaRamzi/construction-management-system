/**
 * Rental report builders — derived from AppContext rentals / products data.
 */

import { filterByDateRange, isDateInRange } from './reportHelpers'
import { MONTH_LABELS } from './financialHelpers'
import { getTodayISO } from './financialHelpers'

export const RENTAL_STATUSES = [
  'Pending',
  'Confirmed',
  'Active',
  'Returned',
  'Overdue',
  'Cancelled',
]

export const RENTAL_PAYMENT_STATUSES = [
  'Paid',
  'Partial',
  'Pending',
  'Overdue',
  'Refunded',
]

const billable = (rentals = []) => rentals.filter((r) => r.rentalStatus !== 'Cancelled')

export const getRentalReportSummary = (allRentals = []) => {
  const rentals = billable(allRentals)
  const totalRentals = allRentals.length
  const rentalIncome = rentals.reduce((s, r) => s + (Number(r.total) || 0), 0)
  const paidAmount = rentals.reduce((s, r) => s + (Number(r.amountPaid) || 0), 0)
  const outstandingAmount = rentals.reduce((s, r) => s + (Number(r.balance) || 0), 0)
  const equipmentRented = rentals.reduce((s, r) => s + (Number(r.quantity) || 0), 0)
  const averageRentalValue = rentals.length > 0 ? Math.round(rentalIncome / rentals.length) : 0

  return {
    totalRentals,
    rentalIncome,
    paidAmount,
    outstandingAmount,
    equipmentRented,
    averageRentalValue,
  }
}

export const getRentalStatusSummary = (rentals = []) =>
  RENTAL_STATUSES.map((status) => {
    const rows = rentals.filter((r) => r.rentalStatus === status)
    return {
      status,
      count: rows.length,
      amount: rows.reduce((sum, r) => sum + (Number(r.total) || 0), 0),
    }
  })

export const getMonthlyRentalIncome = (rentals = [], from, to) => {
  const fromDate = from ? new Date(from) : null
  const toDate = to ? new Date(to) : null
  const year = toDate?.getFullYear() || fromDate?.getFullYear() || new Date().getFullYear()

  return MONTH_LABELS.map((month, index) => {
    const prefix = `${year}-${String(index + 1).padStart(2, '0')}`
    const monthStart = `${prefix}-01`
    const monthEndDate = new Date(year, index + 1, 0)
    const monthEnd = `${prefix}-${String(monthEndDate.getDate()).padStart(2, '0')}`

    const intersects =
      (!from || monthEnd >= from) && (!to || monthStart <= to)

    if (!intersects) return null

    const income = billable(rentals)
      .filter((r) => (r.startDate || '').startsWith(prefix))
      .reduce((sum, r) => sum + (Number(r.total) || 0), 0)

    return {
      month: month.slice(0, 3),
      monthFull: month,
      monthKey: prefix,
      income,
    }
  }).filter(Boolean)
}

export const getEquipmentRentalUsage = (rentals = [], products = []) => {
  const map = new Map()

  billable(rentals).forEach((rental) => {
    const key = rental.productId || rental.product
    const existing = map.get(key) || {
      productId: rental.productId || null,
      equipment: rental.product || 'Unknown',
      serial_number: rental.product_serial_number || '—',
      category: rental.productCategory || '—',
      timesRented: 0,
      totalRentalDays: 0,
      rentalIncome: 0,
      currentStatus: '—',
      lastRentedDate: null,
    }

    existing.timesRented += 1
    existing.totalRentalDays += Number(rental.duration) || 0
    existing.rentalIncome += Number(rental.total) || 0
    if (!existing.lastRentedDate || rental.startDate > existing.lastRentedDate) {
      existing.lastRentedDate = rental.startDate
    }
    map.set(key, existing)
  })

  return [...map.values()]
    .map((row) => {
      const product = products.find((p) => Number(p.id) === Number(row.productId))
      return {
        ...row,
        equipment: product?.name || row.equipment,
        serial_number: product?.serial_number || row.serial_number,
        category: product?.category || row.category,
        currentStatus: product?.status || row.currentStatus,
      }
    })
    .sort((a, b) => b.timesRented - a.timesRented)
}

export const getRentalActivityByCustomer = (rentals = []) => {
  const map = new Map()

  billable(rentals).forEach((rental) => {
    const key = rental.customerId || rental.customer
    const existing = map.get(key) || {
      customerId: rental.customerId || null,
      customer: rental.customer || 'Unknown',
      numberOfRentals: 0,
      equipmentItems: 0,
      rentalIncome: 0,
      paid: 0,
      outstanding: 0,
      lastRentalDate: null,
    }

    existing.numberOfRentals += 1
    existing.equipmentItems += Number(rental.quantity) || 0
    existing.rentalIncome += Number(rental.total) || 0
    existing.paid += Number(rental.amountPaid) || 0
    existing.outstanding += Number(rental.balance) || 0
    if (!existing.lastRentalDate || rental.startDate > existing.lastRentalDate) {
      existing.lastRentalDate = rental.startDate
    }
    map.set(key, existing)
  })

  return [...map.values()].sort((a, b) => b.rentalIncome - a.rentalIncome)
}

export const getRentalPaymentStatusSummary = (rentals = []) =>
  RENTAL_PAYMENT_STATUSES.map((status) => {
    const rows = rentals.filter((r) => r.paymentStatus === status)
    return {
      status,
      count: rows.length,
      amount: rows.reduce((sum, r) => sum + (Number(r.total) || 0), 0),
    }
  })

export const getOverdueRentals = (rentals = [], today = new Date()) => {
  const todayISO = getTodayISO(today)
  return rentals
    .filter((r) => {
      const notReturned = !r.actualReturnDate && r.rentalStatus !== 'Returned' && r.rentalStatus !== 'Cancelled'
      const pastDue = r.expectedReturn && r.expectedReturn < todayISO
      return notReturned && (pastDue || r.rentalStatus === 'Overdue')
    })
    .map((r) => {
      const expected = new Date(r.expectedReturn)
      const now = new Date(todayISO)
      const daysOverdue = Math.max(
        0,
        Math.ceil((now - expected) / (1000 * 60 * 60 * 24))
      )
      return {
        ...r,
        daysOverdue,
        currentAmount: Number(r.total) || 0,
        lateFee: Number(r.lateFee) || 0,
      }
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
}

export const filterRentalTransactions = (rentals, filters = {}) => {
  const q = (filters.search || '').trim().toLowerCase()
  return rentals.filter((r) => {
    if (filters.from || filters.to) {
      if (!isDateInRange(r.startDate, filters.from, filters.to)) return false
    }
    if (filters.customer && r.customer !== filters.customer) return false
    if (filters.rentalStatus && r.rentalStatus !== filters.rentalStatus) return false
    if (filters.paymentStatus && r.paymentStatus !== filters.paymentStatus) return false
    if (q) {
      const hay = `${r.rentalId} ${r.customer} ${r.product} ${r.rentalStatus}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export const sortRentalTransactions = (rentals, sortBy = 'startDate', sortDir = 'desc') => {
  const dir = sortDir === 'asc' ? 1 : -1
  return [...rentals].sort((a, b) => {
    let av
    let bv
    switch (sortBy) {
      case 'total':
      case 'amount':
        av = Number(a.total) || 0
        bv = Number(b.total) || 0
        break
      case 'customer':
        av = a.customer || ''
        bv = b.customer || ''
        break
      case 'status':
        av = a.rentalStatus || ''
        bv = b.rentalStatus || ''
        break
      case 'startDate':
      default:
        av = a.startDate || ''
        bv = b.startDate || ''
        break
    }
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return 0
  })
}

export const rangedRentals = (rentals, from, to) =>
  filterByDateRange(rentals, 'startDate', from, to)
