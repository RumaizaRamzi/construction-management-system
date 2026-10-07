import { daysBetween } from './helpers'
import {
  RENTAL_STATUSES,
  RENTAL_PAYMENT_STATUSES,
  RENTAL_PAYMENT_METHODS,
} from '../data/rentalsData'

export { RENTAL_STATUSES, RENTAL_PAYMENT_STATUSES, RENTAL_PAYMENT_METHODS }

export const generateRentalNumber = (rentals = []) => {
  const year = new Date().getFullYear()
  const prefix = `RNT-${year}-`
  const maxNum = rentals.reduce((max, r) => {
    const match = String(r.rentalId || r.rentalNumber || '').match(/RNT-\d{4}-(\d+)/)
    return match ? Math.max(max, parseInt(match[1], 10)) : max
  }, 0)
  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`
}

export const calcRentalDuration = (startDate, endDate) => {
  if (!startDate) return 0
  // Without an expected return date one day is charged up front, as the API does.
  if (!endDate) return 1
  return Math.max(daysBetween(startDate, endDate), 1)
}

export const calcRentalTotals = ({
  rate = 0,
  duration = 0,
  quantity = 1,
  discount = 0,
  deposit = 0,
  lateFee = 0,
  damageFee = 0,
  amountPaid = 0,
}) => {
  const subtotal = Number(rate) * Number(duration) * Number(quantity)
  const total = Math.max(0, subtotal - Number(discount || 0))
  const paid = Number(amountPaid || 0)
  const balance = Math.max(0, total - paid)
  const depositRefund = Math.max(0, Number(deposit || 0) - Number(damageFee || 0) - Number(lateFee || 0))
  return {
    subtotal,
    discount: Number(discount || 0),
    deposit: Number(deposit || 0),
    lateFee: Number(lateFee || 0),
    damageFee: Number(damageFee || 0),
    total,
    amountPaid: paid,
    balance,
    depositRefund,
    grandTotal: total + Number(lateFee || 0) + Number(damageFee || 0),
  }
}

export const calcLateDays = (expectedReturn, actualReturn) => {
  if (!expectedReturn || !actualReturn) return 0
  const expected = new Date(expectedReturn)
  const actual = new Date(actualReturn)
  if (actual <= expected) return 0
  return daysBetween(expectedReturn, actualReturn)
}

export const calcLateFee = (lateDays, lateFeePerDay = 2500, quantity = 1) =>
  Math.max(0, Number(lateDays) * Number(lateFeePerDay) * Number(quantity || 1))

export const rentalAffectsInventory = (rental) => {
  const status = rental?.rentalStatus
  return ['Pending', 'Confirmed', 'Active', 'Overdue', 'Maintenance'].includes(status)
}

export const rentalIsStockOut = (rental) => {
  const status = rental?.rentalStatus
  return ['Confirmed', 'Active', 'Overdue', 'Maintenance'].includes(status)
}

export const getRentalStats = (rentals = [], products = [], today = new Date().toISOString().slice(0, 10)) => {
  const monthPrefix = today.slice(0, 7)
  const activeStatuses = ['Active', 'Overdue', 'Confirmed']
  const totalRentals = rentals.filter((r) => r.rentalStatus !== 'Cancelled').length
  const activeRentals = rentals.filter((r) => activeStatuses.includes(r.rentalStatus)).length
  const todayRentals = rentals.filter((r) => r.startDate === today).length
  const overdueRentals = rentals.filter((r) => r.rentalStatus === 'Overdue' || (r.rentalStatus === 'Active' && r.expectedReturn && r.expectedReturn < today)).length
  const rentalRevenue = rentals
    .filter((r) => !['Cancelled', 'Refunded'].includes(r.rentalStatus) && r.paymentStatus !== 'Refunded')
    .reduce((sum, r) => sum + Number(r.total || 0), 0)
  const availableForRental = products.reduce((sum, p) => sum + Number(p.available || 0), 0)

  const monthIncome = rentals
    .filter((r) => String(r.startDate).startsWith(monthPrefix) && r.rentalStatus !== 'Cancelled')
    .reduce((sum, r) => sum + Number(r.total || 0), 0)
  const todayIncome = rentals
    .filter((r) => r.startDate === today && r.rentalStatus !== 'Cancelled')
    .reduce((sum, r) => sum + Number(r.total || 0), 0)
  const pendingPayments = rentals
    .filter((r) => ['Pending', 'Partial', 'Overdue'].includes(r.paymentStatus))
    .reduce((sum, r) => sum + Number(r.balance || 0), 0)
  const depositsCollected = rentals
    .filter((r) => !['Cancelled'].includes(r.rentalStatus))
    .reduce((sum, r) => sum + Number(r.deposit || 0), 0)
  const outstanding = rentals.reduce((sum, r) => sum + Number(r.balance || 0), 0)
  const lateFees = rentals.reduce((sum, r) => sum + Number(r.lateFee || 0), 0)
  const damageCharges = rentals.reduce((sum, r) => sum + Number(r.damageFee || 0), 0)

  const dueToday = rentals.filter((r) => ['Active', 'Overdue', 'Confirmed'].includes(r.rentalStatus) && r.expectedReturn === today)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)
  const dueTomorrow = rentals.filter((r) => ['Active', 'Confirmed'].includes(r.rentalStatus) && r.expectedReturn === tomorrowStr)
  const returnedToday = rentals.filter((r) => r.actualReturnDate === today || (r.returnInfo?.returnDate === today))

  return {
    totalRentals,
    activeRentals,
    todayRentals,
    overdueRentals,
    rentalRevenue,
    availableForRental,
    monthIncome,
    todayIncome,
    pendingPayments,
    depositsCollected,
    outstanding,
    lateFees,
    damageCharges,
    dueToday,
    dueTomorrow,
    returnedToday,
  }
}

export const getProductRentalUsage = (rentals = [], products = []) => {
  return products.map((product) => {
    const related = rentals.filter((r) => {
      if (r.rentalStatus === 'Cancelled') return false
      if (Number(r.productId) === product.id) return true
      return (r.items || []).some((item) => Number(item.productId) === product.id)
    })
    const active = related.filter((r) =>
      ['Active', 'Overdue', 'Confirmed', 'Maintenance'].includes(r.rentalStatus)
    )
    const last = [...related].sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))[0]
    const qtyFor = (r) => {
      if (Number(r.productId) === product.id) return Number(r.quantity || 0)
      const item = (r.items || []).find((i) => Number(i.productId) === product.id)
      return Number(item?.quantity || 0)
    }
    return {
      productId: product.id,
      productName: product.name,
      image: product.image,
      rentalCount: related.length,
      rentalDays: related.reduce((sum, r) => sum + Number(r.duration || 0), 0),
      rentalIncome: related.reduce((sum, r) => sum + Number(r.total || 0), 0),
      currentlyRented: active.reduce((sum, r) => sum + qtyFor(r), 0),
      lastRented: last?.startDate || null,
      history: related,
    }
  })
}

export const emptyRentalForm = () => ({
  customerId: '',
  customer: '',
  customerPhone: '',
  customerEmail: '',
  customerAddress: '',
  productId: '',
  product: '',
  product_serial_number: '',
  productCategory: '',
  productImage: '',
  productCondition: '',
  quantity: 1,
  rate: '',
  startDate: new Date().toISOString().slice(0, 10),
  expectedReturn: '',
  discount: 0,
  deposit: '',
  lateFee: 0,
  damageFee: 0,
  amountPaid: 0,
  paymentStatus: 'Pending',
  paymentMethod: 'Cash',
  rentalStatus: 'Confirmed',
  notes: '',
  specialInstructions: '',
  deliveryNotes: '',
  branchId: '',
})

export const validateRentalForm = (form, products = []) => {
  const errors = {}
  if (!form.customerId && !form.customer?.trim()) errors.customer = 'Customer is required'
  if (!form.productId) errors.product = 'Product is required'
  if (!form.startDate) errors.startDate = 'Start date is required'
  if (form.startDate && form.expectedReturn && form.expectedReturn < form.startDate) {
    errors.expectedReturn = 'Return date must be after start date'
  }
  const qty = Number(form.quantity || 0)
  if (qty <= 0) errors.quantity = 'Quantity must be greater than 0'

  const product = products.find((p) => String(p.id) === String(form.productId))
  const available = Number(product?.available || 0) + Number(form._originalQty || 0)
  if (product && qty > available) {
    errors.quantity = `Only ${available} units are currently available for rental.`
    errors.stock = errors.quantity
  }
  if (form.rate === '' || Number(form.rate) < 0) errors.rate = 'Rental rate is required'
  return errors
}

export const normalizeRentalPayload = (form, rentalId) => {
  const duration = calcRentalDuration(form.startDate, form.expectedReturn)
  const totals = calcRentalTotals({
    rate: form.rate,
    duration,
    quantity: form.quantity,
    discount: form.discount,
    deposit: form.deposit,
    lateFee: form.lateFee,
    damageFee: form.damageFee,
    amountPaid: form.amountPaid,
  })

  return {
    rentalId,
    rentalNumber: rentalId,
    customerId: Number(form.customerId) || null,
    customer: form.customer,
    customerPhone: form.customerPhone,
    customerEmail: form.customerEmail,
    customerAddress: form.customerAddress,
    productId: Number(form.productId),
    product: form.product,
    product_serial_number: form.product_serial_number,
    productCategory: form.productCategory,
    productImage: form.productImage,
    productCondition: form.productCondition,
    quantity: Number(form.quantity),
    rate: Number(form.rate),
    startDate: form.startDate,
    expectedReturn: form.expectedReturn,
    actualReturnDate: form.actualReturnDate || null,
    duration,
    subtotal: totals.subtotal,
    discount: totals.discount,
    deposit: totals.deposit,
    lateFee: totals.lateFee,
    damageFee: totals.damageFee,
    total: totals.total,
    amountPaid: totals.amountPaid,
    balance: totals.balance,
    paymentStatus: form.paymentStatus,
    paymentMethod: form.paymentMethod,
    rentalStatus: form.rentalStatus,
    notes: form.notes || '',
    specialInstructions: form.specialInstructions || '',
    deliveryNotes: form.deliveryNotes || '',
    branchId: form.branchId || null,
    timeline: form.timeline || [
      { id: 1, event: 'Booking Created', date: form.startDate || new Date().toISOString().slice(0, 10) },
      ...(form.rentalStatus !== 'Pending'
        ? [{ id: 2, event: 'Booking Confirmed', date: form.startDate || new Date().toISOString().slice(0, 10) }]
        : []),
      ...(['Active', 'Overdue'].includes(form.rentalStatus)
        ? [
            { id: 3, event: 'Equipment Collected / Delivered', date: form.startDate },
            { id: 4, event: 'Rental Active', date: form.startDate },
            { id: 5, event: 'Return Due', date: form.expectedReturn },
          ]
        : []),
    ],
    returnInfo: form.returnInfo || null,
  }
}

export const DEFAULT_RENTAL_TIMELINE = [
  'Booking Created',
  'Booking Confirmed',
  'Equipment Collected / Delivered',
  'Rental Active',
  'Return Due',
  'Returned',
  'Inspection Completed',
]
