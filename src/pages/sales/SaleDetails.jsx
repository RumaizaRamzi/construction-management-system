import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Pencil, Printer, Trash2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import LoadingState from '../../components/ui/LoadingState'
import SendInvoiceSmsButton from '../../components/ui/SendInvoiceSmsButton'
import {
  DeleteSaleDialog,
  PaymentStatusBadge,
  SaleStatusBadge,
} from '../../components/sales'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage } from '../../services/api'
import { downloadTextFile, formatCurrency, formatDate } from '../../utils/helpers'
import { PAYMENT_METHODS } from '../../utils/saleHelpers'

function DetailRow({ label, children }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="font-medium text-slate-800 dark:text-slate-200">{children}</div>
    </div>
  )
}

export default function SaleDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { sales, deleteSale, loadSale, salesLoading, addSalePayment, can } = useApp()
  const { success, error: toastError } = useToast()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [paying, setPaying] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'Cash',
    reference: '',
    notes: '',
  })

  const sale = sales.find((s) => String(s.id) === String(id))

  useEffect(() => {
    if (!sale) return
    setPaymentForm((f) => ({
      ...f,
      amount: sale.balance > 0 ? String(sale.balance) : '',
      paymentMethod: sale.paymentMethod || 'Cash',
    }))
  }, [sale?.id, sale?.balance, sale?.paymentMethod])

  const handleAddPayment = async (e) => {
    e.preventDefault()
    if (!sale) return
    const amount = Number(paymentForm.amount)
    if (!(amount > 0)) {
      toastError('Enter a valid payment amount.')
      return
    }
    if (amount > Number(sale.balance || 0) + 0.0001) {
      toastError(`Payment cannot exceed the balance of ${formatCurrency(sale.balance)}.`)
      return
    }
    setPaying(true)
    try {
      const { message } = await addSalePayment(sale.id, paymentForm)
      success(message || 'Payment recorded.')
      setPaymentForm((f) => ({ ...f, reference: '', notes: '' }))
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to record payment.'))
    } finally {
      setPaying(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadSale(id)
      .catch(() => {
        if (!cancelled) toastError('Unable to load sale.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, loadSale, toastError])

  const items = useMemo(() => {
    if (!sale) return []
    if (sale.items?.length) return sale.items
    if (sale.products) {
      return [
        {
          id: 1,
          productName: sale.products,
          serial_number: '—',
          quantity: sale.quantity || 1,
          unitPrice: sale.total / (sale.quantity || 1),
          discount: 0,
          total: sale.total,
        },
      ]
    }
    return []
  }, [sale])

  const buildInvoiceText = () => {
    if (!sale) return ''
    const lines = [
      `INVOICE: ${sale.invoiceNumber}`,
      `Date: ${formatDate(sale.date)}`,
      `Customer: ${sale.customer}`,
      '',
      'Items:',
      ...items.map(
        (item, idx) =>
          `${idx + 1}. ${item.productName} x${item.quantity} @ ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total ?? item.quantity * item.unitPrice)}`
      ),
      '',
      `Subtotal: ${formatCurrency(sale.subtotal ?? sale.total)}`,
      `Discount: ${formatCurrency(sale.discount ?? 0)}`,
      `Tax: ${formatCurrency(sale.tax ?? 0)}`,
      `Total: ${formatCurrency(sale.total)}`,
      `Amount Paid: ${formatCurrency(sale.amountPaid ?? 0)}`,
      `Balance: ${formatCurrency(sale.balance ?? 0)}`,
      `Payment: ${sale.paymentStatus} via ${sale.paymentMethod}`,
    ]
    return lines.join('\n')
  }

  const handleDownload = () => {
    downloadTextFile(`${sale.invoiceNumber}.txt`, buildInvoiceText())
  }

  const handleDelete = async () => {
    setCancelling(true)
    try {
      const { message } = await deleteSale(sale.id)
      success(message || `Sale ${sale.invoiceNumber} cancelled successfully.`)
      setDeleteOpen(false)
      navigate('/sales')
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to cancel sale.'))
    } finally {
      setCancelling(false)
    }
  }

  if ((loading || salesLoading) && !sale) {
    return <LoadingState label="Loading sale..." />
  }

  if (!sale) {
    return (
      <div className="page-shell">
        <PageHeader
          title="Sale not found"
          breadcrumbs={[{ label: 'Sales', to: '/sales' }, { label: 'Not found' }]}
        />
        <div className="card p-8 text-center">
          <p className="page-subtitle">The sale you are looking for does not exist or was removed.</p>
          <Link to="/sales" className="btn-primary mt-6 inline-flex">
            <ArrowLeft size={18} />
            Back to Sales
          </Link>
        </div>
      </div>
    )
  }

  const isCancelled = sale.saleStatus === 'Cancelled'

  return (
    <div className="page-shell">
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {sale.invoiceNumber}
            <PaymentStatusBadge status={sale.paymentStatus} />
            <SaleStatusBadge status={sale.saleStatus} />
          </span>
        }
        subtitle={`${formatDate(sale.date)} · ${sale.customer}`}
        breadcrumbs={[
          { label: 'Sales', to: '/sales' },
          { label: sale.invoiceNumber },
        ]}
        actions={
          <>
            <Link to="/sales" className="btn-secondary">
              <ArrowLeft size={16} />
              Back
            </Link>
            {!isCancelled && (
              <Link to={`/sales/${sale.id}/edit`} className="btn-secondary">
                <Pencil size={16} />
                Edit
              </Link>
            )}
            <Link to={`/sales/${sale.id}/invoice`} className="btn-secondary">
              <Printer size={16} />
              Print Invoice
            </Link>
            {!isCancelled && <SendInvoiceSmsButton type="sale" id={sale.id} />}
            <button type="button" className="btn-secondary" onClick={handleDownload}>
              <Download size={16} />
              Download
            </button>
            {!isCancelled && (
              <button type="button" className="btn-danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 size={16} />
                Cancel Sale
              </button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 space-y-4 lg:col-span-1">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">Customer</h2>
          <div className="space-y-3 text-sm">
            <DetailRow label="Name">{sale.customer}</DetailRow>
            <DetailRow label="Phone">{sale.customerPhone || '—'}</DetailRow>
            <DetailRow label="Email">{sale.customerEmail || '—'}</DetailRow>
            <DetailRow label="Address">{sale.customerAddress || '—'}</DetailRow>
          </div>
        </div>

        <div className="card p-5 space-y-4 lg:col-span-2">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">Payment</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Payment status">
              <PaymentStatusBadge status={sale.paymentStatus} />
            </DetailRow>
            <DetailRow label="Payment method">{sale.paymentMethod}</DetailRow>
            <DetailRow label="Payment date">{formatDate(sale.paymentDate || sale.date)}</DetailRow>
            <DetailRow label="Sale status">
              <SaleStatusBadge status={sale.saleStatus} />
            </DetailRow>
            <DetailRow label="Amount paid">{formatCurrency(sale.amountPaid ?? 0)}</DetailRow>
            <DetailRow label="Balance due">{formatCurrency(sale.balance ?? 0)}</DetailRow>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">Products</h2>
          <p className="text-sm text-slate-500">{items.length} line item(s)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/90">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Serial Number</th>
                <th className="px-4 py-3 font-semibold">Qty</th>
                <th className="px-4 py-3 font-semibold">Unit Price</th>
                <th className="px-4 py-3 font-semibold">Discount</th>
                <th className="px-4 py-3 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((item, idx) => (
                <tr key={item.id ?? idx}>
                  <td className="px-4 py-3">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium">{item.productName}</td>
                  <td className="px-4 py-3 text-slate-500">{item.serial_number || '—'}</td>
                  <td className="px-4 py-3">{item.quantity}</td>
                  <td className="px-4 py-3">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-4 py-3">{formatCurrency(item.discount || 0)}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(item.total ?? item.quantity * item.unitPrice - (item.discount || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-display font-semibold text-slate-900 dark:text-white mb-4">Summary</h2>
        <div className="ml-auto max-w-sm space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-medium">{formatCurrency(sale.subtotal ?? sale.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Discount</span>
            <span className="font-medium text-red-600">− {formatCurrency(sale.discount ?? 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Tax ({sale.taxRate ?? 0}%)</span>
            <span className="font-medium">{formatCurrency(sale.tax ?? 0)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 text-base font-bold">
            <span>Grand Total</span>
            <span className="text-brand-600">{formatCurrency(sale.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Amount Paid</span>
            <span className="font-medium">{formatCurrency(sale.amountPaid ?? 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Balance Due</span>
            <span className="font-semibold text-red-600">{formatCurrency(sale.balance ?? 0)}</span>
          </div>
        </div>
        {sale.notes && (
          <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
            <p className="label">Notes</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{sale.notes}</p>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-5 space-y-4">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">Payment History</h2>
          {sale.payments?.length === 0 && !(sale.unrecordedPaidAmount > 0) ? (
            <p className="text-sm text-slate-500">No payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Method</th>
                    <th className="py-2 pr-3 font-medium">Reference</th>
                    <th className="py-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.unrecordedPaidAmount > 0 && (
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500">
                      <td className="py-2 pr-3" colSpan={3}>
                        Paid before payment history was tracked
                      </td>
                      <td className="py-2 text-right font-medium">{formatCurrency(sale.unrecordedPaidAmount)}</td>
                    </tr>
                  )}
                  {(sale.payments || []).map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDate(p.paymentDate)}</td>
                      <td className="py-2 pr-3">{p.paymentMethod || '—'}</td>
                      <td className="py-2 pr-3">{p.reference || p.notes || '—'}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="text-sm flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
            <span className="text-slate-500">Paid / Balance</span>
            <span className="font-medium">
              {formatCurrency(sale.amountPaid ?? 0)} / {formatCurrency(sale.balance ?? 0)}
            </span>
          </div>
        </div>

        {sale.balance > 0 &&
          !['Cancelled', 'Refunded'].includes(sale.saleStatus) &&
          (can('payments.manage') || can('sales.update')) && (
            <form onSubmit={handleAddPayment} className="card p-5 space-y-4">
              <h2 className="font-display font-semibold text-slate-900 dark:text-white">Add Payment</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Amount</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={sale.balance}
                    className="input-field"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">Payment Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, paymentDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Method</label>
                  <select
                    className="input-field"
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Reference</label>
                  <input
                    type="text"
                    className="input-field"
                    value={paymentForm.reference}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, reference: e.target.value }))}
                    placeholder="Cheque / transfer ref"
                  />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <input
                  type="text"
                  className="input-field"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={paying}>
                {paying ? 'Saving...' : 'Record Payment'}
              </button>
            </form>
          )}
      </div>

      <DeleteSaleDialog
        open={deleteOpen}
        onClose={() => !cancelling && setDeleteOpen(false)}
        onConfirm={handleDelete}
        sale={sale}
      />
    </div>
  )
}
