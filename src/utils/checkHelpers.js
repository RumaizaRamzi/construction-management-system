import {
  addDays,
  addMonths,
  addYears,
  format,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
} from 'date-fns'
import {
  CHECK_ASSIGNEES,
  CHECK_FREQUENCIES,
  CHECK_PRIORITIES,
  CHECK_STATUSES,
  REMINDER_OPTIONS,
} from '../data/checksData'

export {
  CHECK_ASSIGNEES,
  CHECK_FREQUENCIES,
  CHECK_PRIORITIES,
  CHECK_STATUSES,
  REMINDER_OPTIONS,
}

const toDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return value
  return parseISO(String(value).slice(0, 10))
}

const toISODate = (date) => (date ? format(date, 'yyyy-MM-dd') : null)

/**
 * Calculate next check date from check date + frequency.
 */
export const calcNextCheckDate = (checkDate, frequency) => {
  const base = toDate(checkDate)
  if (!base || !frequency) return null

  switch (frequency) {
    case 'One Time':
      return null
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

/**
 * Derive display status from stored status + check date relative to today.
 * Completed / Cancelled are never overridden.
 */
export const deriveCheckStatus = (check, today = new Date()) => {
  if (!check) return 'Scheduled'
  if (check.status === 'Completed' || check.status === 'Cancelled') {
    return check.status
  }

  const date = toDate(check.checkDate)
  if (!date) return check.status || 'Scheduled'

  const todayStart = startOfDay(today)
  const checkStart = startOfDay(date)

  if (isSameDay(checkStart, todayStart)) return 'Due Today'
  if (isBefore(checkStart, todayStart)) return 'Overdue'
  if (check.status === 'Scheduled') return 'Scheduled'
  return 'Upcoming'
}

export const getWeekEndISO = (today = new Date()) =>
  toISODate(addDays(startOfDay(today), 7))

export const getTodayISO = (today = new Date()) => toISODate(startOfDay(today))

export const getCheckStats = (checks = [], today = new Date()) => {
  const todayISO = getTodayISO(today)
  const weekEnd = getWeekEndISO(today)

  let dueToday = 0
  let dueThisWeek = 0
  let overdue = 0
  let completed = 0
  let upcoming = 0
  let scheduled = 0
  let cancelled = 0

  checks.forEach((c) => {
    const status = deriveCheckStatus(c, today)
    if (status === 'Completed') completed += 1
    else if (status === 'Cancelled') cancelled += 1
    else if (status === 'Overdue') overdue += 1
    else if (status === 'Due Today') dueToday += 1
    else if (status === 'Scheduled') scheduled += 1
    else upcoming += 1

    if (
      status !== 'Completed' &&
      status !== 'Cancelled' &&
      c.checkDate &&
      c.checkDate >= todayISO &&
      c.checkDate <= weekEnd
    ) {
      dueThisWeek += 1
    }
  })

  return {
    total: checks.length,
    dueToday,
    dueThisWeek,
    overdue,
    completed,
    upcoming: upcoming + scheduled,
    scheduled,
    cancelled,
  }
}

export const generateCheckId = (checks = []) => {
  const year = new Date().getFullYear()
  const prefix = `CHK-${year}-`
  const maxNum = checks.reduce((max, c) => {
    const match = String(c.checkId || c.checkNumber || '').match(/CHK-\d{4}-(\d+)/)
    return match ? Math.max(max, parseInt(match[1], 10)) : max
  }, 0)
  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`
}

export const emptyCheckForm = () => ({
  check: '',
  productId: '',
  product: '',
  category: '',
  description: '',
  checkDate: getTodayISO(),
  frequency: 'Monthly',
  assignedTo: '',
  priority: 'Medium',
  reminderBefore: '1 Day Before',
  notes: '',
  status: 'Scheduled',
  lastCompleted: null,
  nextCheck: '',
})

export const checkToForm = (check) => ({
  check: check.check || check.name || '',
  productId: check.productId ? String(check.productId) : '',
  product: check.product || '',
  category: check.category || '',
  description: check.description || '',
  checkDate: check.checkDate || getTodayISO(),
  frequency: check.frequency || 'Monthly',
  assignedTo: check.assignedTo || '',
  priority: check.priority || 'Medium',
  reminderBefore: check.reminderBefore || '1 Day Before',
  notes: check.notes || '',
  status: check.status || 'Scheduled',
  lastCompleted: check.lastCompleted || null,
  nextCheck: check.nextCheck || '',
})

export const normalizeCheckPayload = (form, checkId, existing = null) => {
  const nextCheck =
    form.frequency === 'One Time'
      ? null
      : calcNextCheckDate(form.checkDate, form.frequency)

  const derived = deriveCheckStatus(
    {
      ...form,
      status: existing?.status === 'Completed' || existing?.status === 'Cancelled'
        ? existing.status
        : form.status || 'Scheduled',
    },
    new Date()
  )

  return {
    checkId,
    checkNumber: checkId,
    check: form.check.trim(),
    name: form.check.trim(),
    productId: form.productId ? Number(form.productId) : null,
    product: form.product,
    category: form.category,
    description: form.description || '',
    checkDate: form.checkDate,
    frequency: form.frequency,
    assignedTo: form.assignedTo,
    lastCompleted: form.lastCompleted ?? existing?.lastCompleted ?? null,
    nextCheck,
    status:
      existing?.status === 'Completed' || existing?.status === 'Cancelled'
        ? existing.status
        : derived,
    priority: form.priority || 'Medium',
    reminderBefore: form.reminderBefore || '1 Day Before',
    reminder: true,
    notes: form.notes || '',
  }
}

export const validateCheckForm = (form) => {
  const errors = {}
  if (!form.check?.trim()) errors.check = 'Check name is required'
  if (!form.productId && !form.product?.trim()) errors.product = 'Product is required'
  if (!form.checkDate) errors.checkDate = 'Check date is required'
  if (!form.frequency) errors.frequency = 'Frequency is required'
  if (!form.assignedTo?.trim()) errors.assignedTo = 'Assignee is required'
  if (!form.priority) errors.priority = 'Priority is required'
  return errors
}

export const filterChecks = (checks, filters, today = new Date()) => {
  const q = (filters.search || '').trim().toLowerCase()
  return checks.filter((c) => {
    const status = deriveCheckStatus(c, today)
    if (q) {
      const haystack = `${c.checkId || ''} ${c.check || ''} ${c.product || ''} ${c.assignedTo || ''} ${c.category || ''}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (filters.product && c.product !== filters.product && String(c.productId) !== String(filters.product)) {
      return false
    }
    if (filters.category && c.category !== filters.category) return false
    if (filters.status && status !== filters.status) return false
    if (filters.priority && c.priority !== filters.priority) return false
    if (filters.assignedTo && c.assignedTo !== filters.assignedTo) return false
    if (filters.frequency && c.frequency !== filters.frequency) return false
    if (filters.dateFrom && c.checkDate < filters.dateFrom) return false
    if (filters.dateTo && c.checkDate > filters.dateTo) return false
    return true
  })
}

export const defaultCheckFilters = () => ({
  search: '',
  product: '',
  category: '',
  status: '',
  priority: '',
  assignedTo: '',
  frequency: '',
  dateFrom: '',
  dateTo: '',
})

export const CHECK_RESULTS = [
  'Passed',
  'Passed with Warning',
  'Failed',
  'Maintenance Required',
]

export const CONDITION_AFTER_OPTIONS = [
  'Excellent',
  'Good',
  'Fair',
  'Needs Attention',
  'Damaged',
]

export const DEFAULT_CHECK_TIMELINE = [
  'Check Created',
  'Reminder Scheduled',
  'Check Due',
  'Check Completed',
  'Next Check Scheduled',
]

/** Build timeline entries for display from check state + stored timeline. */
export const buildCheckTimeline = (check, today = new Date()) => {
  if (!check) return []

  const stored = Array.isArray(check.timeline) ? check.timeline : []
  const byEvent = Object.fromEntries(stored.map((e) => [e.event, e]))
  const status = deriveCheckStatus(check, today)
  const todayISO = getTodayISO(today)
  const createdDate = check.createdAt || check.checkDate

  const ensure = (event, date, note) => {
    if (!byEvent[event] && date) {
      byEvent[event] = { event, date, note }
    }
  }

  ensure('Check Created', createdDate)
  if (check.reminderBefore) {
    ensure('Reminder Scheduled', createdDate, check.reminderBefore)
  }

  if (
    check.checkDate &&
    (check.checkDate <= todayISO ||
      ['Due Today', 'Overdue', 'Completed'].includes(status) ||
      byEvent['Check Completed'])
  ) {
    ensure('Check Due', check.checkDate)
  }

  if (status === 'Completed' || check.lastCompleted) {
    ensure('Check Completed', check.lastCompleted || check.completion?.completionDate)
  }

  if (check.nextCheck && (status === 'Completed' || check.frequency !== 'One Time')) {
    ensure(
      'Next Check Scheduled',
      check.nextCheck,
      status === 'Completed' ? 'Based on frequency after completion' : undefined
    )
  }

  return DEFAULT_CHECK_TIMELINE.filter((step) => byEvent[step]).map((step, index) => ({
    id: index + 1,
    ...byEvent[step],
  }))
}

export const emptyCompletionForm = (check) => ({
  completionDate: getTodayISO(),
  performedBy: check?.assignedTo || '',
  result: 'Passed',
  conditionAfter: 'Good',
  issuesFound: '',
  maintenanceRequired: false,
  cost: '',
  notes: '',
})

export const applyCompleteCheck = (check, form) => {
  const completionDate = form.completionDate || getTodayISO()
  const nextCheck =
    check.frequency === 'One Time' ? null : calcNextCheckDate(completionDate, check.frequency)

  const existingTimeline = buildCheckTimeline({
    ...check,
    status: 'Completed',
    lastCompleted: completionDate,
    nextCheck,
  })

  const timeline = [
    ...existingTimeline.filter(
      (e) => !['Check Completed', 'Next Check Scheduled'].includes(e.event)
    ),
    {
      id: existingTimeline.length + 1,
      event: 'Check Completed',
      date: completionDate,
      note: form.result,
    },
    ...(nextCheck
      ? [
          {
            id: existingTimeline.length + 2,
            event: 'Next Check Scheduled',
            date: nextCheck,
            note: check.frequency,
          },
        ]
      : []),
  ]

  return {
    ...check,
    status: 'Completed',
    lastCompleted: completionDate,
    nextCheck,
    completion: {
      completionDate,
      performedBy: form.performedBy,
      result: form.result,
      conditionAfter: form.conditionAfter,
      issuesFound: form.issuesFound || '',
      maintenanceRequired: Boolean(form.maintenanceRequired) || form.result === 'Maintenance Required',
      cost: Number(form.cost) || 0,
      notes: form.notes || '',
    },
    notes: form.notes?.trim() ? form.notes : check.notes,
    timeline,
  }
}

export const applyRescheduleCheck = (check, form) => {
  const checkDate = form.checkDate
  const nextCheck =
    check.frequency === 'One Time' ? null : calcNextCheckDate(checkDate, check.frequency)

  const base = {
    ...check,
    checkDate,
    reminderBefore: form.reminderBefore || check.reminderBefore,
    notes: form.notes ?? check.notes,
    nextCheck,
    // Clear terminal status so date logic can reopen the check
    status: 'Upcoming',
  }

  const derived = deriveCheckStatus(base)
  const timeline = buildCheckTimeline({ ...base, status: derived })

  return {
    ...base,
    status: derived,
    timeline: [
      ...timeline.filter((e) => e.event !== 'Check Due'),
      ...(checkDate
        ? [{ id: timeline.length + 1, event: 'Check Due', date: checkDate, note: 'Rescheduled' }]
        : []),
    ],
  }
}

export const applyCancelCheck = (check) => ({
  ...check,
  status: 'Cancelled',
  timeline: [
    ...(check.timeline || buildCheckTimeline(check)),
    {
      id: Date.now(),
      event: 'Check Cancelled',
      date: getTodayISO(),
    },
  ],
})
