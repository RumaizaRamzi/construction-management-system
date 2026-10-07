import { PAYMENT_STATUSES, PAYMENT_METHODS, SALE_STATUSES } from '../data/salesData'

export { PAYMENT_STATUSES, PAYMENT_METHODS, SALE_STATUSES }

export const generateInvoiceNumber = (sales = []) => {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`
  const maxNum = sales.reduce((max, s) => {
    const match = String(s.invoiceNumber || '').match(/INV-\d{4}-(\d+)/)
    return match ? Math.max(max, parseInt(match[1], 10)) : max
  }, 0)
  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`
}

export const calcLineTotal = (quantity, unitPrice, discount = 0) =>
  Math.max(0, Number(quantity || 0) * Number(unitPrice || 0) - Number(discount || 0))

export const calcSaleTotals = ({ items = [], discount = 0, taxRate = 0, amountPaid = 0 }) => {
  const subtotal = items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unitPrice || 0), 0)
  const itemDiscounts = items.reduce((sum, i) => sum + Number(i.discount || 0), 0)
  const totalDiscount = itemDiscounts + Number(discount || 0)
  const taxable = Math.max(0, subtotal - totalDiscount)
  const tax = Math.round(taxable * Number(taxRate || 0)) / 100
  const total = Math.round((taxable + tax) * 100) / 100
  const paid = Number(amountPaid || 0)
  const balance = Math.max(0, total - paid)
  return { subtotal, discount: totalDiscount, tax, total, amountPaid: paid, balance }
}

export const derivePaymentStatus = (total, amountPaid, preferred) => {
  if (preferred === 'Refunded' || preferred === 'Overdue') return preferred
  const paid = Number(amountPaid || 0)
  const grand = Number(total || 0)
  if (paid <= 0) return 'Pending'
  if (paid >= grand) return 'Paid'
  return 'Partial'
}

export const saleAffectsInventory = (sale) => {
  const status = sale?.saleStatus
  return status === 'Completed' || status === 'Pending'
}

export const getSaleStats = (sales = [], today = new Date().toISOString().slice(0, 10)) => {
  const monthPrefix = today.slice(0, 7)
  const active = sales.filter((s) => s.saleStatus !== 'Cancelled')
  const totalSales = active.length
  const todaySales = active.filter((s) => s.date === today).length
  const monthSales = active.filter((s) => String(s.date).startsWith(monthPrefix)).length
  const totalRevenue = active
    .filter((s) => s.saleStatus !== 'Refunded')
    .reduce((sum, s) => sum + Number(s.total || 0), 0)
  const pendingPayments = active.filter((s) =>
    ['Pending', 'Partial', 'Overdue'].includes(s.paymentStatus)
  ).length
  const paidAmount = active.reduce((sum, s) => sum + Number(s.amountPaid || 0), 0)
  const pendingAmount = active
    .filter((s) => ['Pending', 'Partial', 'Overdue'].includes(s.paymentStatus))
    .reduce((sum, s) => sum + Number(s.balance || 0), 0)
  const refundedAmount = sales
    .filter((s) => s.saleStatus === 'Refunded' || s.paymentStatus === 'Refunded')
    .reduce((sum, s) => sum + Number(s.total || 0), 0)

  return {
    totalSales,
    todaySales,
    monthSales,
    totalRevenue,
    pendingPayments,
    paidAmount,
    pendingAmount,
    refundedAmount,
  }
}

export const emptySaleForm = () => ({
  customerId: '',
  customer: '',
  customerPhone: '',
  customerEmail: '',
  customerAddress: '',
  date: new Date().toISOString().slice(0, 10),
  items: [],
  discount: 0,
  taxRate: 0,
  amountPaid: 0,
  paymentStatus: 'Pending',
  paymentMethod: 'Cash',
  paymentDate: new Date().toISOString().slice(0, 10),
  saleStatus: 'Completed',
  notes: '',
  branchId: '',
})

export const validateSaleForm = (form, products = []) => {
  const errors = {}
  if (!form.customerId && !form.customer?.trim()) {
    errors.customer = 'Customer is required'
  }
  if (!form.date) errors.date = 'Sale date is required'
  if (!form.items?.length) errors.items = 'Add at least one product'
  if (!form.paymentMethod) errors.paymentMethod = 'Payment method is required'
  if (!form.saleStatus) errors.saleStatus = 'Sale status is required'

  form.items?.forEach((item, index) => {
    const product = products.find((p) => p.id === item.productId)
    const qty = Number(item.quantity || 0)
    if (!item.productId) {
      errors[`item_${index}`] = 'Select a product'
      return
    }
    if (qty <= 0) {
      errors[`item_${index}`] = 'Quantity must be greater than 0'
      return
    }
    const available = Number(product?.available || 0) + Number(item._originalQty || 0)
    if (product && qty > available) {
      errors[`item_${index}`] = 'Insufficient stock available.'
      errors.stock = 'Insufficient stock available.'
    }
  })

  return errors
}

export const normalizeSalePayload = (form, invoiceNumber) => {
  const items = (form.items || []).map((item, idx) => ({
    id: item.id || idx + 1,
    productId: Number(item.productId),
    productName: item.productName,
    serial_number: item.serial_number,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    discount: Number(item.discount || 0),
    total: calcLineTotal(item.quantity, item.unitPrice, item.discount),
  }))

  const totals = calcSaleTotals({
    items,
    discount: form.discount,
    taxRate: form.taxRate,
    amountPaid: form.amountPaid,
  })

  const paymentStatus = derivePaymentStatus(totals.total, totals.amountPaid, form.paymentStatus)

  return {
    invoiceNumber,
    customerId: Number(form.customerId) || null,
    customer: form.customer,
    customerPhone: form.customerPhone,
    customerEmail: form.customerEmail,
    customerAddress: form.customerAddress,
    date: form.date,
    items,
    products: items.map((i) => i.productName).join(', '),
    quantity: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: totals.subtotal,
    discount: totals.discount,
    orderDiscount: Number(form.discount || 0),
    tax: totals.tax,
    taxRate: Number(form.taxRate || 0),
    total: totals.total,
    amountPaid: totals.amountPaid,
    balance: totals.balance,
    paymentStatus,
    paymentMethod: form.paymentMethod,
    paymentDate: form.paymentDate || form.date,
    saleStatus: form.saleStatus,
    notes: form.notes || '',
    branchId: form.branchId || null,
  }
}
