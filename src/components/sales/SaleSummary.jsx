import { PAYMENT_STATUSES, PAYMENT_METHODS, SALE_STATUSES, calcSaleTotals, derivePaymentStatus } from '../../utils/saleHelpers'
import { formatCurrency } from '../../utils/helpers'
import PaymentStatusBadge from './PaymentStatusBadge'

export default function SaleSummary({ form, onChange, errors = {} }) {
  const set = (key, value) => onChange?.({ ...form, [key]: value })

  const totals = calcSaleTotals({
    items: form.items || [],
    discount: form.discount,
    taxRate: form.taxRate,
    amountPaid: form.amountPaid,
  })

  const derivedStatus = derivePaymentStatus(totals.total, totals.amountPaid, form.paymentStatus)

  return (
    <div className="card p-5 space-y-4">
      <p className="font-medium text-slate-900 dark:text-white">Sale Summary</p>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Subtotal</span>
          <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Discount</span>
          <span className="font-medium text-red-600">− {formatCurrency(totals.discount)}</span>
        </div>
        <div className="flex justify-between items-center gap-3">
          <span className="text-slate-500">Tax ({form.taxRate || 0}%)</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="100"
              className="input-field !w-20 !py-1 text-right"
              value={form.taxRate || 0}
              onChange={(e) => set('taxRate', e.target.value)}
            />
            <span className="font-medium">{formatCurrency(totals.tax)}</span>
          </div>
        </div>
        <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 text-base font-bold">
          <span>Grand Total</span>
          <span className="text-brand-600">{formatCurrency(totals.total)}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Order Discount (LKR)</label>
          <input
            type="number"
            min="0"
            className="input-field"
            value={form.discount || 0}
            onChange={(e) => set('discount', e.target.value)}
          />
        </div>
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
      </div>

      <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
        <span className="text-sm text-slate-500">Balance Due</span>
        <span className="font-semibold text-red-600">{formatCurrency(totals.balance)}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Payment Status</label>
          <select
            className="input-field"
            value={form.paymentStatus || 'Pending'}
            onChange={(e) => set('paymentStatus', e.target.value)}
          >
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="mt-2">
            <PaymentStatusBadge status={derivedStatus} />
          </div>
          {errors.paymentStatus && <p className="mt-1 text-xs text-red-600">{errors.paymentStatus}</p>}
        </div>
        <div>
          <label className="label">Payment Method</label>
          <select
            className="input-field"
            value={form.paymentMethod || 'Cash'}
            onChange={(e) => set('paymentMethod', e.target.value)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {errors.paymentMethod && <p className="mt-1 text-xs text-red-600">{errors.paymentMethod}</p>}
        </div>
        <div>
          <label className="label">Sale Status</label>
          <select
            className="input-field"
            value={form.saleStatus || 'Completed'}
            onChange={(e) => set('saleStatus', e.target.value)}
          >
            {SALE_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {errors.saleStatus && <p className="mt-1 text-xs text-red-600">{errors.saleStatus}</p>}
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea
          className="input-field"
          rows={3}
          value={form.notes || ''}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Additional notes for this sale..."
        />
      </div>
    </div>
  )
}
