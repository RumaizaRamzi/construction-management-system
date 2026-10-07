import { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal'
import BranchSelect from '../ui/BranchSelect'
import {
  INCOME_CATEGORIES,
  INCOME_PAYMENT_METHODS,
  INCOME_SOURCES,
  calcRemaining,
  categoryForSource,
  derivePaymentStatus,
  emptyIncomeForm,
  validateIncomeForm,
} from '../../utils/incomeHelpers'
import { formatCurrency } from '../../utils/helpers'

export default function IncomeForm({
  open,
  onClose,
  onSubmit,
  initialValues,
  customers = [],
  sales = [],
  rentals = [],
  bookings = [],
  isEdit = false,
}) {
  const [form, setForm] = useState(emptyIncomeForm)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm(initialValues ? { ...emptyIncomeForm(), ...initialValues } : emptyIncomeForm())
      setErrors({})
    }
  }, [open, initialValues])

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const remaining = useMemo(
    () => calcRemaining(form.amount, form.paidAmount),
    [form.amount, form.paidAmount]
  )

  const derivedStatus = useMemo(
    () =>
      derivePaymentStatus({
        amount: form.amount,
        paidAmount: form.paidAmount,
        dueDate: form.dueDate || null,
      }),
    [form.amount, form.paidAmount, form.dueDate]
  )

  const handleSourceChange = (source) => {
    setForm((prev) => ({
      ...prev,
      source,
      category: categoryForSource(source),
      reference: '',
      relatedId: '',
    }))
  }

  const handleCustomerChange = (customerId) => {
    const customer = customers.find((c) => String(c.id) === String(customerId))
    setForm((prev) => ({
      ...prev,
      customerId: customerId,
      customer: customer?.name || '',
    }))
  }

  const handleRelatedChange = (relatedId) => {
    if (form.source === 'Sale') {
      const sale = sales.find((s) => String(s.id) === String(relatedId))
      if (sale) {
        setForm((prev) => ({
          ...prev,
          relatedId,
          reference: sale.invoiceNumber,
          customerId: sale.customerId ? String(sale.customerId) : prev.customerId,
          customer: sale.customer || prev.customer,
          description: prev.description || `Sale ${sale.invoiceNumber}`,
          amount: prev.amount || sale.total || '',
          paidAmount: prev.paidAmount || sale.amountPaid || '',
        }))
      }
      return
    }
    if (form.source === 'Rental') {
      const rental = rentals.find((r) => String(r.id) === String(relatedId))
      if (rental) {
        setForm((prev) => ({
          ...prev,
          relatedId,
          reference: rental.rentalId || rental.rentalNumber,
          customerId: rental.customerId ? String(rental.customerId) : prev.customerId,
          customer: rental.customer || prev.customer,
          description: prev.description || `${rental.product} Rental`,
          amount: prev.amount || rental.total || '',
          paidAmount: prev.paidAmount || rental.amountPaid || '',
        }))
      }
      return
    }
    if (form.source === 'Booking') {
      const booking = bookings.find((b) => String(b.id) === String(relatedId))
      if (booking) {
        setForm((prev) => ({
          ...prev,
          relatedId,
          reference: booking.bookingNumber || booking.bookingId,
          customerId: booking.customerId ? String(booking.customerId) : prev.customerId,
          customer: booking.customer || prev.customer,
          description: prev.description || `${booking.product} Booking Advance`,
          amount: prev.amount || booking.deposit || booking.estimatedAmount || '',
          paidAmount: prev.paidAmount || booking.deposit || '',
        }))
      }
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const nextErrors = validateIncomeForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    onSubmit?.({
      ...form,
      paymentStatus: derivedStatus,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Income' : 'Add Income'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="income-form" className="btn-primary">
            Save Income
          </button>
        </>
      }
    >
      <form id="income-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Income Date</label>
          <input
            type="date"
            className="input-field"
            value={form.date}
            onChange={(e) => setField('date', e.target.value)}
          />
          {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date}</p>}
        </div>

        <div>
          <label className="label">Income Source</label>
          <select
            className="input-field"
            value={form.source}
            onChange={(e) => handleSourceChange(e.target.value)}
          >
            {INCOME_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Customer</label>
          {form.source === 'Other' ? (
            <input
              className="input-field"
              value={form.customer}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  customer: e.target.value,
                  customerId: '',
                }))
              }
              placeholder="Customer or payer name"
            />
          ) : (
            <select
              className="input-field"
              value={form.customerId || ''}
              onChange={(e) => handleCustomerChange(e.target.value)}
            >
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {errors.customer && <p className="mt-1 text-xs text-red-600">{errors.customer}</p>}
        </div>

        {form.source === 'Sale' && (
          <div>
            <label className="label">Select Sale / Invoice</label>
            <select
              className="input-field"
              value={form.relatedId || ''}
              onChange={(e) => handleRelatedChange(e.target.value)}
            >
              <option value="">Select invoice</option>
              {sales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.invoiceNumber} — {s.customer}
                </option>
              ))}
            </select>
          </div>
        )}

        {form.source === 'Rental' && (
          <div>
            <label className="label">Select Rental</label>
            <select
              className="input-field"
              value={form.relatedId || ''}
              onChange={(e) => handleRelatedChange(e.target.value)}
            >
              <option value="">Select rental</option>
              {rentals.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.rentalId || r.rentalNumber} — {r.customer}
                </option>
              ))}
            </select>
          </div>
        )}

        {form.source === 'Booking' && (
          <div>
            <label className="label">Select Booking</label>
            <select
              className="input-field"
              value={form.relatedId || ''}
              onChange={(e) => handleRelatedChange(e.target.value)}
            >
              <option value="">Select booking</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bookingNumber || b.bookingId} — {b.customer}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label">Reference Number</label>
          <input
            className="input-field"
            value={form.reference}
            onChange={(e) => setField('reference', e.target.value)}
            placeholder={form.source === 'Other' ? 'Manual reference' : 'Auto-filled or override'}
          />
        </div>

        <div>
          <label className="label">Category</label>
          <select
            className="input-field"
            value={form.category}
            onChange={(e) => setField('category', e.target.value)}
          >
            {INCOME_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea
            className="input-field min-h-[72px]"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-600">{errors.description}</p>
          )}
        </div>

        <div>
          <label className="label">Amount (LKR)</label>
          <input
            type="number"
            min="0"
            className="input-field"
            value={form.amount}
            onChange={(e) => setField('amount', e.target.value)}
          />
          {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
        </div>

        <div>
          <label className="label">Paid Amount (LKR)</label>
          <input
            type="number"
            min="0"
            className="input-field"
            value={form.paidAmount}
            onChange={(e) => setField('paidAmount', e.target.value)}
          />
          {errors.paidAmount && (
            <p className="mt-1 text-xs text-red-600">{errors.paidAmount}</p>
          )}
        </div>

        <div>
          <label className="label">Remaining Amount</label>
          <input
            className="input-field bg-slate-50 dark:bg-slate-800/50"
            value={formatCurrency(remaining)}
            readOnly
          />
        </div>

        <div>
          <label className="label">Payment Status (auto)</label>
          <input
            className="input-field bg-slate-50 dark:bg-slate-800/50"
            value={derivedStatus}
            readOnly
          />
        </div>

        <div>
          <label className="label">Payment Method</label>
          <select
            className="input-field"
            value={form.paymentMethod}
            onChange={(e) => setField('paymentMethod', e.target.value)}
          >
            {INCOME_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Due Date (optional)</label>
          <input
            type="date"
            className="input-field"
            value={form.dueDate || ''}
            onChange={(e) => setField('dueDate', e.target.value)}
          />
        </div>

        <BranchSelect value={form.branchId ?? ''} onChange={(v) => setField('branchId', v)} />

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
