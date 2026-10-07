import { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal'
import {
  REMINDER_OPTIONS,
  calcNextCheckDate,
} from '../../utils/checkHelpers'
import { formatDateDMY } from '../../utils/helpers'

export default function RescheduleCheckModal({ open, onClose, onSubmit, check }) {
  const [form, setForm] = useState({
    checkDate: '',
    reminderBefore: '1 Day Before',
    notes: '',
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open && check) {
      setForm({
        checkDate: check.checkDate || '',
        reminderBefore: check.reminderBefore || '1 Day Before',
        notes: check.notes || '',
      })
      setErrors({})
    }
  }, [open, check])

  const nextPreview = useMemo(
    () =>
      check?.frequency === 'One Time'
        ? null
        : calcNextCheckDate(form.checkDate, check?.frequency),
    [form.checkDate, check?.frequency]
  )

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.checkDate) {
      setErrors({ checkDate: 'Check date is required' })
      return
    }
    onSubmit?.(form)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reschedule Check"
      size="md"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="reschedule-check-form" className="btn-primary">
            Save Schedule
          </button>
        </>
      }
    >
      <form id="reschedule-check-form" onSubmit={handleSubmit} className="grid gap-4">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
          Rescheduling{' '}
          <span className="font-medium text-slate-900 dark:text-white">{check?.check}</span>
          {check?.frequency ? ` · ${check.frequency}` : ''}
        </div>

        <div>
          <label className="label">Check Date</label>
          <input
            type="date"
            className="input-field"
            value={form.checkDate}
            onChange={(e) => setField('checkDate', e.target.value)}
          />
          {errors.checkDate && (
            <p className="mt-1 text-xs text-red-600">{errors.checkDate}</p>
          )}
        </div>

        <div>
          <label className="label">Reminder</label>
          <select
            className="input-field"
            value={form.reminderBefore}
            onChange={(e) => setField('reminderBefore', e.target.value)}
          >
            {REMINDER_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Next Check (calculated)</label>
          <input
            className="input-field bg-slate-50 dark:bg-slate-800/50"
            value={nextPreview ? formatDateDMY(nextPreview) : '— (One Time)'}
            readOnly
          />
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            className="input-field min-h-[80px]"
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            placeholder="Reason for reschedule or updated notes"
          />
        </div>
      </form>
    </Modal>
  )
}
