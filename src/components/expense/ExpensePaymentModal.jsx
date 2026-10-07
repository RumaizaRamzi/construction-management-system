import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import { EXPENSE_PAYMENT_METHODS, getTodayISO } from '../../utils/expenseHelpers'
import { formatCurrency } from '../../utils/helpers'

export default function ExpensePaymentModal({ open, onClose, onSubmit, record }) {
  const [form, setForm] = useState({
    paymentDate: getTodayISO(),
    amount: '',
    paymentMethod: 'Cash',
    reference: '',
    notes: '',
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && record) {
      setForm({
        paymentDate: getTodayISO(),
        amount: record.remainingAmount || '',
        paymentMethod: record.paymentMethod || 'Cash',
        reference: '',
        notes: '',
      })
      setError('')
    }
  }, [open, record])

  const remaining = Number(record?.remainingAmount) || 0

  const handleSubmit = (e) => {
    e.preventDefault()
    const amount = Number(form.amount) || 0
    if (amount <= 0) {
      setError('Payment amount must be greater than 0')
      return
    }
    if (amount > remaining) {
      setError(`Amount cannot exceed remaining ${formatCurrency(remaining)}`)
      return
    }
    onSubmit?.(form)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Expense Payment"
      size="md"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="expense-payment-form" className="btn-primary">
            Save Payment
          </button>
        </>
      }
    >
      <form id="expense-payment-form" onSubmit={handleSubmit} className="grid gap-4">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-3 py-2 text-sm space-y-1">
          <p className="text-slate-600 dark:text-slate-300">
            {record?.expenseId} — Total{' '}
            <span className="font-semibold text-slate-900 dark:text-white">
              {formatCurrency(record?.amount)}
            </span>
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            Previous paid{' '}
            <span className="font-semibold">{formatCurrency(record?.paidAmount)}</span>
            {' · '}
            Remaining{' '}
            <span className="font-semibold text-slate-900 dark:text-white">
              {formatCurrency(remaining)}
            </span>
          </p>
        </div>

        <div>
          <label className="label">Payment Date</label>
          <input
            type="date"
            className="input-field"
            value={form.paymentDate}
            onChange={(e) => setForm((p) => ({ ...p, paymentDate: e.target.value }))}
          />
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
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>

        <div>
          <label className="label">Payment Method</label>
          <select
            className="input-field"
            value={form.paymentMethod}
            onChange={(e) => setForm((p) => ({ ...p, paymentMethod: e.target.value }))}
          >
            {EXPENSE_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Reference</label>
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
