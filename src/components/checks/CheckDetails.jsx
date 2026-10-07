import ProductImage from '../ui/ProductImage'
import CheckStatusBadge from './CheckStatusBadge'
import PriorityBadge from './PriorityBadge'
import CheckTimeline from './CheckTimeline'
import { deriveCheckStatus } from '../../utils/checkHelpers'
import { formatCurrency, formatDateDMY } from '../../utils/helpers'

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

export default function CheckDetails({ check, product }) {
  if (!check) return null

  const status = deriveCheckStatus(check)
  const image = product?.image
  const serialNumber = product?.serial_number || '—'

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <p className="text-xs text-slate-500 font-medium">
                {check.checkId || check.checkNumber}
              </p>
              <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white mt-1">
                {check.check}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <CheckStatusBadge status={status} />
              <PriorityBadge priority={check.priority} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Check ID">{check.checkId || check.checkNumber}</Field>
            <Field label="Check Name">{check.check}</Field>
            <Field label="Status">
              <CheckStatusBadge status={status} />
            </Field>
            <Field label="Priority">
              <PriorityBadge priority={check.priority} />
            </Field>
            <Field label="Check Date">{formatDateDMY(check.checkDate)}</Field>
            <Field label="Frequency">{check.frequency}</Field>
            <Field label="Assigned To">{check.assignedTo}</Field>
            <Field label="Reminder">{check.reminderBefore || (check.reminder ? 'Enabled' : '—')}</Field>
            <Field label="Last Completed">{formatDateDMY(check.lastCompleted)}</Field>
            <Field label="Next Check">{formatDateDMY(check.nextCheck)}</Field>
          </div>

          {check.description && (
            <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
              <Field label="Description">{check.description}</Field>
            </div>
          )}

          {check.notes && (
            <div className="mt-4">
              <Field label="Notes">{check.notes}</Field>
            </div>
          )}
        </div>

        {check.completion && (
          <div className="card p-5">
            <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-4">
              Latest Completion
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Completion Date">
                {formatDateDMY(check.completion.completionDate)}
              </Field>
              <Field label="Performed By">{check.completion.performedBy}</Field>
              <Field label="Result">{check.completion.result}</Field>
              <Field label="Condition After Check">{check.completion.conditionAfter}</Field>
              <Field label="Maintenance Required">
                {check.completion.maintenanceRequired ? 'Yes' : 'No'}
              </Field>
              <Field label="Cost">
                {check.completion.cost ? formatCurrency(check.completion.cost) : '—'}
              </Field>
              <div className="sm:col-span-2">
                <Field label="Issues Found">{check.completion.issuesFound || 'None'}</Field>
              </div>
              {check.completion.notes && (
                <div className="sm:col-span-2">
                  <Field label="Completion Notes">{check.completion.notes}</Field>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="card p-5 space-y-4">
          <h3 className="font-display font-semibold text-slate-900 dark:text-white">
            Product Details
          </h3>
          <div className="flex items-center gap-4">
            <ProductImage src={image} alt={check.product} className="h-20 w-20" />
            <div className="min-w-0">
              <p className="font-medium text-slate-900 dark:text-white truncate">
                {check.product}
              </p>
              <p className="text-sm text-slate-500 mt-1">Serial Number: {serialNumber}</p>
              <p className="text-sm text-slate-500">{check.category || product?.category || '—'}</p>
            </div>
          </div>
          <div className="grid gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Field label="Product">{check.product}</Field>
            <Field label="Serial Number">{serialNumber}</Field>
            <Field label="Category">{check.category || product?.category}</Field>
          </div>
        </div>

        <CheckTimeline check={check} />
      </div>
    </div>
  )
}
