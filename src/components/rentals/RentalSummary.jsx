import PaymentStatusBadge from '../sales/PaymentStatusBadge'
import RentalStatusBadge from './RentalStatusBadge'
import { formatCurrency } from '../../utils/helpers'
import { calcRentalTotals } from '../../utils/rentalHelpers'

export default function RentalSummary({ rental }) {
  if (!rental) return null

  const totals = calcRentalTotals({
    rate: rental.rate,
    duration: rental.duration,
    quantity: rental.quantity,
    discount: rental.discount,
    deposit: rental.deposit,
    lateFee: rental.lateFee ?? 0,
    damageFee: rental.damageFee ?? 0,
    amountPaid: rental.amountPaid,
  })

  // Prefer authoritative totals from API when present
  const amountPaid = rental.amountPaid ?? totals.amountPaid
  const balance = rental.balance ?? Math.max(0, (rental.total ?? totals.grandTotal) - amountPaid)
  const depositRefund =
    rental.depositRefund ??
    rental.returnInfo?.depositRefund ??
    totals.depositRefund

  const rows = [
    { label: 'Subtotal', value: formatCurrency(rental.subtotal ?? totals.subtotal) },
    { label: 'Discount', value: `− ${formatCurrency(rental.discount ?? totals.discount)}`, className: 'text-red-600' },
    { label: 'Rental Total', value: formatCurrency(Math.max(0, (rental.subtotal ?? totals.subtotal) - (rental.discount ?? totals.discount))) },
    { label: 'Late Fee', value: formatCurrency(rental.lateFee ?? totals.lateFee) },
    { label: 'Damage Fee', value: formatCurrency(rental.damageFee ?? totals.damageFee) },
    { label: 'Grand Total', value: formatCurrency(rental.total ?? totals.grandTotal), bold: true },
    { label: 'Deposit Collected', value: formatCurrency(rental.deposit ?? totals.deposit) },
    { label: 'Amount Paid', value: formatCurrency(amountPaid) },
    { label: 'Balance Due', value: formatCurrency(balance), className: 'text-red-600' },
  ]

  if (rental.rentalStatus === 'Returned' || rental.returnInfo) {
    rows.push({
      label: 'Deposit Refund',
      value: formatCurrency(depositRefund),
      className: 'text-emerald-600',
    })
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium text-slate-900 dark:text-white">Financial Summary</p>
        <div className="flex flex-wrap gap-2">
          <PaymentStatusBadge status={rental.paymentStatus} />
          <RentalStatusBadge status={rental.rentalStatus} />
        </div>
      </div>

      <div className="space-y-2 text-sm">
        {rows.map((row) => (
          <div
            key={row.label}
            className={`flex justify-between ${row.bold ? 'border-t border-slate-200 dark:border-slate-700 pt-2 text-base font-bold' : ''}`}
          >
            <span className="text-slate-500">{row.label}</span>
            <span className={`font-medium ${row.className || ''}`}>{row.value}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
        <div>
          <p className="text-slate-500">Payment Method</p>
          <p className="font-medium">{rental.paymentMethod || '—'}</p>
        </div>
        <div>
          <p className="text-slate-500">Duration</p>
          <p className="font-medium">{rental.duration} days × {rental.quantity} unit(s)</p>
        </div>
        <div>
          <p className="text-slate-500">Daily Rate</p>
          <p className="font-medium">{formatCurrency(rental.rate)}/day</p>
        </div>
      </div>
    </div>
  )
}
