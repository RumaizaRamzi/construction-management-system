import { CheckCircle2, Circle } from 'lucide-react'
import ProductImage from '../ui/ProductImage'
import MaintenanceStatusBadge from './MaintenanceStatusBadge'
import PriorityBadge from '../checks/PriorityBadge'
import { DEFAULT_MAINTENANCE_TIMELINE } from '../../utils/maintenanceHelpers'
import { cn, formatCurrency, formatDateDMY } from '../../utils/helpers'

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <div className="text-sm font-medium text-slate-900 dark:text-white break-words">
        {children || '—'}
      </div>
    </div>
  )
}

function Timeline({ record }) {
  const events = record?.timeline || []
  const eventMap = Object.fromEntries(events.map((e) => [e.event, e]))

  const steps = [...DEFAULT_MAINTENANCE_TIMELINE]
  if (record?.status === 'On Hold' && !steps.includes('On Hold')) {
    steps.splice(3, 0, 'On Hold')
  }
  if (record?.status === 'Cancelled') {
    steps.push('Cancelled')
  }

  return (
    <div className="card p-5">
      <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-6">
        Activity Timeline
      </h3>
      <ol className="relative ml-3 space-y-0">
        {steps.map((step, index) => {
          const entry = eventMap[step]
          const completed = Boolean(entry)
          const isLast = index === steps.length - 1
          return (
            <li key={step} className="relative pb-6 last:pb-0 pl-6">
              {!isLast && (
                <span
                  className={cn(
                    'absolute left-0 top-5 bottom-0 w-px -translate-x-1/2',
                    completed ? 'bg-emerald-200 dark:bg-emerald-800' : 'bg-slate-200 dark:bg-slate-700'
                  )}
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  'absolute left-0 top-0.5 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-white dark:bg-slate-900',
                  completed ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                )}
              >
                {completed ? <CheckCircle2 size={20} /> : <Circle size={16} />}
              </span>
              <div>
                <p
                  className={cn(
                    'text-sm font-medium',
                    completed ? 'text-slate-900 dark:text-white' : 'text-slate-400'
                  )}
                >
                  {step}
                </p>
                {entry?.date && (
                  <p className="text-xs text-slate-500 mt-0.5">{formatDateDMY(entry.date)}</p>
                )}
                {entry?.note && (
                  <p className="text-xs text-slate-500 mt-1">{entry.note}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default function MaintenanceDetails({ record, product }) {
  if (!record) return null

  const image = record.productImage || product?.image
  const serialNumber = record.product_serial_number || product?.serial_number || '—'

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <p className="text-xs text-slate-500 font-medium">{record.maintenanceId}</p>
              <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white mt-1">
                {record.maintenanceType}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <MaintenanceStatusBadge status={record.status} record={record} />
              <PriorityBadge priority={record.priority} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Maintenance ID">{record.maintenanceId}</Field>
            <Field label="Maintenance Type">{record.maintenanceType}</Field>
            <Field label="Status">
              <MaintenanceStatusBadge status={record.status} record={record} />
            </Field>
            <Field label="Priority">
              <PriorityBadge priority={record.priority} />
            </Field>
            <Field label="Start Date">{formatDateDMY(record.startDate)}</Field>
            <Field label="Expected Completion">
              {formatDateDMY(record.expectedCompletion)}
            </Field>
            <Field label="Completed Date">{formatDateDMY(record.completedDate)}</Field>
            <Field label="Technician">{record.technician}</Field>
            <Field label="Estimated Cost">
              {formatCurrency(record.estimatedCost || record.cost)}
            </Field>
            <Field label="Cost">{formatCurrency(record.cost || record.estimatedCost)}</Field>
          </div>

          <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
            <Field label="Description">{record.description}</Field>
          </div>
          {record.notes && (
            <div className="mt-4">
              <Field label="Notes">{record.notes}</Field>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-5 space-y-4">
          <h3 className="font-display font-semibold text-slate-900 dark:text-white">
            Product Information
          </h3>
          <div className="flex items-center gap-4">
            <ProductImage src={image} alt={record.product} className="h-20 w-20" />
            <div className="min-w-0">
              <p className="font-medium text-slate-900 dark:text-white truncate">
                {record.product}
              </p>
              <p className="text-sm text-slate-500 mt-1">Serial Number: {serialNumber}</p>
              <p className="text-sm text-slate-500">
                {record.productCategory || product?.category || '—'}
              </p>
              {product?.status === 'Maintenance' && (
                <p className="mt-2 text-xs font-medium text-violet-600 dark:text-violet-400">
                  Product status: Maintenance (not available for rental)
                </p>
              )}
            </div>
          </div>
        </div>

        <Timeline record={record} />
      </div>
    </div>
  )
}
