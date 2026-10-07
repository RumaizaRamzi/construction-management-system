import PaymentStatusBadge from '../sales/PaymentStatusBadge'
import { formatCurrency } from '../../utils/helpers'
import {
  RENTAL_PAYMENT_METHODS,
  RENTAL_PAYMENT_STATUSES,
  RENTAL_STATUSES,
  calcRentalDuration,
  calcRentalTotals,
} from '../../utils/rentalHelpers'

export default function RentalCalculation({ form, onChange, errors = {}, showRentalStatus = false }) {
  const set = (key, value) => onChange?.({ ...form, [key]: value })

  const duration = calcRentalDuration(form.startDate, form.expectedReturn)
  const totals = calcRentalTotals({
    rate: form.rate,
    duration,
    quantity: form.quantity,
    discount: form.discount,
    deposit: form.deposit,
    lateFee: form.lateFee ?? 0,
    damageFee: form.damageFee ?? 0,
    amountPaid: form.amountPaid,
  })

  return (
    <div className="card p-5 space-y-4">
      <p className="font-medium text-slate-900 dark:text-white">Rental Calculation</p>

      <div className="grid gap-3 sm:grid-cols-4 text-sm">
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
          <p className="text-slate-500 text-xs">Duration</p>
          <p className="font-semibold">{duration} days</p>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
          <p className="text-slate-500 text-xs">Rate</p>
          <p className="font-semibold">{formatCurrency(form.rate || 0)}/day</p>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
          <p className="text-slate-500 text-xs">Quantity</p>
          <p className="font-semibold">{form.quantity || 1}</p>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
          <p className="text-slate-500 text-xs">Subtotal</p>
          <p className="font-semibold">{formatCurrency(totals.subtotal)}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Discount (LKR)</label>
          <input
            type="number"
            min="0"
            className="input-field"
            value={form.discount || 0}
            onChange={(e) => set('discount', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Deposit (LKR)</label>
          <input
            type="number"
            min="0"
            className="input-field"
            value={form.deposit ?? ''}
            onChange={(e) => set('deposit', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Late Fee</label>
          <input
            type="number"
            className="input-field bg-slate-50 dark:bg-slate-800"
            value={form.lateFee ?? 0}
            readOnly
          />
        </div>
        <div>
          <label className="label">Damage Fee</label>
          <input
            type="number"
            className="input-field bg-slate-50 dark:bg-slate-800"
            value={form.damageFee ?? 0}
            readOnly
          />
        </div>
      </div>

      <div className="space-y-2 text-sm border-t border-slate-200 dark:border-slate-700 pt-3">
        <div className="flex justify-between">
          <span className="text-slate-500">Rental Total</span>
          <span className="font-medium">{formatCurrency(totals.total)}</span>
        </div>
        <div className="flex justify-between text-base font-bold">
          <span>Grand Total</span>
          <span className="text-brand-600">{formatCurrency(totals.grandTotal)}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Amount Paid</label>
          <input
            type="number"
            min="0"
            className="input-field"
            value={form.amountPaid || 0}
            onChange={(e) => set('amountPaid', e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <div className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
            <p className="text-xs text-slate-500">Balance Due</p>
            <p className="font-semibold text-red-600">{formatCurrency(totals.balance)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Payment Method</label>
          <select
            className="input-field"
            value={form.paymentMethod || 'Cash'}
            onChange={(e) => set('paymentMethod', e.target.value)}
          >
            {RENTAL_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Payment Status</label>
          <select
            className="input-field"
            value={form.paymentStatus || 'Pending'}
            onChange={(e) => set('paymentStatus', e.target.value)}
          >
            {RENTAL_PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="mt-2">
            <PaymentStatusBadge status={form.paymentStatus} />
          </div>
        </div>
      </div>

      {showRentalStatus && (
        <div>
          <label className="label">Rental Status</label>
          <select
            className="input-field max-w-xs"
            value={form.rentalStatus || 'Confirmed'}
            onChange={(e) => set('rentalStatus', e.target.value)}
          >
            {RENTAL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      {(errors.startDate || errors.expectedReturn) && (
        <p className="text-xs text-red-600">{errors.startDate || errors.expectedReturn}</p>
      )}
    </div>
  )
}
