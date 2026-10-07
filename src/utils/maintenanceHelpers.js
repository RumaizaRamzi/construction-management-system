import {
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_STATUSES,
  MAINTENANCE_TECHNICIANS,
  MAINTENANCE_TYPES,
} from '../data/maintenanceData'
import { formatCurrency } from './helpers'
import { getStockStatus } from './productHelpers'

export {
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_STATUSES,
  MAINTENANCE_TECHNICIANS,
  MAINTENANCE_TYPES,
}

/** Statuses that keep a product marked as under maintenance. */
export const ACTIVE_MAINTENANCE_STATUSES = ['Scheduled', 'In Progress', 'On Hold']

export const DEFAULT_MAINTENANCE_TIMELINE = [
  'Maintenance Created',
  'Scheduled',
  'In Progress',
  'Completed',
]

export const getTodayISO = (today = new Date()) => today.toISOString().slice(0, 10)

export const isMaintenanceActive = (status) => ACTIVE_MAINTENANCE_STATUSES.includes(status)

/**
 * Display status — overdue if past expected completion and still active.
 */
export const deriveMaintenanceStatus = (record, today = new Date()) => {
  if (!record) return 'Scheduled'
  if (['Completed', 'Cancelled'].includes(record.status)) return record.status
  if (record.status === 'On Hold') return 'On Hold'

  const todayISO = getTodayISO(today)
  if (
    isMaintenanceActive(record.status) &&
    record.expectedCompletion &&
    record.expectedCompletion < todayISO &&
    record.status !== 'Scheduled'
  ) {
    // Keep In Progress / Scheduled visible; treat overdue as filterable flag via status label
    if (record.status === 'In Progress' || record.status === 'Scheduled') {
      return record.status === 'In Progress' ? 'In Progress' : 'Scheduled'
    }
  }
  return record.status || 'Scheduled'
}

export const isOverdueMaintenance = (record, today = new Date()) => {
  if (!record || ['Completed', 'Cancelled'].includes(record.status)) return false
  const todayISO = getTodayISO(today)
  return Boolean(record.expectedCompletion && record.expectedCompletion < todayISO)
}

export const generateMaintenanceId = (records = []) => {
  const year = new Date().getFullYear()
  const prefix = `MNT-${year}-`
  const maxNum = records.reduce((max, r) => {
    const match = String(r.maintenanceId || '').match(/MNT-\d{4}-(\d+)/)
    return match ? Math.max(max, parseInt(match[1], 10)) : max
  }, 0)
  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`
}

export const getMaintenanceStats = (records = [], today = new Date()) => {
  const todayISO = getTodayISO(today)
  const monthPrefix = todayISO.slice(0, 7)

  const underMaintenance = records.filter((r) => isMaintenanceActive(r.status)).length
  const scheduled = records.filter((r) => r.status === 'Scheduled').length
  const overdue = records.filter((r) => isOverdueMaintenance(r, today)).length
  const maintenanceCost = records
    .filter((r) => r.status !== 'Cancelled')
    .reduce((sum, r) => sum + (Number(r.cost) || Number(r.estimatedCost) || 0), 0)
  const completedThisMonth = records.filter(
    (r) =>
      r.status === 'Completed' &&
      (r.completedDate || r.expectedCompletion || '').startsWith(monthPrefix)
  ).length

  return {
    underMaintenance,
    scheduled,
    overdue,
    maintenanceCost,
    maintenanceCostLabel: formatCurrency(maintenanceCost),
    completedThisMonth,
  }
}

export const emptyMaintenanceForm = () => ({
  productId: '',
  product: '',
  product_serial_number: '',
  productCategory: '',
  productImage: '',
  maintenanceType: 'Service',
  description: '',
  startDate: getTodayISO(),
  expectedCompletion: '',
  technician: '',
  estimatedCost: '',
  cost: '',
  priority: 'Medium',
  status: 'Scheduled',
  notes: '',
})

export const maintenanceToForm = (record) => ({
  productId: record.productId ? String(record.productId) : '',
  product: record.product || '',
  product_serial_number: record.product_serial_number || '',
  productCategory: record.productCategory || '',
  productImage: record.productImage || '',
  maintenanceType: record.maintenanceType || 'Service',
  description: record.description || '',
  startDate: record.startDate || getTodayISO(),
  expectedCompletion: record.expectedCompletion || '',
  technician: record.technician || '',
  estimatedCost: record.estimatedCost ?? record.cost ?? '',
  cost: record.cost ?? '',
  priority: record.priority || 'Medium',
  status: record.status || 'Scheduled',
  notes: record.notes || '',
})

export const validateMaintenanceForm = (form) => {
  const errors = {}
  if (!form.productId && !form.product?.trim()) errors.product = 'Product is required'
  if (!form.maintenanceType) errors.maintenanceType = 'Type is required'
  if (!form.description?.trim()) errors.description = 'Description is required'
  if (!form.startDate) errors.startDate = 'Start date is required'
  if (!form.expectedCompletion) errors.expectedCompletion = 'Expected completion is required'
  if (
    form.startDate &&
    form.expectedCompletion &&
    form.expectedCompletion < form.startDate
  ) {
    errors.expectedCompletion = 'Expected completion must be on or after start date'
  }
  if (!form.technician?.trim()) errors.technician = 'Technician is required'
  return errors
}

export const normalizeMaintenancePayload = (form, maintenanceId, existing = null) => {
  const cost = Number(form.cost || form.estimatedCost || 0)
  const estimatedCost = Number(form.estimatedCost || form.cost || 0)
  const status = form.status || existing?.status || 'Scheduled'
  const today = getTodayISO()

  let timeline = existing?.timeline ? [...existing.timeline] : []
  if (!existing) {
    timeline = [
      { id: 1, event: 'Maintenance Created', date: today },
      { id: 2, event: 'Scheduled', date: today },
    ]
    if (status === 'In Progress') {
      timeline.push({ id: 3, event: 'In Progress', date: form.startDate || today })
    }
  }

  return {
    maintenanceId,
    productId: form.productId ? Number(form.productId) : null,
    product: form.product,
    product_serial_number: form.product_serial_number,
    productCategory: form.productCategory,
    productImage: form.productImage,
    maintenanceType: form.maintenanceType,
    description: form.description.trim(),
    startDate: form.startDate,
    expectedCompletion: form.expectedCompletion,
    completedDate: existing?.completedDate || null,
    technician: form.technician,
    cost,
    estimatedCost,
    priority: form.priority || 'Medium',
    status,
    notes: form.notes || '',
    timeline,
  }
}

export const appendTimeline = (record, event, note = '') => {
  const timeline = [...(record.timeline || [])]
  timeline.push({
    id: timeline.length + 1,
    event,
    date: getTodayISO(),
    note: note || undefined,
  })
  return timeline
}

export const startMaintenance = (record) => ({
  ...record,
  status: 'In Progress',
  timeline: appendTimeline(record, 'In Progress'),
})

export const completeMaintenance = (record, completedDate = getTodayISO()) => ({
  ...record,
  status: 'Completed',
  completedDate,
  cost: Number(record.cost) || Number(record.estimatedCost) || 0,
  timeline: appendTimeline(record, 'Completed', 'Maintenance finished'),
})

export const cancelMaintenance = (record) => ({
  ...record,
  status: 'Cancelled',
  timeline: appendTimeline(record, 'Cancelled'),
})

export const holdMaintenance = (record) => ({
  ...record,
  status: 'On Hold',
  timeline: appendTimeline(record, 'On Hold'),
})

export const markProductUnderMaintenance = (product) => {
  if (!product) return product
  return {
    ...product,
    status: 'Maintenance',
    usageHistory: [
      ...(product.usageHistory || []),
      {
        id: (product.usageHistory?.length || 0) + 1,
        event: 'Maintenance',
        date: getTodayISO(),
        note: 'Sent to maintenance',
      },
    ],
    recentActivity: [
      {
        id: 1,
        text: 'Product under maintenance',
        date: getTodayISO(),
      },
      ...(product.recentActivity || []).slice(0, 3),
    ],
  }
}

export const releaseProductFromMaintenance = (product) => {
  if (!product) return product
  const withoutFlag = { ...product, status: undefined }
  const status = getStockStatus(withoutFlag)
  return {
    ...product,
    status,
    usageHistory: [
      ...(product.usageHistory || []),
      {
        id: (product.usageHistory?.length || 0) + 1,
        event: 'Available',
        date: getTodayISO(),
        note: 'Released from maintenance',
      },
    ],
    recentActivity: [
      {
        id: 1,
        text: 'Returned to available inventory',
        date: getTodayISO(),
      },
      ...(product.recentActivity || []).slice(0, 3),
    ],
  }
}

export const productHasActiveMaintenance = (productId, records = [], excludeId = null) =>
  records.some(
    (r) =>
      Number(r.productId) === Number(productId) &&
      r.id !== excludeId &&
      isMaintenanceActive(r.status)
  )

export const filterMaintenance = (records, filters, today = new Date()) => {
  const q = (filters.search || '').trim().toLowerCase()
  return records.filter((r) => {
    if (q) {
      const haystack =
        `${r.maintenanceId} ${r.product} ${r.maintenanceType} ${r.description} ${r.technician}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (filters.product && r.product !== filters.product && String(r.productId) !== String(filters.product)) {
      return false
    }
    if (filters.maintenanceType && r.maintenanceType !== filters.maintenanceType) return false
    if (filters.status) {
      if (filters.status === 'Overdue') {
        if (!isOverdueMaintenance(r, today)) return false
      } else if (r.status !== filters.status) {
        return false
      }
    }
    if (filters.priority && r.priority !== filters.priority) return false
    if (filters.technician && r.technician !== filters.technician) return false
    if (filters.dateFrom && r.startDate < filters.dateFrom) return false
    if (filters.dateTo && r.startDate > filters.dateTo) return false
    return true
  })
}

export const defaultMaintenanceFilters = () => ({
  search: '',
  product: '',
  maintenanceType: '',
  status: '',
  priority: '',
  technician: '',
  dateFrom: '',
  dateTo: '',
})

/** Products available for new rentals (excludes Maintenance status). */
export const isProductRentable = (product) =>
  product && product.status !== 'Maintenance' && Number(product.available) > 0
