import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  format,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
} from 'date-fns'
import {
  REMINDER_FREQUENCIES,
  REMINDER_PRIORITIES,
  REMINDER_SOURCES,
  REMINDER_STATUSES,
  RECURRING_STATUSES,
} from '../data/remindersData'
import { isMaintenanceActive } from './maintenanceHelpers'

export {
  REMINDER_FREQUENCIES,
  REMINDER_PRIORITIES,
  REMINDER_SOURCES,
  REMINDER_STATUSES,
  RECURRING_STATUSES,
}

const toDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return value
  return parseISO(String(value).slice(0, 10))
}

export const toISODate = (date) => (date ? format(date, 'yyyy-MM-dd') : null)

export const getTodayISO = (today = new Date()) => toISODate(startOfDay(today))

export const calcNextReminderDate = (fromDate, frequency) => {
  const base = toDate(fromDate)
  if (!base || !frequency) return null
  switch (frequency) {
    case 'Daily':
      return toISODate(addDays(base, 1))
    case 'Weekly':
      return toISODate(addDays(base, 7))
    case 'Monthly':
      return toISODate(addMonths(base, 1))
    case 'Every 3 Months':
      return toISODate(addMonths(base, 3))
    case 'Every 6 Months':
      return toISODate(addMonths(base, 6))
    case 'Yearly':
      return toISODate(addYears(base, 1))
    default:
      return null
  }
}

const daysUntil = (dateStr, today) => {
  const d = toDate(dateStr)
  if (!d) return null
  return differenceInCalendarDays(startOfDay(d), startOfDay(today))
}

const pushReminder = (list, item) => {
  list.push({
    status: 'Unread',
    read: false,
    completed: false,
    snoozedUntil: null,
    ...item,
  })
}

/**
 * Generate frontend reminders from existing module data (no backend).
 */
export const generateReminders = ({
  checks = [],
  rentals = [],
  products = [],
  maintenance = [],
  recurring = [],
  today = new Date(),
} = {}) => {
  const list = []
  const todayStart = startOfDay(today)
  const todayISO = getTodayISO(today)

  // 1–2. Checks approaching / overdue
  checks.forEach((c) => {
    if (['Completed', 'Cancelled'].includes(c.status)) return
    const checkDate = c.checkDate
    if (!checkDate) return
    const delta = daysUntil(checkDate, today)
    if (delta === null) return

    if (delta < 0) {
      pushReminder(list, {
        id: `check-overdue-${c.id}`,
        title: `${c.product} inspection is overdue.`,
        product: c.product,
        productId: c.productId,
        date: checkDate,
        priority: c.priority === 'Critical' || c.priority === 'High' ? c.priority : 'High',
        source: 'Check',
        type: 'check_overdue',
        link: `/checks/${c.id}`,
        meta: c.checkId || c.check,
      })
    } else if (delta === 0) {
      pushReminder(list, {
        id: `check-today-${c.id}`,
        title: `${c.check || 'Equipment check'} due today.`,
        product: c.product,
        productId: c.productId,
        date: checkDate,
        priority: c.priority || 'High',
        source: 'Check',
        type: 'check_due_today',
        link: `/checks/${c.id}`,
        meta: c.checkId || c.check,
      })
    } else if (delta === 1) {
      pushReminder(list, {
        id: `check-tomorrow-${c.id}`,
        title: `${c.product} service due tomorrow.`,
        product: c.product,
        productId: c.productId,
        date: checkDate,
        priority: c.priority || 'Medium',
        source: 'Check',
        type: 'check_approaching',
        link: `/checks/${c.id}`,
        meta: c.checkId || c.check,
      })
    } else if (delta <= 7) {
      pushReminder(list, {
        id: `check-soon-${c.id}`,
        title: `${c.check || 'Check'} approaching for ${c.product}.`,
        product: c.product,
        productId: c.productId,
        date: checkDate,
        priority: c.priority || 'Medium',
        source: 'Check',
        type: 'check_approaching',
        link: `/checks/${c.id}`,
        meta: c.checkId || c.check,
      })
    }
  })

  // 3–4. Rental return approaching / overdue
  rentals.forEach((r) => {
    if (['Returned', 'Cancelled', 'Completed'].includes(r.rentalStatus)) return
    const returnDate = r.expectedReturn
    if (!returnDate) return
    const delta = daysUntil(returnDate, today)
    if (delta === null) return

    const rentalLabel = r.rentalId || r.rentalNumber || `Rental #${r.id}`

    if (delta < 0 || r.rentalStatus === 'Overdue') {
      pushReminder(list, {
        id: `rental-overdue-${r.id}`,
        title: `Rental return overdue — ${r.product}.`,
        product: r.product,
        productId: r.productId,
        date: returnDate,
        priority: 'Critical',
        source: 'Rental',
        type: 'rental_overdue',
        link: `/rentals/${r.id}`,
        meta: rentalLabel,
      })
    } else if (delta === 0) {
      pushReminder(list, {
        id: `rental-today-${r.id}`,
        title: 'Rental return due today.',
        product: r.product,
        productId: r.productId,
        date: returnDate,
        priority: 'High',
        source: 'Rental',
        type: 'rental_return',
        link: `/rentals/${r.id}`,
        meta: rentalLabel,
      })
    } else if (delta === 1) {
      pushReminder(list, {
        id: `rental-tomorrow-${r.id}`,
        title: `${r.product} rental return due tomorrow.`,
        product: r.product,
        productId: r.productId,
        date: returnDate,
        priority: 'High',
        source: 'Rental',
        type: 'rental_return',
        link: `/rentals/${r.id}`,
        meta: rentalLabel,
      })
    } else if (delta <= 3) {
      pushReminder(list, {
        id: `rental-soon-${r.id}`,
        title: `Rental return approaching — ${r.product}.`,
        product: r.product,
        productId: r.productId,
        date: returnDate,
        priority: 'Medium',
        source: 'Rental',
        type: 'rental_return',
        link: `/rentals/${r.id}`,
        meta: rentalLabel,
      })
    }
  })

  // 5. Low stock
  products.forEach((p) => {
    const available = Number(p.available || 0)
    const minStock = Number(p.minStock || 0)
    if (available <= minStock) {
      pushReminder(list, {
        id: `stock-low-${p.id}`,
        title: `${p.name} stock is below minimum level.`,
        product: p.name,
        productId: p.id,
        date: todayISO,
        priority: available === 0 ? 'Critical' : 'High',
        source: 'Stock',
        type: 'low_stock',
        link: `/products/${p.id}`,
        meta: `${available}/${minStock} min`,
      })
    }
  })

  // 6. Product under maintenance
  products
    .filter((p) => p.status === 'Maintenance')
    .forEach((p) => {
      pushReminder(list, {
        id: `maint-product-${p.id}`,
        title: `${p.name} is under maintenance.`,
        product: p.name,
        productId: p.id,
        date: todayISO,
        priority: 'Medium',
        source: 'Maintenance',
        type: 'maintenance',
        link: '/maintenance',
        meta: 'Product status',
      })
    })

  maintenance
    .filter((m) => isMaintenanceActive(m.status))
    .forEach((m) => {
      const overdue =
        m.expectedCompletion && isBefore(toDate(m.expectedCompletion), todayStart)
      pushReminder(list, {
        id: `maint-job-${m.id}`,
        title: overdue
          ? `Maintenance overdue — ${m.product}.`
          : `Maintenance in progress — ${m.product}.`,
        product: m.product,
        productId: m.productId,
        date: m.expectedCompletion || m.startDate || todayISO,
        priority: overdue ? 'High' : m.priority || 'Medium',
        source: 'Maintenance',
        type: 'maintenance',
        link: `/maintenance/${m.id}`,
        meta: m.maintenanceId,
      })
    })

  // Recurring schedules due soon
  recurring
    .filter((r) => r.status === 'Active' && r.nextReminder)
    .forEach((r) => {
      const delta = daysUntil(r.nextReminder, today)
      if (delta === null || delta > 7) return
      pushReminder(list, {
        id: `recurring-${r.id}-${r.nextReminder}`,
        title:
          delta < 0
            ? `Recurring reminder overdue: ${r.reminder}`
            : delta === 0
              ? `Recurring reminder due today: ${r.reminder}`
              : delta === 1
                ? `${r.reminder} due tomorrow.`
                : r.reminder,
        product: r.product,
        productId: r.productId,
        date: r.nextReminder,
        priority: r.priority || 'Medium',
        source: 'Recurring',
        type: 'recurring',
        link: '/reminders/recurring',
        meta: r.frequency,
      })
    })

  return list
}

/** Merge generated reminders with user overrides (read / complete / snooze). */
export const applyReminderOverrides = (reminders, overrides = {}) =>
  reminders
    .map((r) => {
      const o = overrides[r.id]
      if (!o) return r
      return {
        ...r,
        ...o,
        status: o.status || r.status,
        read: o.read ?? r.read,
        completed: o.completed ?? r.completed,
        snoozedUntil: o.snoozedUntil ?? r.snoozedUntil,
        date: o.date || r.date,
      }
    })
    .filter((r) => {
      // Hide permanently completed
      if (r.completed || r.status === 'Completed') return false
      // Hide until snooze date passes
      if (r.snoozedUntil && r.snoozedUntil > getTodayISO()) return false
      return true
    })

export const categorizeReminders = (reminders, today = new Date()) => {
  const todayStart = startOfDay(today)
  const tomorrow = addDays(todayStart, 1)
  const weekEnd = addDays(todayStart, 7)

  const buckets = {
    today: [],
    tomorrow: [],
    thisWeek: [],
    upcoming: [],
    overdue: [],
  }

  reminders.forEach((r) => {
    const d = toDate(r.date)
    if (!d) {
      buckets.upcoming.push(r)
      return
    }
    const day = startOfDay(d)
    if (isBefore(day, todayStart)) buckets.overdue.push(r)
    else if (isSameDay(day, todayStart)) buckets.today.push(r)
    else if (isSameDay(day, tomorrow)) buckets.tomorrow.push(r)
    else if (!isBefore(weekEnd, day)) buckets.thisWeek.push(r)
    else buckets.upcoming.push(r)
  })

  const sortByPriority = (a, b) => {
    const order = { Critical: 0, High: 1, Medium: 2, Low: 3 }
    return (order[a.priority] ?? 9) - (order[b.priority] ?? 9)
  }

  Object.keys(buckets).forEach((key) => {
    buckets[key].sort(sortByPriority)
  })

  return buckets
}

export const filterReminders = (reminders, filters) => {
  const q = (filters.search || '').trim().toLowerCase()
  return reminders.filter((r) => {
    if (q) {
      const hay = `${r.title} ${r.product} ${r.source} ${r.meta || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (filters.priority && r.priority !== filters.priority) return false
    if (filters.status) {
      const status = r.status || (r.read ? 'Read' : 'Unread')
      if (status !== filters.status) return false
    }
    if (filters.source && r.source !== filters.source) return false
    if (filters.dateFrom && r.date < filters.dateFrom) return false
    if (filters.dateTo && r.date > filters.dateTo) return false
    return true
  })
}

export const defaultReminderFilters = () => ({
  search: '',
  priority: '',
  status: '',
  source: '',
  dateFrom: '',
  dateTo: '',
})

export const emptyRecurringForm = () => ({
  reminder: '',
  productId: '',
  product: '',
  frequency: 'Monthly',
  nextReminder: getTodayISO(),
  lastSent: '',
  status: 'Active',
  priority: 'Medium',
  notes: '',
})

export const recurringToForm = (item) => ({
  reminder: item.reminder || '',
  productId: item.productId ? String(item.productId) : '',
  product: item.product || '',
  frequency: item.frequency || 'Monthly',
  nextReminder: item.nextReminder || getTodayISO(),
  lastSent: item.lastSent || '',
  status: item.status || 'Active',
  priority: item.priority || 'Medium',
  notes: item.notes || '',
})

export const validateRecurringForm = (form) => {
  const errors = {}
  if (!form.reminder?.trim()) errors.reminder = 'Reminder name is required'
  if (!form.product?.trim() && !form.productId) errors.product = 'Product is required'
  if (!form.frequency) errors.frequency = 'Frequency is required'
  if (!form.nextReminder) errors.nextReminder = 'Next reminder date is required'
  return errors
}

export const snoozeReminderOverride = (reminder, days = 1) => {
  const base = toDate(reminder.date) || new Date()
  const until = toISODate(addDays(base, days))
  return {
    status: 'Snoozed',
    snoozedUntil: until,
    date: until,
    read: true,
  }
}

export const SECTION_META = [
  { key: 'today', title: 'Today', tone: 'brand' },
  { key: 'tomorrow', title: 'Tomorrow', tone: 'blue' },
  { key: 'thisWeek', title: 'This Week', tone: 'violet' },
  { key: 'upcoming', title: 'Upcoming', tone: 'slate' },
  { key: 'overdue', title: 'Overdue', tone: 'red' },
]
