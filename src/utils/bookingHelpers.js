import { daysBetween } from './helpers'
import { BOOKING_STATUSES, DELIVERY_METHODS } from '../data/bookingsData'

export { BOOKING_STATUSES, DELIVERY_METHODS }

const ACTIVE_BOOKING_STATUSES = ['Pending', 'Confirmed', 'Active']

export const generateBookingNumber = (bookings = []) => {
  const year = new Date().getFullYear()
  const prefix = `BKG-${year}-`
  const maxNum = bookings.reduce((max, b) => {
    const match = String(b.bookingNumber || b.bookingId || '').match(/BKG-\d{4}-(\d+)/)
    return match ? Math.max(max, parseInt(match[1], 10)) : max
  }, 0)
  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`
}

export const calcBookingDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return 0
  return Math.max(daysBetween(startDate, endDate), 1)
}

// Rentals saved without an expected return date hold their units indefinitely.
const rentalEnd = (r) => r.expectedReturn || '9999-12-31'

export const datesOverlap = (startA, endA, startB, endB) => {
  if (!startA || !endA || !startB || !endB) return false
  return startA <= endB && endA >= startB
}

/**
 * Units of a product already committed (bookings + active rentals) overlapping a date range.
 */
export const getCommittedQuantity = ({
  productId,
  startDate,
  endDate,
  bookings = [],
  rentals = [],
  excludeBookingId = null,
}) => {
  const fromBookings = bookings
    .filter(
      (b) =>
        Number(b.productId) === Number(productId) &&
        ACTIVE_BOOKING_STATUSES.includes(b.status) &&
        b.id !== excludeBookingId &&
        datesOverlap(startDate, endDate, b.startDate, b.endDate)
    )
    .reduce((sum, b) => sum + Number(b.quantity || 0), 0)

  const fromRentals = rentals
    .filter(
      (r) =>
        Number(r.productId) === Number(productId) &&
        ['Confirmed', 'Active', 'Overdue', 'Maintenance'].includes(r.rentalStatus) &&
        datesOverlap(startDate, endDate, r.startDate, rentalEnd(r))
    )
    .reduce((sum, r) => sum + Number(r.quantity || 0), 0)

  return fromBookings + fromRentals
}

export const checkAvailability = ({
  product,
  quantity,
  startDate,
  endDate,
  bookings = [],
  rentals = [],
  excludeBookingId = null,
}) => {
  if (!product || !startDate || !endDate) {
    return {
      available: false,
      availableUnits: 0,
      totalUnits: product?.quantity || 0,
      booked: 0,
      rented: 0,
      conflicts: [],
      message: 'Select product and dates to check availability.',
    }
  }

  const totalUnits = Number(product.quantity || 0)
  const qty = Number(quantity || 0)

  const overlappingBookings = bookings.filter(
    (b) =>
      Number(b.productId) === Number(product.id) &&
      ACTIVE_BOOKING_STATUSES.includes(b.status) &&
      b.id !== excludeBookingId &&
      datesOverlap(startDate, endDate, b.startDate, b.endDate)
  )

  const overlappingRentals = rentals.filter(
    (r) =>
      Number(r.productId) === Number(product.id) &&
      ['Confirmed', 'Active', 'Overdue', 'Maintenance'].includes(r.rentalStatus) &&
      datesOverlap(startDate, endDate, r.startDate, rentalEnd(r))
  )

  const booked = overlappingBookings.reduce((sum, b) => sum + Number(b.quantity || 0), 0)
  const rented = overlappingRentals.reduce((sum, r) => sum + Number(r.quantity || 0), 0)
  const availableUnits = Math.max(0, totalUnits - booked - rented)
  const isAvailable = qty > 0 && qty <= availableUnits

  const conflicts = [
    ...overlappingBookings.map((b) => ({
      type: 'booking',
      id: b.bookingNumber || b.bookingId,
      customer: b.customer,
      startDate: b.startDate,
      endDate: b.endDate,
      quantity: b.quantity,
    })),
    ...overlappingRentals.map((r) => ({
      type: 'rental',
      id: r.rentalId || r.rentalNumber,
      customer: r.customer,
      startDate: r.startDate,
      endDate: r.expectedReturn,
      quantity: r.quantity,
    })),
  ]

  return {
    available: isAvailable,
    availableUnits,
    totalUnits,
    booked,
    rented,
    conflicts,
    message: isAvailable
      ? `✓ ${availableUnits} unit${availableUnits === 1 ? '' : 's'} available for these dates.`
      : `⚠ Only ${availableUnits} unit${availableUnits === 1 ? '' : 's'} are available during the selected period.`,
  }
}

export const getDayAvailability = ({
  product,
  date,
  bookings = [],
  rentals = [],
}) => {
  if (!product || !date) return { status: 'Available', booked: 0, rented: 0, available: product?.quantity || 0 }
  const total = Number(product.quantity || 0)
  const booked = bookings
    .filter(
      (b) =>
        Number(b.productId) === Number(product.id) &&
        ACTIVE_BOOKING_STATUSES.includes(b.status) &&
        date >= b.startDate &&
        date <= b.endDate
    )
    .reduce((sum, b) => sum + Number(b.quantity || 0), 0)
  const rented = rentals
    .filter(
      (r) =>
        Number(r.productId) === Number(product.id) &&
        ['Confirmed', 'Active', 'Overdue', 'Maintenance'].includes(r.rentalStatus) &&
        date >= r.startDate &&
        date <= rentalEnd(r)
    )
    .reduce((sum, r) => sum + Number(r.quantity || 0), 0)
  const available = Math.max(0, total - booked - rented)
  let status = 'Available'
  if (available === 0) status = 'Rented'
  else if (booked + rented > 0) status = 'Partial'
  return { status, booked, rented, available, total }
}

export const calcBookingEstimate = ({ rate = 0, duration = 0, quantity = 1, discount = 0, deposit = 0 }) => {
  const subtotal = Number(rate) * Number(duration) * Number(quantity)
  const estimatedAmount = Math.max(0, subtotal - Number(discount || 0))
  return {
    subtotal,
    discount: Number(discount || 0),
    estimatedAmount,
    deposit: Number(deposit || 0),
  }
}

export const getBookingStats = (bookings = [], today = new Date().toISOString().slice(0, 10)) => {
  const total = bookings.length
  const pending = bookings.filter((b) => b.status === 'Pending').length
  const confirmed = bookings.filter((b) => b.status === 'Confirmed').length
  const active = bookings.filter((b) => b.status === 'Active').length
  const upcoming = bookings.filter(
    (b) => ['Pending', 'Confirmed'].includes(b.status) && b.startDate >= today
  ).length
  const cancelled = bookings.filter((b) => b.status === 'Cancelled' || b.status === 'Rejected').length
  const completed = bookings.filter((b) => b.status === 'Completed').length
  const revenueEstimate = bookings
    .filter((b) => !['Cancelled', 'Rejected'].includes(b.status))
    .reduce((sum, b) => sum + Number(b.estimatedAmount || 0), 0)

  return { total, pending, confirmed, active, upcoming, cancelled, completed, revenueEstimate }
}

export const emptyBookingForm = () => ({
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
  quantity: 1,
  bookingDate: new Date().toISOString().slice(0, 10),
  startDate: '',
  endDate: '',
  rentalRate: '',
  discount: 0,
  deposit: '',
  status: 'Pending',
  notes: '',
  specialInstructions: '',
  deliveryMethod: 'Delivery',
})

export const validateBookingForm = (form, availability) => {
  const errors = {}
  if (!form.customerId && !form.customer?.trim()) errors.customer = 'Customer is required'
  if (!form.productId) errors.product = 'Product is required'
  if (!form.startDate) errors.startDate = 'Start date is required'
  if (!form.endDate) errors.endDate = 'End date is required'
  if (form.startDate && form.endDate && form.endDate < form.startDate) {
    errors.endDate = 'End date must be after start date'
  }
  if (Number(form.quantity || 0) <= 0) errors.quantity = 'Quantity must be greater than 0'
  if (availability && !availability.available) {
    errors.availability = availability.message
    errors.quantity = availability.message
  }
  return errors
}

export const normalizeBookingPayload = (form, bookingNumber) => {
  const duration = calcBookingDuration(form.startDate, form.endDate)
  const estimate = calcBookingEstimate({
    rate: form.rentalRate,
    duration,
    quantity: form.quantity,
    discount: form.discount,
    deposit: form.deposit,
  })

  return {
    bookingNumber,
    bookingId: bookingNumber,
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
    quantity: Number(form.quantity),
    bookingDate: form.bookingDate || new Date().toISOString().slice(0, 10),
    startDate: form.startDate,
    endDate: form.endDate,
    duration,
    rentalRate: Number(form.rentalRate),
    discount: estimate.discount,
    estimatedAmount: estimate.estimatedAmount,
    deposit: estimate.deposit,
    status: form.status || 'Pending',
    notes: form.notes || '',
    specialInstructions: form.specialInstructions || '',
    deliveryMethod: form.deliveryMethod || 'Delivery',
    timeline: form.timeline || [
      { id: 1, event: 'Booking Created', date: form.bookingDate || new Date().toISOString().slice(0, 10) },
      { id: 2, event: 'Availability Checked', date: form.bookingDate || new Date().toISOString().slice(0, 10) },
      ...(form.status === 'Confirmed' || form.status === 'Active'
        ? [{ id: 3, event: 'Booking Confirmed', date: form.bookingDate || new Date().toISOString().slice(0, 10) }]
        : []),
    ],
    rentalId: form.rentalId || null,
  }
}

export const DEFAULT_BOOKING_TIMELINE = [
  'Booking Created',
  'Availability Checked',
  'Booking Confirmed',
  'Rental Started',
  'Rental Active',
  'Completed',
]

export const EVENT_TYPES = [
  { key: 'all', label: 'All Events' },
  { key: 'booking', label: 'Bookings', color: '#3b82f6' },
  { key: 'rental', label: 'Rentals', color: '#f59e0b' },
  { key: 'return', label: 'Returns', color: '#8b5cf6' },
  { key: 'check', label: 'Checks', color: '#64748b' },
  { key: 'maintenance', label: 'Maintenance', color: '#0f766e' },
  { key: 'sale', label: 'Sales', color: '#10b981' },
  { key: 'payment', label: 'Payments', color: '#ef4444' },
  { key: 'reminder', label: 'Reminders', color: '#ec4899' },
  { key: 'vehicle_rental', label: 'Vehicle Rentals', color: '#0ea5e9' },
]

/** A rental leaves the active calendar only once it is both fully returned and fully paid. */
export const isRentalSettled = (rental) => {
  const returned =
    rental.rentalStatus === 'Returned' ||
    (rental.rentalStatus === 'Maintenance' && Boolean(rental.actualReturnDate))
  const fullyPaid = rental.paymentStatus === 'Paid' && Number(rental.balance || 0) <= 0
  return returned && fullyPaid
}

/** Build unified calendar events from live app data */
export const buildCalendarEvents = ({
  bookings = [],
  rentals = [],
  sales = [],
  checks = [],
  maintenance = [],
  reminders = [],
  vehicleRentals = [],
  staticEvents = [],
}) => {
  const events = []

  bookings
    .filter((b) => !['Cancelled', 'Rejected'].includes(b.status))
    .forEach((b) => {
      events.push({
        id: `bk-start-${b.id}`,
        title: `${b.product} Booking`,
        date: b.startDate,
        endDate: b.endDate,
        type: 'booking',
        color: '#3b82f6',
        customer: b.customer,
        product: b.product,
        status: b.status,
        notes: b.notes,
        refId: b.id,
        refPath: '/bookings',
      })
    })

  rentals.forEach((r) => {
    if (['Cancelled'].includes(r.rentalStatus) || isRentalSettled(r)) return
    events.push({
      id: `rn-start-${r.id}`,
      title: `${r.product} Rental`,
      date: r.startDate,
      endDate: r.expectedReturn,
      type: 'rental',
      color: '#f59e0b',
      customer: r.customer,
      product: r.product,
      status: r.rentalStatus,
      notes: r.notes,
      refId: r.id,
      refPath: `/rentals/${r.id}`,
    })
    if (!r.expectedReturn) return
    events.push({
      id: `rn-return-${r.id}`,
      title: `${r.product} Return`,
      date: r.expectedReturn,
      type: 'return',
      color: '#8b5cf6',
      customer: r.customer,
      product: r.product,
      status: r.rentalStatus,
      notes: 'Expected return',
      refId: r.id,
      refPath: `/rentals/${r.id}`,
    })
  })

  sales.forEach((s) => {
    events.push({
      id: `sale-${s.id}`,
      title: `Sale ${s.invoiceNumber}`,
      date: s.date,
      type: 'sale',
      color: '#10b981',
      customer: s.customer,
      product: s.products,
      status: s.saleStatus || s.paymentStatus,
      notes: '',
      refId: s.id,
      refPath: `/sales/${s.id}`,
    })
    if (['Pending', 'Partial', 'Overdue', 'Unpaid'].includes(s.paymentStatus)) {
      events.push({
        id: `pay-${s.id}`,
        title: `Payment Due ${s.invoiceNumber}`,
        date: s.date,
        type: 'payment',
        color: '#ef4444',
        customer: s.customer,
        product: s.products,
        status: s.paymentStatus,
        notes: 'Payment outstanding',
        refId: s.id,
        refPath: `/sales/${s.id}`,
      })
    }
  })

  checks.forEach((c) => {
    if (['Cancelled'].includes(c.status)) return
    events.push({
      id: `chk-${c.id}`,
      title: c.check || c.name || 'Equipment Check',
      date: c.checkDate || c.scheduledDate,
      type: 'check',
      color: '#64748b',
      customer: c.assignedTo,
      product: c.product,
      status: c.status,
      notes: c.frequency,
      refId: c.id,
      refPath: `/checks/${c.id}`,
    })
  })

  maintenance.forEach((m) => {
    if (['Cancelled'].includes(m.status)) return
    events.push({
      id: `mnt-${m.id}`,
      title: `${m.product || 'Equipment'} Maintenance`,
      date: m.startDate || m.scheduledDate,
      endDate: m.expectedCompletion || m.completedDate || undefined,
      type: 'maintenance',
      color: '#0f766e',
      customer: m.technician,
      product: m.product,
      status: m.status,
      notes: m.maintenanceType || m.description,
      refId: m.id,
      refPath: `/maintenance/${m.id}`,
    })
  })

  reminders.forEach((r) => {
    if (['Completed', 'Dismissed', 'Paused'].includes(r.apiStatus) || ['Completed', 'Paused'].includes(r.status)) return
    events.push({
      id: `rem-${r.id}`,
      title: r.title || r.reminder || 'Reminder',
      date: r.dueDate || r.date || r.nextReminder,
      type: 'reminder',
      color: '#ec4899',
      customer: r.product || '',
      product: r.product || '',
      status: r.apiStatus || r.status,
      notes: r.description || r.message || '',
      refId: r.id,
      refPath: '/reminders',
    })
  })

  vehicleRentals.forEach((v) => {
    if (v.status !== 'Active') return
    const vehicle = v.vehicleRegistration ? `${v.vehicleName} (${v.vehicleRegistration})` : v.vehicleName
    events.push({
      id: `vr-${v.id}`,
      title: `${v.vehicleName || 'Vehicle'} – Vehicle Rental`,
      date: v.startDate,
      endDate: v.expectedReturnDate || undefined,
      type: 'vehicle_rental',
      color: '#0ea5e9',
      customer: v.customerName,
      product: vehicle,
      status: v.status,
      notes: v.rentalNumber,
      refId: v.id,
      refPath: `/vehicles/${v.vehicleId}`,
    })
  })

  staticEvents.forEach((e) => {
    events.push({
      ...e,
      id: e.id?.toString().startsWith('static-') ? e.id : `static-${e.id}`,
    })
  })

  return events
}

export const bookingToRentalFormState = (booking) => ({
  customerId: String(booking.customerId || ''),
  customer: booking.customer || '',
  customerPhone: booking.customerPhone || '',
  customerEmail: booking.customerEmail || '',
  customerAddress: booking.customerAddress || '',
  productId: String(booking.productId || ''),
  product: booking.product || '',
  product_serial_number: booking.product_serial_number || '',
  productCategory: booking.productCategory || '',
  productImage: booking.productImage || '',
  productCondition: '',
  quantity: booking.quantity || 1,
  rate: booking.rentalRate || '',
  startDate: booking.startDate || '',
  expectedReturn: booking.endDate || '',
  discount: booking.discount || 0,
  deposit: booking.deposit || '',
  lateFee: 0,
  damageFee: 0,
  amountPaid: 0,
  paymentStatus: 'Pending',
  paymentMethod: 'Cash',
  rentalStatus: 'Confirmed',
  notes: booking.notes ? `Converted from ${booking.bookingNumber}. ${booking.notes}` : `Converted from ${booking.bookingNumber}`,
  specialInstructions: booking.specialInstructions || '',
  deliveryNotes: booking.deliveryMethod || '',
  fromBookingId: booking.id,
})
