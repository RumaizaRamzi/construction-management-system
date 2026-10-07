import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import {
  FINANCIAL_PAYMENT_METHODS,
  emptyPaymentForm,
  paymentToForm,
  validatePaymentForm,
} from '../../utils/financialHelpers'
import { formatCurrency } from '../../utils/helpers'

export default function PaymentForm({
  open,
  onClose,
  onSubmit,
  title = 'Add Payment',
  initialValues = null,
  remaining = 0,
  excludeAmount = 0,
  contextLabel = '',
}) {
  const [form, setForm] = useState(emptyPaymentForm)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm(
        initialValues
          ? paymentToForm(initialValues)
          : emptyPaymentForm({ amount: remaining > 0 ? remaining : '', paymentMethod: 'Cash' })
      )
      setErrors({})
    }
  }, [open, initialValues, remaining])

  const handleSubmit = (e) => {
    e.preventDefault()
    const nextErrors = validatePaymentForm(form, { remaining, excludeAmount })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    onSubmit?.(form)
  }

  const allowed = remaining + (Number(excludeAmount) || 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="financial-payment-form" className="btn-primary">
            Save Payment
          </button>
        </>
      }
    >
      <form id="financial-payment-form" onSubmit={handleSubmit} className="grid gap-4">
        {(contextLabel || allowed >= 0) && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-3 py-2 text-sm">
            {contextLabel && <p className="text-slate-600 dark:text-slate-300">{contextLabel}</p>}
            <p className="text-slate-600 dark:text-slate-300">
              Available remaining{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {formatCurrency(allowed)}
              </span>
            </p>
          </div>
        )}

        <div>
          <label className="label">Payment Date</label>
          <input
            type="date"
            className="input-field"
            value={form.paymentDate}
            onChange={(e) => setForm((p) => ({ ...p, paymentDate: e.target.value }))}
          />
          {errors.paymentDate && <p className="mt-1 text-xs text-red-600">{errors.paymentDate}</p>}
        </div>

        <div>
          <label className="label">Amount (LKR)</label>
          <input
            type="number"
            min="0"
            className="input-field"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
          />
          {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
        </div>

        <div>
          <label className="label">Payment Method</label>
          <select
            className="input-field"
            value={form.paymentMethod}
            onChange={(e) => setForm((p) => ({ ...p, paymentMethod: e.target.value }))}
          >
            {FINANCIAL_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {errors.paymentMethod && (
            <p className="mt-1 text-xs text-red-600">{errors.paymentMethod}</p>
          )}
        </div>

        <div>
          <label className="label">Reference Number</label>
          <input
            className="input-field"
            value={form.reference}
            onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
            placeholder="Transfer / cheque / receipt ref"
          />
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            className="input-field min-h-[72px]"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />
        </div>
      </form>
    </Modal>
  )
}
