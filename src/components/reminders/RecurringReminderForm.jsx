import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import {
  REMINDER_FREQUENCIES,
  REMINDER_PRIORITIES,
  calcNextReminderDate,
  emptyRecurringForm,
  validateRecurringForm,
} from '../../utils/reminderHelpers'
import { formatDateDMY } from '../../utils/helpers'

export default function RecurringReminderForm({
  open,
  onClose,
  onSubmit,
  initialValues,
  products = [],
  isEdit = false,
}) {
  const [form, setForm] = useState(emptyRecurringForm)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm(initialValues ? { ...emptyRecurringForm(), ...initialValues } : emptyRecurringForm())
      setErrors({})
    }
  }, [open, initialValues])

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleProductChange = (productId) => {
    const product = products.find((p) => String(p.id) === String(productId))
    if (product) {
      setForm((prev) => ({
        ...prev,
        productId: String(product.id),
        product: product.name,
      }))
    } else if (productId === 'all') {
      setForm((prev) => ({
        ...prev,
        productId: '',
        product: 'All Yard Equipment',
      }))
    } else {
      setForm((prev) => ({ ...prev, productId: '', product: '' }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const nextErrors = validateRecurringForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    onSubmit?.(form)
  }

  const previewNext = calcNextReminderDate(form.nextReminder, form.frequency)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Recurring Reminder' : 'Add Recurring Reminder'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="recurring-reminder-form" className="btn-primary">
            Save
          </button>
        </>
      }
    >
      <form id="recurring-reminder-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Reminder</label>
          <input
            className="input-field"
            value={form.reminder}
            onChange={(e) => setField('reminder', e.target.value)}
            placeholder="e.g. Generator service reminder"
          />
          {errors.reminder && <p className="mt-1 text-xs text-red-600">{errors.reminder}</p>}
        </div>

        <div>
          <label className="label">Product</label>
          <select
            className="input-field"
            value={form.productId || (form.product === 'All Yard Equipment' ? 'all' : '')}
            onChange={(e) => handleProductChange(e.target.value)}
          >
            <option value="">Select product</option>
            <option value="all">All Yard Equipment</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {errors.product && <p className="mt-1 text-xs text-red-600">{errors.product}</p>}
        </div>

        <div>
          <label className="label">Frequency</label>
          <select
            className="input-field"
            value={form.frequency}
            onChange={(e) => setField('frequency', e.target.value)}
          >
            {REMINDER_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Next Reminder</label>
          <input
            type="date"
            className="input-field"
            value={form.nextReminder}
            onChange={(e) => setField('nextReminder', e.target.value)}
          />
          {errors.nextReminder && (
            <p className="mt-1 text-xs text-red-600">{errors.nextReminder}</p>
          )}
        </div>

        <div>
          <label className="label">Priority</label>
          <select
            className="input-field"
            value={form.priority}
            onChange={(e) => setField('priority', e.target.value)}
          >
            {REMINDER_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Following cycle after next</label>
          <input
            className="input-field bg-slate-50 dark:bg-slate-800/50"
            value={previewNext ? formatDateDMY(previewNext) : '—'}
            readOnly
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea
            className="input-field min-h-[72px]"
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </div>
      </form>
    </Modal>
  )
}
