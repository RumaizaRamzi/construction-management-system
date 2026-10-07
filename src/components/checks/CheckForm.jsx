import { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal'
import {
  CHECK_ASSIGNEES,
  CHECK_FREQUENCIES,
  CHECK_PRIORITIES,
  REMINDER_OPTIONS,
  calcNextCheckDate,
  emptyCheckForm,
  validateCheckForm,
} from '../../utils/checkHelpers'
import { formatDateDMY } from '../../utils/helpers'

export default function CheckForm({
  open,
  onClose,
  onSubmit,
  initialValues,
  products = [],
  isEdit = false,
}) {
  const [form, setForm] = useState(emptyCheckForm)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm(initialValues ? { ...emptyCheckForm(), ...initialValues } : emptyCheckForm())
      setErrors({})
    }
  }, [open, initialValues])

  const nextCheckPreview = useMemo(
    () => calcNextCheckDate(form.checkDate, form.frequency),
    [form.checkDate, form.frequency]
  )

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleProductChange = (productId) => {
    const product = products.find((p) => String(p.id) === String(productId))
    if (product) {
      setForm((prev) => ({
        ...prev,
        productId: String(product.id),
        product: product.name,
        category: product.category || '',
      }))
    } else {
      setForm((prev) => ({
        ...prev,
        productId: '',
        product: '',
        category: '',
      }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const nextErrors = validateCheckForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    onSubmit?.({
      ...form,
      nextCheck: nextCheckPreview,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Check' : 'Add Check'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="check-form" className="btn-primary">
            {isEdit ? 'Save Check' : 'Save Check'}
          </button>
        </>
      }
    >
      <form id="check-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Check Name</label>
          <input
            className="input-field"
            value={form.check}
            onChange={(e) => setField('check', e.target.value)}
            placeholder="e.g. Generator Service"
          />
          {errors.check && <p className="mt-1 text-xs text-red-600">{errors.check}</p>}
        </div>

        <div>
          <label className="label">Product</label>
          <select
            className="input-field"
            value={form.productId || ''}
            onChange={(e) => handleProductChange(e.target.value)}
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {errors.product && <p className="mt-1 text-xs text-red-600">{errors.product}</p>}
        </div>

        <div>
          <label className="label">Category</label>
          <input className="input-field bg-slate-50 dark:bg-slate-800/50" value={form.category || ''} readOnly />
        </div>

        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea
            className="input-field min-h-[80px]"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Describe the inspection or maintenance task"
          />
        </div>

        <div>
          <label className="label">Check Date</label>
          <input
            type="date"
            className="input-field"
            value={form.checkDate}
            onChange={(e) => setField('checkDate', e.target.value)}
          />
          {errors.checkDate && <p className="mt-1 text-xs text-red-600">{errors.checkDate}</p>}
        </div>

        <div>
          <label className="label">Frequency</label>
          <select
            className="input-field"
            value={form.frequency}
            onChange={(e) => setField('frequency', e.target.value)}
          >
            {CHECK_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Assigned To</label>
          <select
            className="input-field"
            value={form.assignedTo}
            onChange={(e) => setField('assignedTo', e.target.value)}
          >
            <option value="">Select assignee</option>
            {form.assignedTo && !CHECK_ASSIGNEES.includes(form.assignedTo) && (
              <option value={form.assignedTo}>{form.assignedTo}</option>
            )}
            {CHECK_ASSIGNEES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          {errors.assignedTo && <p className="mt-1 text-xs text-red-600">{errors.assignedTo}</p>}
        </div>

        <div>
          <label className="label">Priority</label>
          <select
            className="input-field"
            value={form.priority}
            onChange={(e) => setField('priority', e.target.value)}
          >
            {CHECK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Reminder Before</label>
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
            value={nextCheckPreview ? formatDateDMY(nextCheckPreview) : '— (One Time)'}
            readOnly
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea
            className="input-field min-h-[72px]"
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            placeholder="Optional notes"
          />
        </div>
      </form>
    </Modal>
  )
}
