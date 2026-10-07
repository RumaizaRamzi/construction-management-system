import PaymentStatusBadge from '../sales/PaymentStatusBadge'
import RentalStatusBadge from './RentalStatusBadge'
import ProductImage from '../ui/ProductImage'
import CompanyLetterhead, { MissingCompanyDataNotice } from '../ui/CompanyLetterhead'
import { formatCurrency, formatDate } from '../../utils/helpers'

export default function RentalAgreement({ rental, settings = {}, className = '' }) {
  if (!rental) return null

  const lateFeePerDay = settings.lateFeePerDay ?? 0
  const customTerms = String(settings.rentalTerms || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const lines = rental.items?.length
    ? rental.items
    : [
        {
          id: 'single',
          product: rental.product,
          product_serial_number: rental.product_serial_number,
          productImage: rental.productImage,
          productCondition: rental.productCondition,
          quantity: rental.quantity,
          rate: rental.rate,
          total: rental.subtotal ?? rental.total,
        },
      ]

  return (
    <div
      className={`invoice-sheet rental-agreement card mx-auto max-w-[210mm] bg-white text-slate-900 p-8 sm:p-12 print:shadow-none print:border-0 ${className}`}
    >
      <MissingCompanyDataNotice settings={settings} />
      <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
        <CompanyLetterhead settings={settings} />
        <div className="text-right">
          <p className="font-display text-3xl font-bold tracking-wide text-slate-800">RENTAL AGREEMENT</p>
          <p className="mt-2 text-sm">
            <span className="text-slate-500">Agreement #</span>{' '}
            <strong>{rental.rentalId || rental.rentalNumber}</strong>
          </p>
          <p className="text-sm">
            <span className="text-slate-500">Start Date</span>{' '}
            <strong>{formatDate(rental.startDate)}</strong>
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <RentalStatusBadge status={rental.rentalStatus} />
            <PaymentStatusBadge status={rental.paymentStatus} />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Renter</p>
          <p className="mt-1 font-semibold text-lg">{rental.customer}</p>
          <p className="text-sm text-slate-600">{rental.customerAddress || '—'}</p>
          <p className="text-sm text-slate-600">{rental.customerPhone || '—'}</p>
          <p className="text-sm text-slate-600">{rental.customerEmail || '—'}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rental Period</p>
          <p className="mt-1 text-sm">
            Start: <strong>{formatDate(rental.startDate)}</strong>
          </p>
          <p className="text-sm">
            Expected Return: <strong>{formatDate(rental.expectedReturn)}</strong>
          </p>
          <p className="text-sm">
            Duration: <strong>{rental.duration} days</strong>
          </p>
          {rental.paymentMethod && (
            <p className="text-sm">
              Payment: <strong>{rental.paymentMethod}</strong>
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">Equipment</th>
              <th className="px-4 py-3 font-semibold">Serial Number</th>
              <th className="px-4 py-3 font-semibold">Qty</th>
              <th className="px-4 py-3 font-semibold">Daily Rate</th>
              <th className="px-4 py-3 font-semibold">Condition</th>
              <th className="px-4 py-3 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((item, idx) => (
              <tr key={item.id ?? idx} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ProductImage src={item.productImage} alt={item.product} className="h-10 w-10" />
                    <span>{item.product}</span>
                  </div>
                </td>
                <td className="px-4 py-3">{item.product_serial_number || '—'}</td>
                <td className="px-4 py-3">{item.quantity}</td>
                <td className="px-4 py-3">{formatCurrency(item.rate)}</td>
                <td className="px-4 py-3">{item.productCondition || '—'}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-col items-end gap-2 text-sm">
        <div className="flex w-full max-w-xs justify-between">
          <span className="text-slate-500">Subtotal</span>
          <span>{formatCurrency(rental.subtotal ?? rental.total)}</span>
        </div>
        <div className="flex w-full max-w-xs justify-between">
          <span className="text-slate-500">Discount</span>
          <span>− {formatCurrency(rental.discount || 0)}</span>
        </div>
        <div className="flex w-full max-w-xs justify-between">
          <span className="text-slate-500">Deposit</span>
          <span>{formatCurrency(rental.deposit)}</span>
        </div>
        <div className="flex w-full max-w-xs justify-between border-t border-slate-200 pt-2 text-base font-bold">
          <span>Total Rental</span>
          <span>{formatCurrency(rental.total)}</span>
        </div>
        <div className="flex w-full max-w-xs justify-between">
          <span className="text-slate-500">Amount Paid</span>
          <span>{formatCurrency(rental.amountPaid)}</span>
        </div>
        <div className="flex w-full max-w-xs justify-between">
          <span className="text-slate-500">Balance</span>
          <span>{formatCurrency(rental.balance)}</span>
        </div>
      </div>

      {(rental.notes || rental.specialInstructions || rental.deliveryNotes) && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3 text-sm">
          {rental.notes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
              <p className="mt-1 text-slate-600">{rental.notes}</p>
            </div>
          )}
          {rental.specialInstructions && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Special Instructions</p>
              <p className="mt-1 text-slate-600">{rental.specialInstructions}</p>
            </div>
          )}
          {rental.deliveryNotes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery</p>
              <p className="mt-1 text-slate-600">{rental.deliveryNotes}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Terms &amp; Conditions
        </p>
        {!customTerms.length && (
          <p className="no-print mb-2 text-xs text-amber-700">
            <strong>CLIENT DATA REQUIRED:</strong> standard terms shown. Add the company&apos;s rental terms in
            Settings → Company.
          </p>
        )}
        <ul className="list-disc pl-5 space-y-1">
          {customTerms.length ? (
            customTerms.map((term) => <li key={term}>{term}</li>)
          ) : (
            <>
              <li>
                Equipment must be returned by the agreed date. Late returns incur a fee of{' '}
                {formatCurrency(lateFeePerDay)} per day per unit.
              </li>
              <li>Renter is responsible for damage, loss, or theft of rented equipment during the rental period.</li>
              <li>Deposit will be refunded after inspection, less any applicable late or damage charges.</li>
              <li>Equipment must be used in accordance with manufacturer guidelines and applicable safety regulations.</li>
              <li>The company reserves the right to charge for repairs or replacement of damaged items.</li>
            </>
          )}
        </ul>
      </div>

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Renter Signature</p>
          <div className="mt-10 h-12 border-b border-slate-400" />
          <p className="mt-2 text-sm text-slate-500">{rental.customer}</p>
          <p className="text-xs text-slate-400">Date: _______________</p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Authorized Signature</p>
          <div className="mt-10 ml-auto h-12 w-48 border-b border-slate-400" />
          {settings.companyName ? <p className="mt-2 text-sm text-slate-500">{settings.companyName}</p> : null}
          <p className="text-xs text-slate-400">Date: _______________</p>
        </div>
      </div>
    </div>
  )
}
