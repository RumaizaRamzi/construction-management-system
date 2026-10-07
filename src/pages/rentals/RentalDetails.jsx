import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Printer,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import LoadingState from '../../components/ui/LoadingState'
import ProductImage from '../../components/ui/ProductImage'
import SendInvoiceSmsButton from '../../components/ui/SendInvoiceSmsButton'
import {
  RentalSummary,
  RentalTimeline,
  RentalStatusBadge,
  DeleteRentalDialog,
} from '../../components/rentals'
import PaymentStatusBadge from '../../components/sales/PaymentStatusBadge'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage } from '../../services/api'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { RENTAL_PAYMENT_METHODS } from '../../utils/rentalHelpers'

const RETURNABLE_STATUSES = ['Active', 'Overdue', 'Confirmed']

export default function RentalDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    rentals,
    rentalsLoading,
    products,
    customers,
    deleteRental,
    loadRental,
    addRentalPayment,
  } = useApp()
  const { success, error: showError } = useToast()

  const rental = rentals.find((r) => String(r.id) === String(id))
  const customer = rental ? customers.find((c) => c.id === rental.customerId) : null
  const product = rental ? products.find((p) => p.id === rental.productId) : null

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [paying, setPaying] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'Cash',
    referenceNumber: '',
    notes: '',
  })

  useEffect(() => {
    if (!id) return
    loadRental(id).catch(() => {})
  }, [id, loadRental])

  useEffect(() => {
    if (!rental) return
    setPaymentForm((f) => ({
      ...f,
      amount: rental.balance > 0 ? String(rental.balance) : '',
      paymentMethod: rental.paymentMethod || 'Cash',
    }))
  }, [rental?.id, rental?.balance, rental?.paymentMethod])

  const canReturn = rental && RETURNABLE_STATUSES.includes(rental.rentalStatus)

  const handleDelete = async () => {
    if (!rental) return
    setDeleting(true)
    try {
      const result = await deleteRental(rental.id)
      success(result?.message || `Rental ${rental.rentalId || rental.rentalNumber} deleted.`)
      navigate('/rentals')
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to delete rental.'))
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  const handleAddPayment = async (e) => {
    e.preventDefault()
    if (!rental) return
    const amount = Number(paymentForm.amount)
    if (!(amount > 0)) {
      showError('Enter a valid payment amount.')
      return
    }
    setPaying(true)
    try {
      const { message } = await addRentalPayment(rental.id, paymentForm)
      success(message || 'Payment recorded.')
      setPaymentForm((f) => ({ ...f, amount: '', referenceNumber: '', notes: '' }))
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to record payment.'))
    } finally {
      setPaying(false)
    }
  }

  if (rentalsLoading && !rental) {
    return <LoadingState label="Loading rental..." />
  }

  if (!rental) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Rentals', to: '/rentals' }, { label: 'Not found' }]} />
        <div className="card p-8 text-center">
          <h1 className="page-title">Rental not found</h1>
          <p className="page-subtitle mt-2">
            The rental you are looking for does not exist or was removed.
          </p>
          <Link to="/rentals" className="btn-primary mt-6 inline-flex">
            <ArrowLeft size={18} />
            Back to Rentals
          </Link>
        </div>
      </div>
    )
  }

  const payments = rental.payments || []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Rentals', to: '/rentals' },
              { label: rental.rentalId || rental.rentalNumber },
            ]}
          />
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-title">{rental.rentalId || rental.rentalNumber}</h1>
            <RentalStatusBadge status={rental.rentalStatus} />
            <PaymentStatusBadge status={rental.paymentStatus} />
          </div>
          <p className="page-subtitle">
            {rental.product} — {rental.customer}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/rentals" className="btn-secondary">
            <ArrowLeft size={16} />
            Back
          </Link>
          <Link to={`/rentals/${rental.id}/edit`} className="btn-secondary">
            <Pencil size={16} />
            Edit
          </Link>
          {canReturn && (
            <Link to={`/rentals/${rental.id}/return`} className="btn-secondary">
              <RotateCcw size={16} />
              Return
            </Link>
          )}
          <Link to={`/rentals/${rental.id}/agreement`} className="btn-secondary">
            <Printer size={16} />
            Print Agreement
          </Link>
          <SendInvoiceSmsButton type="rental" id={rental.id} />
          <button type="button" className="btn-danger" onClick={() => setDeleteOpen(true)} disabled={deleting}>
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1 space-y-4">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">Customer</h2>
          <div>
            <p className="font-medium text-lg text-slate-900 dark:text-white">{rental.customer}</p>
            {(customer?.status || rental.customerId) && (
              <p className="text-xs text-slate-500 mt-1">Customer ID: {rental.customerId}</p>
            )}
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Phone size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <span>{rental.customerPhone || customer?.phone || '—'}</span>
            </div>
            <div className="flex items-start gap-3">
              <Mail size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <span>{rental.customerEmail || customer?.email || '—'}</span>
            </div>
            <div className="flex items-start gap-3">
              <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <span>{rental.customerAddress || customer?.address || '—'}</span>
            </div>
          </div>
        </div>

        <div className="card p-5 lg:col-span-2 space-y-4">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">Equipment</h2>
          <div className="flex flex-wrap gap-4">
            <ProductImage
              src={rental.productImage || product?.image}
              alt={rental.product}
              className="h-24 w-24 shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-medium text-lg text-slate-900 dark:text-white">{rental.product}</p>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-slate-500">Serial Number</p>
                  <p className="font-medium">{rental.product_serial_number || product?.serial_number || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Category</p>
                  <p className="font-medium">{rental.productCategory || product?.category || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Quantity</p>
                  <p className="font-medium">{rental.quantity} unit(s)</p>
                </div>
                <div>
                  <p className="text-slate-500">Condition</p>
                  <p className="font-medium">{rental.productCondition || product?.condition || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Daily Rate</p>
                  <p className="font-medium">{formatCurrency(rental.rate)}/day</p>
                </div>
                <div>
                  <p className="text-slate-500">Deposit</p>
                  <p className="font-medium">{formatCurrency(rental.deposit)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-display font-semibold text-slate-900 dark:text-white">Rental Period</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <p className="text-slate-500">Start Date</p>
            <p className="font-medium">{formatDate(rental.startDate)}</p>
          </div>
          <div>
            <p className="text-slate-500">Expected Return</p>
            <p className="font-medium">{formatDate(rental.expectedReturn)}</p>
          </div>
          <div>
            <p className="text-slate-500">Actual Return</p>
            <p className="font-medium">
              {rental.actualReturnDate ? formatDate(rental.actualReturnDate) : '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Duration</p>
            <p className="font-medium">{rental.duration} days</p>
          </div>
        </div>

        {(rental.notes || rental.specialInstructions || rental.deliveryNotes) && (
          <div className="grid gap-4 sm:grid-cols-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-sm">
            {rental.notes && (
              <div>
                <p className="text-slate-500">Notes</p>
                <p className="mt-1">{rental.notes}</p>
              </div>
            )}
            {rental.specialInstructions && (
              <div>
                <p className="text-slate-500">Special Instructions</p>
                <p className="mt-1">{rental.specialInstructions}</p>
              </div>
            )}
            {rental.deliveryNotes && (
              <div>
                <p className="text-slate-500">Delivery Notes</p>
                <p className="mt-1">{rental.deliveryNotes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RentalSummary rental={rental} />
        <RentalTimeline rental={rental} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-5 space-y-4">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">
            Payment History
          </h2>
          {payments.length === 0 ? (
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
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 pr-3">{formatDate(p.paymentDate)}</td>
                      <td className="py-2 pr-3">{p.paymentMethod || '—'}</td>
                      <td className="py-2 pr-3">{p.referenceNumber || '—'}</td>
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
              {formatCurrency(rental.amountPaid)} / {formatCurrency(rental.balance)}
            </span>
          </div>
        </div>

        {rental.balance > 0 && !['Cancelled', 'Refunded'].includes(rental.rentalStatus) && (
          <form onSubmit={handleAddPayment} className="card p-5 space-y-4">
            <h2 className="font-display font-semibold text-slate-900 dark:text-white">
              Add Payment
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Amount</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
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
                  {RENTAL_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Reference</label>
                <input
                  type="text"
                  className="input-field"
                  value={paymentForm.referenceNumber}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, referenceNumber: e.target.value }))}
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

      {rental.returnInfo && (
        <div className="card p-5 space-y-3">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">
            Return Information
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <p className="text-slate-500">Return Date</p>
              <p className="font-medium">{formatDate(rental.returnInfo.returnDate)}</p>
            </div>
            <div>
              <p className="text-slate-500">Condition</p>
              <p className="font-medium">{rental.returnInfo.condition || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500">Late Fee</p>
              <p className="font-medium">{formatCurrency(rental.lateFee || 0)}</p>
            </div>
            <div>
              <p className="text-slate-500">Damage Fee</p>
              <p className="font-medium">{formatCurrency(rental.damageFee || 0)}</p>
            </div>
            <div>
              <p className="text-slate-500">Returned / Damaged / Missing</p>
              <p className="font-medium">
                {rental.returnInfo.returnedQuantity ?? rental.returnInfo.returnedQty ?? 0}
                {' / '}
                {rental.returnInfo.damagedQuantity ?? rental.returnInfo.damagedQty ?? 0}
                {' / '}
                {rental.returnInfo.missingQuantity ?? rental.returnInfo.missingQty ?? 0}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Deposit Refund</p>
              <p className="font-medium text-emerald-600">
                {formatCurrency(rental.depositRefund || rental.returnInfo.depositRefund || 0)}
              </p>
            </div>
          </div>
          {rental.returnInfo.notes && (
            <p className="text-sm text-slate-500">{rental.returnInfo.notes}</p>
          )}
        </div>
      )}

      <DeleteRentalDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        rental={rental}
      />
    </div>
  )
}
