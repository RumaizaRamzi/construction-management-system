import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import {
  CHECK_ASSIGNEES,
  CHECK_RESULTS,
  CONDITION_AFTER_OPTIONS,
  calcNextCheckDate,
  emptyCompletionForm,
} from '../../utils/checkHelpers'
import { formatCurrency, formatDateDMY } from '../../utils/helpers'

export default function CompleteCheckModal({ open, onClose, onSubmit, check }) {
  const [form, setForm] = useState(() => emptyCompletionForm(check))
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm(emptyCompletionForm(check))
      setErrors({})
    }
  }, [open, check])

  const nextPreview =
    check?.frequency === 'One Time'
      ? null
      : calcNextCheckDate(form.completionDate, check?.frequency)

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const nextErrors = {}
    if (!form.completionDate) nextErrors.completionDate = 'Completion date is required'
    if (!form.performedBy?.trim()) nextErrors.performedBy = 'Performed by is required'
    if (!form.result) nextErrors.result = 'Result is required'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    onSubmit?.(form)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mark as Completed"
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="complete-check-form" className="btn-primary">
            Complete Check
          </button>
        </>
      }
    >
      <form id="complete-check-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
          Completing <span className="font-medium text-slate-900 dark:text-white">{check?.check}</span>
          {check?.checkId ? ` (${check.checkId})` : ''}
        </div>

        <div>
          <label className="label">Completion Date</label>
          <input
            type="date"
            className="input-field"
            value={form.completionDate}
            onChange={(e) => setField('completionDate', e.target.value)}
          />
          {errors.completionDate && (
            <p className="mt-1 text-xs text-red-600">{errors.completionDate}</p>
          )}
        </div>

        <div>
          <label className="label">Performed By</label>
          <select
            className="input-field"
            value={form.performedBy}
            onChange={(e) => setField('performedBy', e.target.value)}
          >
            <option value="">Select person</option>
            {form.performedBy && !CHECK_ASSIGNEES.includes(form.performedBy) && (
              <option value={form.performedBy}>{form.performedBy}</option>
            )}
            {CHECK_ASSIGNEES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          {errors.performedBy && (
            <p className="mt-1 text-xs text-red-600">{errors.performedBy}</p>
          )}
        </div>

        <div>
          <label className="label">Result</label>
          <select
            className="input-field"
            value={form.result}
            onChange={(e) => {
              const result = e.target.value
              setForm((prev) => ({
                ...prev,
                result,
                maintenanceRequired: result === 'Maintenance Required' ? true : prev.maintenanceRequired,
              }))
            }}
          >
            {CHECK_RESULTS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Condition After Check</label>
          <select
            className="input-field"
            value={form.conditionAfter}
            onChange={(e) => setField('conditionAfter', e.target.value)}
          >
            {CONDITION_AFTER_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="label">Issues Found</label>
          <textarea
            className="input-field min-h-[72px]"
            value={form.issuesFound}
            onChange={(e) => setField('issuesFound', e.target.value)}
            placeholder="Describe any issues found during the check"
          />
        </div>

        <div>
          <label className="label">Cost (LKR)</label>
          <input
            type="number"
            min="0"
            className="input-field"
            value={form.cost}
            onChange={(e) => setField('cost', e.target.value)}
            placeholder="0"
          />
          {form.cost !== '' && Number(form.cost) > 0 && (
            <p className="mt-1 text-xs text-slate-500">{formatCurrency(form.cost)}</p>
          )}
        </div>

        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm pb-2">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={Boolean(form.maintenanceRequired)}
              onChange={(e) => setField('maintenanceRequired', e.target.checked)}
            />
            Maintenance Required
          </label>
        </div>

        <div>
          <label className="label">Next Check (calculated)</label>
          <input
            className="input-field bg-slate-50 dark:bg-slate-800/50"
            value={nextPreview ? formatDateDMY(nextPreview) : '— (One Time)'}
            readOnly
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea
            className="input-field min-h-[72px]"
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            placeholder="Optional completion notes"
          />
        </div>
      </form>
    </Modal>
  )
}
