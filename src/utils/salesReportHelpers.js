/**
 * Sales report builders — derived from AppContext sales data.
 */

import { filterByDateRange, isDateInRange } from './reportHelpers'
import { MONTH_LABELS } from './financialHelpers'

export const getSalesReportSummary = (sales = []) => {
  const totalSales = sales.length
  const salesRevenue = sales.reduce((s, sale) => s + (Number(sale.total) || 0), 0)
  const paidAmount = sales.reduce((s, sale) => s + (Number(sale.amountPaid) || 0), 0)
  const outstandingAmount = sales.reduce((s, sale) => s + (Number(sale.balance) || 0), 0)
  const itemsSold = sales.reduce((s, sale) => {
    if (Array.isArray(sale.items)) {
      return s + sale.items.reduce((q, i) => q + (Number(i.quantity) || 0), 0)
    }
    return s + (Number(sale.quantity) || 0)
  }, 0)
  const averageSaleValue = totalSales > 0 ? Math.round(salesRevenue / totalSales) : 0

  return {
    totalSales,
    salesRevenue,
    paidAmount,
    outstandingAmount,
    itemsSold,
    averageSaleValue,
  }
}

export const getMonthlySalesRevenue = (sales = [], from, to) => {
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

    const revenue = sales
      .filter((s) => (s.date || '').startsWith(prefix))
      .reduce((sum, s) => sum + (Number(s.total) || 0), 0)

    return {
      month: month.slice(0, 3),
      monthFull: month,
      monthKey: prefix,
      revenue,
    }
  }).filter(Boolean)
}

export const getSalesByProduct = (sales = [], products = []) => {
  const map = new Map()

  sales.forEach((sale) => {
    const items = Array.isArray(sale.items) ? sale.items : []
    items.forEach((item) => {
      const key = item.productId || item.serial_number || item.productName
      const existing = map.get(key) || {
        productId: item.productId || null,
        product: item.productName || 'Unknown',
        serial_number: item.serial_number || '—',
        category: '',
        quantitySold: 0,
        numberOfSales: 0,
        revenue: 0,
        lastSoldDate: null,
        saleIds: new Set(),
      }

      existing.quantitySold += Number(item.quantity) || 0
      existing.revenue += Number(item.total ?? item.quantity * item.unitPrice) || 0
      existing.saleIds.add(sale.id)
      if (!existing.lastSoldDate || sale.date > existing.lastSoldDate) {
        existing.lastSoldDate = sale.date
      }
      map.set(key, existing)
    })
  })

  return [...map.values()]
    .map((row) => {
      const product = products.find((p) => Number(p.id) === Number(row.productId))
      return {
        ...row,
        product: product?.name || row.product,
        serial_number: product?.serial_number || row.serial_number,
        category: product?.category || row.category || '—',
        numberOfSales: row.saleIds.size,
        saleIds: undefined,
      }
    })
    .sort((a, b) => b.quantitySold - a.quantitySold)
}

export const getSalesByCustomer = (sales = []) => {
  const map = new Map()

  sales.forEach((sale) => {
    const key = sale.customerId || sale.customer
    const existing = map.get(key) || {
      customerId: sale.customerId || null,
      customer: sale.customer || 'Unknown',
      numberOfSales: 0,
      itemsPurchased: 0,
      totalSales: 0,
      paid: 0,
      outstanding: 0,
      lastPurchase: null,
    }

    existing.numberOfSales += 1
    existing.itemsPurchased += Array.isArray(sale.items)
      ? sale.items.reduce((q, i) => q + (Number(i.quantity) || 0), 0)
      : Number(sale.quantity) || 0
    existing.totalSales += Number(sale.total) || 0
    existing.paid += Number(sale.amountPaid) || 0
    existing.outstanding += Number(sale.balance) || 0
    if (!existing.lastPurchase || sale.date > existing.lastPurchase) {
      existing.lastPurchase = sale.date
    }
    map.set(key, existing)
  })

  return [...map.values()].sort((a, b) => b.totalSales - a.totalSales)
}

export const getSalesPaymentStatusSummary = (sales = []) => {
  const statuses = ['Paid', 'Partial', 'Pending', 'Overdue']
  return statuses.map((status) => {
    const rows = sales.filter((s) => s.paymentStatus === status)
    return {
      status,
      count: rows.length,
      amount: rows.reduce((sum, s) => sum + (Number(s.total) || 0), 0),
    }
  })
}

export const filterSalesTransactions = (sales, filters = {}) => {
  const q = (filters.search || '').trim().toLowerCase()
  return sales.filter((s) => {
    if (filters.from || filters.to) {
      if (!isDateInRange(s.date, filters.from, filters.to)) return false
    }
    if (filters.customer && s.customer !== filters.customer) return false
    if (filters.paymentStatus && s.paymentStatus !== filters.paymentStatus) return false
    if (filters.saleStatus && s.saleStatus !== filters.saleStatus) return false
    if (q) {
      const hay = `${s.invoiceNumber} ${s.customer} ${s.products} ${s.paymentStatus}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export const sortSalesTransactions = (sales, sortBy = 'date', sortDir = 'desc') => {
  const dir = sortDir === 'asc' ? 1 : -1
  return [...sales].sort((a, b) => {
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
}

export const rangedSales = (sales, from, to) => filterByDateRange(sales, 'date', from, to)
