import {
  differenceInCalendarDays,
  format,
  isBefore,
  parseISO,
  startOfDay,
} from 'date-fns'

export const NOTIFICATION_CATEGORIES = [
  'All',
  'Unread',
  'Rentals',
  'Bookings',
  'Inventory',
  'Maintenance',
  'Payments',
  'System',
]

export const NOTIFICATION_PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

export const REMINDER_TIMING_OPTIONS = [
  'Same Day',
  '1 Day Before',
  '2 Days Before',
  '3 Days Before',
  '7 Days Before',
]

export const DEFAULT_NOTIFICATION_SETTINGS = {
  enableNotifications: true,
  enableRentalReminders: true,
  enableLowStockAlerts: true,
  enableMaintenanceReminders: true,
  enablePaymentAlerts: true,
  enableBookingNotifications: true,
  reminderTiming: '1 Day Before',
}

const toDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return value
  return parseISO(String(value).slice(0, 10))
}

const toISODate = (date) => (date ? format(date, 'yyyy-MM-dd') : null)

export const getTodayISO = (today = new Date()) => toISODate(startOfDay(today))

const daysUntil = (dateStr, today) => {
  const d = toDate(dateStr)
  if (!d) return null
  return differenceInCalendarDays(startOfDay(d), startOfDay(today))
}

export const timingToDays = (timing) => {
  switch (timing) {
    case 'Same Day':
      return 0
    case '1 Day Before':
      return 1
    case '2 Days Before':
      return 2
    case '3 Days Before':
      return 3
    case '7 Days Before':
      return 7
    default:
      return 1
  }
}

const push = (list, item) => {
  list.push({
    read: false,
    type: item.type || 'Info',
    priority: item.priority || 'Medium',
    category: item.category || 'System',
    time: item.time || new Date().toISOString(),
    link: item.link || '/notifications',
    ...item,
  })
}

/**
 * Legacy client-side generator (not used by the app). Live notifications come from the
 * backend `notifications` table and the hourly `notifications:generate` job.
 */
export const generateNotifications = ({
  checks = [],
  rentals = [],
  products = [],
  maintenance = [],
  bookings = [],
  sales = [],
  settings = {},
  today = new Date(),
} = {}) => {
  const cfg = { ...DEFAULT_NOTIFICATION_SETTINGS, ...settings }
  if (!cfg.enableNotifications) return []

  const list = []
  const todayStart = startOfDay(today)
  const todayISO = getTodayISO(today)
  const windowDays = timingToDays(cfg.reminderTiming)

  // Low stock
  if (cfg.enableLowStockAlerts) {
    products.forEach((p) => {
      const available = Number(p.available || 0)
      const minStock = Number(p.minStock || 0)
      if (available <= minStock) {
        push(list, {
          id: `notif-stock-${p.id}`,
          title: `${p.name} stock is below minimum.`,
          message: `Available ${available} units (minimum ${minStock}). Restock recommended.`,
          category: 'Inventory',
          priority: available === 0 ? 'Critical' : 'High',
          type: available === 0 ? 'Urgent' : 'Warning',
          time: `${todayISO}T08:00:00`,
          link: `/products/${p.id}`,
        })
      }
    })
  }

  // Rentals
  if (cfg.enableRentalReminders) {
    rentals.forEach((r) => {
      if (['Returned', 'Cancelled', 'Completed'].includes(r.rentalStatus)) return
      const returnDate = r.expectedReturn
      if (!returnDate) return
      const delta = daysUntil(returnDate, today)
      if (delta === null) return
      const label = r.rentalId || r.rentalNumber || `Rental #${r.id}`

      if (delta < 0 || r.rentalStatus === 'Overdue') {
        push(list, {
          id: `notif-rental-overdue-${r.id}`,
          title: `Overdue rental return — ${r.product}.`,
          message: `${label} for ${r.customer} was due on ${returnDate}.`,
          category: 'Rentals',
          priority: 'Critical',
          type: 'Urgent',
          time: `${todayISO}T07:30:00`,
          link: `/rentals/${r.id}`,
        })
      } else if (delta <= windowDays) {
        push(list, {
          id: `notif-rental-due-${r.id}`,
          title:
            delta === 0
              ? 'Rental return due today.'
              : delta === 1
                ? `${r.product} rental return due tomorrow.`
                : `Rental return approaching — ${r.product}.`,
          message: `${label} expected return ${returnDate} (${r.customer}).`,
          category: 'Rentals',
          priority: delta === 0 ? 'High' : 'Medium',
          type: delta === 0 ? 'Warning' : 'Info',
          time: `${todayISO}T09:00:00`,
          link: `/rentals/${r.id}`,
        })
      }
    })
  }

  // Checks
  checks.forEach((c) => {
    if (['Completed', 'Cancelled'].includes(c.status)) return
    const checkDate = c.checkDate
    if (!checkDate) return
    const delta = daysUntil(checkDate, today)
    if (delta === null) return

    if (delta < 0) {
      push(list, {
        id: `notif-check-overdue-${c.id}`,
        title: `${c.product} inspection is overdue.`,
        message: `${c.check || 'Check'} (${c.checkId || c.id}) was due on ${checkDate}.`,
        category: 'Maintenance',
        priority: 'High',
        type: 'Urgent',
        time: `${todayISO}T07:45:00`,
        link: `/checks/${c.id}`,
      })
    } else if (delta <= windowDays) {
      push(list, {
        id: `notif-check-due-${c.id}`,
        title:
          delta === 0
            ? `${c.check || 'Check'} due today.`
            : delta === 1
              ? `${c.product} service due tomorrow.`
              : `Check approaching — ${c.product}.`,
        message: `${c.check || 'Equipment check'} scheduled for ${checkDate}.`,
        category: 'Maintenance',
        priority: delta === 0 ? 'High' : 'Medium',
        type: 'Warning',
        time: `${todayISO}T09:15:00`,
        link: `/checks/${c.id}`,
      })
    }
  })

  // Maintenance
  if (cfg.enableMaintenanceReminders) {
    products
      .filter((p) => p.status === 'Maintenance')
      .forEach((p) => {
        push(list, {
          id: `notif-maint-product-${p.id}`,
          title: `${p.name} is under maintenance.`,
          message: 'Product is marked Maintenance and unavailable for new rentals.',
          category: 'Maintenance',
          priority: 'Medium',
          type: 'Info',
          time: `${todayISO}T10:00:00`,
          link: '/maintenance',
        })
      })

    maintenance
      .filter((m) => ['Scheduled', 'In Progress', 'On Hold'].includes(m.status))
      .forEach((m) => {
        const overdue =
          m.expectedCompletion && isBefore(toDate(m.expectedCompletion), todayStart)
        push(list, {
          id: `notif-maint-job-${m.id}`,
          title: overdue
            ? `Maintenance overdue — ${m.product}.`
            : `Maintenance active — ${m.product}.`,
          message: `${m.maintenanceId}: ${m.maintenanceType} (${m.status}).`,
          category: 'Maintenance',
          priority: overdue ? 'High' : 'Medium',
          type: overdue ? 'Warning' : 'Info',
          time: `${todayISO}T10:30:00`,
          link: `/maintenance/${m.id}`,
        })
      })
  }

  // Payments
  if (cfg.enablePaymentAlerts) {
    sales.forEach((s) => {
      if (!['Pending', 'Partial', 'Overdue', 'Unpaid'].includes(s.paymentStatus)) return
      push(list, {
        id: `notif-pay-${s.id}`,
        title:
          s.paymentStatus === 'Overdue'
            ? `Payment overdue — ${s.invoiceNumber}.`
            : `Payment pending — ${s.invoiceNumber}.`,
        message: `${s.customer}: ${s.paymentStatus} balance on invoice ${s.invoiceNumber}.`,
        category: 'Payments',
        priority: s.paymentStatus === 'Overdue' ? 'Critical' : 'High',
        type: s.paymentStatus === 'Overdue' ? 'Urgent' : 'Warning',
        time: `${s.date || todayISO}T16:00:00`,
        link: `/sales/${s.id}`,
      })
    })

    rentals.forEach((r) => {
      if (!['Pending', 'Partial', 'Overdue', 'Unpaid'].includes(r.paymentStatus)) return
      push(list, {
        id: `notif-rental-pay-${r.id}`,
        title: `Rental payment ${r.paymentStatus.toLowerCase()}.`,
        message: `${r.rentalId || r.rentalNumber} — ${r.customer} (${r.product}).`,
        category: 'Payments',
        priority: r.paymentStatus === 'Overdue' ? 'Critical' : 'Medium',
        type: 'Warning',
        time: `${todayISO}T15:00:00`,
        link: `/rentals/${r.id}`,
      })
    })
  }

  // Bookings
  if (cfg.enableBookingNotifications) {
    bookings
      .filter((b) => ['Pending', 'Confirmed'].includes(b.status))
      .forEach((b) => {
        push(list, {
          id: `notif-booking-${b.id}`,
          title:
            b.status === 'Pending'
              ? 'New booking received.'
              : `Booking confirmed — ${b.product}.`,
          message: `${b.bookingNumber || b.bookingId}: ${b.customer} · ${b.quantity} × ${b.product} (${b.startDate}–${b.endDate}).`,
          category: 'Bookings',
          priority: b.status === 'Pending' ? 'High' : 'Medium',
          type: b.status === 'Pending' ? 'Warning' : 'Success',
          time: `${b.bookingDate || todayISO}T11:00:00`,
          link: '/bookings',
        })
      })
  }

  return list
}

export const mergeNotifications = (generated = [], seed = []) => {
  const map = new Map()
  ;[...generated, ...seed].forEach((n) => {
    const id = String(n.id)
    if (!map.has(id)) map.set(id, { ...n, id })
  })
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
  )
}

export const applyNotificationOverrides = (notifications, overrides = {}) =>
  notifications
    .filter((n) => !overrides[String(n.id)]?.deleted)
    .map((n) => {
      const o = overrides[String(n.id)]
      if (!o) return n
      return {
        ...n,
        read: o.read ?? n.read,
      }
    })

export const filterNotifications = (notifications, filters) => {
  const q = (filters.search || '').trim().toLowerCase()
  const category = filters.category || 'All'

  return notifications.filter((n) => {
    if (category === 'Unread' && n.read) return false
    if (category !== 'All' && category !== 'Unread' && n.category !== category) return false
    if (filters.priority && n.priority !== filters.priority) return false
    if (filters.readStatus === 'unread' && n.read) return false
    if (filters.readStatus === 'read' && !n.read) return false
    if (q) {
      const hay = `${n.title} ${n.message} ${n.category}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export const getNotificationStats = (notifications = []) => ({
  total: notifications.length,
  unread: notifications.filter((n) => !n.read).length,
  urgent: notifications.filter(
    (n) =>
      !n.read &&
      (n.priority === 'Critical' ||
        n.priority === 'High' ||
        n.type === 'Urgent' ||
        n.notificationType === 'Overdue Rental' ||
        n.notificationType === 'Payment Overdue')
  ).length,
  rentals: notifications.filter((n) => n.category === 'Rentals').length,
})

export const getDashboardAlertWidgets = ({
  checks = [],
  rentals = [],
  products = [],
  maintenance = [],
  today = new Date(),
}) => {
  const todayISO = getTodayISO(today)

  const upcomingChecks = checks.filter((c) => {
    if (['Completed', 'Cancelled'].includes(c.status)) return false
    const d = daysUntil(c.checkDate, today)
    return d !== null && d >= 0 && d <= 7
  })

  const overdueChecks = checks.filter((c) => {
    if (['Completed', 'Cancelled'].includes(c.status)) return false
    const d = daysUntil(c.checkDate, today)
    return d !== null && d < 0
  })

  const upcomingMaintenance = maintenance.filter((m) =>
    ['Scheduled', 'In Progress', 'On Hold'].includes(m.status)
  )

  const rentalReturnsDue = rentals.filter((r) => {
    if (['Returned', 'Cancelled', 'Completed'].includes(r.rentalStatus)) return false
    const d = daysUntil(r.expectedReturn, today)
    return d !== null && d <= 3
  })

  const lowStockAlerts = products.filter(
    (p) => Number(p.available || 0) <= Number(p.minStock || 0)
  )

  return {
    upcomingChecks,
    overdueChecks,
    upcomingMaintenance,
    rentalReturnsDue,
    lowStockAlerts,
    todayISO,
  }
}
