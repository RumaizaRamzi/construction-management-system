import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Ban, Pencil } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import StatusBadge from '../../components/ui/StatusBadge'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import CancelPurchaseDialog from '../../components/purchases/CancelPurchaseDialog'
import { useApp } from '../../contexts/AppContext'
import purchaseService from '../../services/purchaseService'
import { getApiErrorMessage } from '../../services/api'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/helpers'
import { LISTING_TYPE_LABELS } from '../../utils/productHelpers'

function DetailRow({ label, children }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="font-medium text-slate-800 dark:text-slate-200">{children}</div>
    </div>
  )
}

const listingText = (item) => {
  if (!item.listingType) return `Unchanged (${LISTING_TYPE_LABELS[item.productListingType] || '—'})`
  return LISTING_TYPE_LABELS[item.listingType] || item.listingType
}

export default function PurchaseDetails() {
  const { id } = useParams()
  const { can, branches = [] } = useApp()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setData(await purchaseService.getPurchase(id))
    } catch (error) {
      setLoadError(error?.response?.status === 404 ? 'not-found' : getApiErrorMessage(error, 'Unable to load purchase.'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !data) return <LoadingState label="Loading purchase..." />

  if (loadError === 'not-found' || (!loading && !data && !loadError)) {
    return (
      <div className="page-shell">
        <PageHeader title="Purchase not found" breadcrumbs={[{ label: 'Purchases', to: '/purchases' }, { label: 'Not found' }]} />
        <div className="card p-8 text-center">
          <p className="page-subtitle">The purchase you are looking for does not exist.</p>
          <Link to="/purchases" className="btn-primary mt-6 inline-flex">
            <ArrowLeft size={18} />
            Back to Purchases
          </Link>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="page-shell">
        <PageHeader title="Purchase" breadcrumbs={[{ label: 'Purchases', to: '/purchases' }, { label: 'Error' }]} />
        <div className="card"><ApiErrorState title="Unable to load purchase" message={loadError} onRetry={load} /></div>
      </div>
    )
  }

  const { purchase, cancelBlockers, activity } = data
  const isCancelled = purchase.status === 'Cancelled'
  const canEdit = can('purchases.edit') && !isCancelled
  const branch = branches.find((b) => String(b.id) === String(purchase.branchId))

  return (
    <div className="page-shell">
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {purchase.purchaseNumber}
            <StatusBadge status={purchase.paymentStatus} />
            <StatusBadge status={purchase.status} />
          </span>
        }
        subtitle={`${formatDate(purchase.purchaseDate)} · ${purchase.supplierName}`}
        breadcrumbs={[{ label: 'Purchases', to: '/purchases' }, { label: purchase.purchaseNumber }]}
        actions={
          <>
            <Link to="/purchases" className="btn-secondary">
              <ArrowLeft size={16} />
              Back
            </Link>
            {canEdit && (
              <>
                <Link to={`/purchases/${purchase.id}/edit`} className="btn-secondary">
                  <Pencil size={16} />
                  Edit
                </Link>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => setCancelOpen(true)}
                  disabled={cancelBlockers.length > 0}
                  title={cancelBlockers.length ? 'Some units are sold, rented or booked' : undefined}
                >
                  <Ban size={16} />
                  Cancel Purchase
                </button>
              </>
            )}
          </>
        }
      />

      {canEdit && cancelBlockers.length > 0 && (
        <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle size={16} />
            This purchase can no longer be cancelled
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {cancelBlockers.map((message) => <li key={message}>{message}</li>)}
          </ul>
        </div>
      )}

      {isCancelled && (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          Cancelled on {formatDateTime(purchase.cancelledAt)}. Stock from this purchase was reversed.
          {purchase.cancelReason && <span className="block mt-1">Reason: {purchase.cancelReason}</span>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 space-y-4 lg:col-span-1">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">Supplier</h2>
          <div className="space-y-3 text-sm">
            <DetailRow label="Supplier">
              {can('suppliers.view') ? (
                <Link to={`/suppliers/${purchase.supplierId}`} className="text-brand-600 hover:underline">{purchase.supplierName}</Link>
              ) : purchase.supplierName}
            </DetailRow>
            <DetailRow label="Bill / Reference No.">{purchase.billNumber || '—'}</DetailRow>
            <DetailRow label="Purchase date">{formatDate(purchase.purchaseDate)}</DetailRow>
            {(branches.length > 0 || purchase.branchId) && (
              <DetailRow label="Branch">{branch?.name || '—'}</DetailRow>
            )}
            <DetailRow label="Recorded by">{purchase.createdByName || '—'}</DetailRow>
          </div>
        </div>

        <div className="card p-5 space-y-4 lg:col-span-2">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">Payment</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Payment type">{purchase.paymentType}</DetailRow>
            <DetailRow label="Payment status"><StatusBadge status={purchase.paymentStatus} /></DetailRow>
            <DetailRow label="Total">{formatCurrency(purchase.totalAmount)}</DetailRow>
            <DetailRow label="Amount paid">{formatCurrency(purchase.paidAmount)}</DetailRow>
            <DetailRow label="Balance">
              <span className={purchase.balance > 0 ? 'text-red-600' : ''}>{formatCurrency(purchase.balance)}</span>
            </DetailRow>
          </div>
          {purchase.notes && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <p className="label">Notes</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{purchase.notes}</p>
            </div>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">Items</h2>
          <p className="text-sm text-slate-500">{purchase.items.length} line item(s) · {purchase.totalQuantity} unit(s)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/90">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Serial Number</th>
                <th className="px-4 py-3 font-semibold">Qty</th>
                <th className="px-4 py-3 font-semibold">Unit Cost</th>
                <th className="px-4 py-3 font-semibold">Listing</th>
                <th className="px-4 py-3 font-semibold">Prices</th>
                <th className="px-4 py-3 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {purchase.items.map((item, idx) => (
                <tr key={item.id ?? idx}>
                  <td className="px-4 py-3">{idx + 1}</td>
                  <td className="px-4 py-3">
                    {can('products.view') ? (
                      <Link to={`/products/${item.productId}`} className="font-medium hover:text-brand-600">{item.productName}</Link>
                    ) : <span className="font-medium">{item.productName}</span>}
                    {item.isNewProduct && <span className="ml-2 text-xs text-brand-600">New product</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{item.serialNumber || '—'}</td>
                  <td className="px-4 py-3">{item.quantity}{item.unit ? ` ${item.unit}` : ''}</td>
                  <td className="px-4 py-3">{formatCurrency(item.unitCost)}</td>
                  <td className="px-4 py-3">{listingText(item)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {item.salePrice != null && <div>Sale {formatCurrency(item.salePrice)}</div>}
                    {item.rentalPrice != null && <div>Rent {formatCurrency(item.rentalPrice)} / day</div>}
                    {item.salePrice == null && item.rentalPrice == null && '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 dark:border-slate-700">
                <td colSpan={7} className="px-4 py-3 text-right font-semibold">Total</td>
                <td className="px-4 py-3 text-right font-bold text-brand-600">{formatCurrency(purchase.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {can('activity.view') && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4">
            <h2 className="font-display font-semibold text-slate-900 dark:text-white">Activity History</h2>
          </div>
          {activity.length ? (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {activity.map((log) => (
                <li key={log.id} className="px-5 py-3">
                  <p className="text-sm text-slate-900 dark:text-white">{log.description}</p>
                  <p className="text-xs text-slate-500">{log.user_name} · {formatDateTime(log.created_at)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm text-slate-500">No activity recorded yet.</p>
          )}
        </div>
      )}

      <CancelPurchaseDialog
        purchase={cancelOpen ? purchase : null}
        onClose={() => setCancelOpen(false)}
        onCancelled={() => {
          setCancelOpen(false)
          load()
        }}
      />
    </div>
  )
}
