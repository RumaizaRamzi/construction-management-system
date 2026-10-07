import PaymentStatusBadge from './PaymentStatusBadge'
import CompanyLetterhead, { MissingCompanyDataNotice } from '../ui/CompanyLetterhead'
import { formatCurrency, formatDate } from '../../utils/helpers'

export default function InvoiceTemplate({ sale, settings = {}, className = '' }) {
  if (!sale) return null

  const taxRate = sale.taxRate ?? settings.taxRate ?? 0

  const items = sale.items?.length
    ? sale.items
    : [{ id: 1, productName: sale.products, quantity: sale.quantity, unitPrice: sale.total / (sale.quantity || 1), discount: 0, total: sale.total }]

  const subtotal = sale.subtotal ?? items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unitPrice || 0), 0)
  const discount = sale.discount ?? items.reduce((sum, i) => sum + Number(i.discount || 0), 0)
  const tax = sale.tax ?? 0
  const grandTotal = sale.total ?? subtotal - discount + tax

  return (
    <div className={`invoice-sheet card mx-auto max-w-[210mm] bg-white text-slate-900 p-8 sm:p-12 print:shadow-none print:border-0 ${className}`}>
      <MissingCompanyDataNotice settings={settings} />
      <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
        <CompanyLetterhead settings={settings} />
        <div className="text-right">
          <p className="font-display text-3xl font-bold tracking-wide text-slate-800">INVOICE</p>
          <p className="mt-2 text-sm">
            <span className="text-slate-500">Invoice #</span> <strong>{sale.invoiceNumber}</strong>
          </p>
          <p className="text-sm">
            <span className="text-slate-500">Date</span> <strong>{formatDate(sale.date)}</strong>
          </p>
          <div className="mt-2 flex justify-end">
            <PaymentStatusBadge status={sale.paymentStatus} />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bill To</p>
          <p className="mt-1 font-semibold text-lg">{sale.customer}</p>
          <p className="text-sm text-slate-600">{sale.customerAddress || '—'}</p>
          <p className="text-sm text-slate-600">{sale.customerPhone || '—'}</p>
          <p className="text-sm text-slate-600">{sale.customerEmail || '—'}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment</p>
          <p className="mt-1 text-sm">
            Method: <strong>{sale.paymentMethod || '—'}</strong>
          </p>
          <p className="text-sm">
            Sale status: <strong>{sale.saleStatus}</strong>
          </p>
          <p className="text-sm">
            Amount paid: <strong>{formatCurrency(sale.amountPaid)}</strong>
          </p>
          <p className="text-sm">
            Balance: <strong>{formatCurrency(sale.balance)}</strong>
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">#</th>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Serial Number</th>
              <th className="px-4 py-3 font-semibold">Qty</th>
              <th className="px-4 py-3 font-semibold">Unit Price</th>
              <th className="px-4 py-3 font-semibold">Discount</th>
              <th className="px-4 py-3 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id ?? idx} className="border-t border-slate-100">
                <td className="px-4 py-3">{idx + 1}</td>
                <td className="px-4 py-3">{item.productName}</td>
                <td className="px-4 py-3">{item.serial_number || '—'}</td>
                <td className="px-4 py-3">{item.quantity}</td>
                <td className="px-4 py-3">{formatCurrency(item.unitPrice)}</td>
                <td className="px-4 py-3">{formatCurrency(item.discount || 0)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(item.total ?? item.quantity * item.unitPrice - (item.discount || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-col items-end gap-2 text-sm">
        <div className="flex w-full max-w-xs justify-between">
          <span className="text-slate-500">Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex w-full max-w-xs justify-between">
          <span className="text-slate-500">Discount</span>
          <span>− {formatCurrency(discount)}</span>
        </div>
        <div className="flex w-full max-w-xs justify-between">
          <span className="text-slate-500">Tax ({taxRate}%)</span>
          <span>{formatCurrency(tax)}</span>
        </div>
        <div className="flex w-full max-w-xs justify-between border-t border-slate-200 pt-2 text-base font-bold">
          <span>Grand Total</span>
          <span>{formatCurrency(grandTotal)}</span>
        </div>
      </div>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div className="space-y-4">
          {sale.notes ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
              <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">{sale.notes}</p>
            </div>
          ) : null}
          {settings.bankDetails ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bank Details</p>
              <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">{settings.bankDetails}</p>
            </div>
          ) : null}
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Authorized Signature</p>
          <div className="mt-10 ml-auto h-12 w-48 border-b border-slate-400" />
          {settings.companyName ? <p className="mt-2 text-sm text-slate-500">{settings.companyName}</p> : null}
        </div>
      </div>
      {settings.invoiceFooter ? (
        <p className="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-500 whitespace-pre-line">
          {settings.invoiceFooter}
        </p>
      ) : null}
    </div>
  )
}
