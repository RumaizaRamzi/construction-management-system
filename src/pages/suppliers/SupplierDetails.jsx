import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Package, Plus, ShoppingBag, Wallet } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import { useApp } from '../../contexts/AppContext'
import supplierService from '../../services/supplierService'
import { getApiErrorMessage } from '../../services/api'
import { formatCurrency, formatDate, paginate } from '../../utils/helpers'

function DetailRow({ label, children }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="font-medium text-slate-800 dark:text-slate-200">{children || '—'}</div>
    </div>
  )
}

export default function SupplierDetails() {
  const { id } = useParams()
  const { can } = useApp()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setData(await supplierService.getSupplierDetails(id))
    } catch (error) {
      setLoadError(error?.response?.status === 404 ? 'not-found' : getApiErrorMessage(error, 'Unable to load supplier.'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !data) return <LoadingState label="Loading supplier..." />

  if (loadError) {
    return (
      <div className="page-shell">
        <PageHeader title="Supplier" breadcrumbs={[{ label: 'Suppliers', to: '/suppliers' }, { label: loadError === 'not-found' ? 'Not found' : 'Error' }]} />
        {loadError === 'not-found' ? (
          <div className="card p-8 text-center">
            <p className="page-subtitle">The supplier you are looking for does not exist.</p>
            <Link to="/suppliers" className="btn-primary mt-6 inline-flex">
              <ArrowLeft size={18} />
              Back to Suppliers
            </Link>
          </div>
        ) : (
          <div className="card"><ApiErrorState title="Unable to load supplier" message={loadError} onRetry={load} /></div>
        )}
      </div>
    )
  }

  const { supplier, products, purchases, purchaseTotals } = data
  const showPurchases = can('purchases.view') && purchases !== null
  const totals = purchaseTotals || { count: 0, total_amount: 0, paid_amount: 0, outstanding: 0 }
  const paged = paginate(purchases || [], page, 10)

  const columns = [
    {
      key: 'purchaseNumber',
      label: 'Purchase #',
      render: (r) => (
        <Link to={`/purchases/${r.id}`} className="block hover:text-brand-600">
          <span className="font-medium text-slate-900 dark:text-white">{r.purchaseNumber}</span>
          {r.billNumber && <span className="block text-xs text-slate-500">Bill: {r.billNumber}</span>}
        </Link>
      ),
    },
    { key: 'purchaseDate', label: 'Date', render: (r) => formatDate(r.purchaseDate) },
    {
      key: 'items',
      label: 'Items',
      wrap: true,
      className: 'max-w-[260px]',
      render: (r) => <span className="text-xs text-slate-500">{r.productNames.join(', ') || '—'}</span>,
    },
    { key: 'totalAmount', label: 'Total', render: (r) => formatCurrency(r.totalAmount) },
    { key: 'paidAmount', label: 'Paid', render: (r) => formatCurrency(r.paidAmount) },
    {
      key: 'balance',
      label: 'Balance',
      render: (r) => <span className={r.balance > 0 && r.status !== 'Cancelled' ? 'font-medium text-red-600' : ''}>{formatCurrency(r.balance)}</span>,
    },
    { key: 'paymentStatus', label: 'Payment', render: (r) => <StatusBadge status={r.paymentStatus} /> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <div className="page-shell">
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {supplier.name}
            <StatusBadge status={supplier.status} />
          </span>
        }
        subtitle={supplier.supplierCode || 'Supplier'}
        breadcrumbs={[{ label: 'Suppliers', to: '/suppliers' }, { label: supplier.name }]}
        actions={
          <>
            <Link to="/suppliers" className="btn-secondary">
              <ArrowLeft size={16} />
              Back
            </Link>
            {can('purchases.create') && supplier.status !== 'Inactive' && (
              <Link to="/purchases/new" className="btn-primary">
                <Plus size={16} />
                New Purchase
              </Link>
            )}
          </>
        }
      />

      {showPurchases && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Purchases" value={totals.count} icon={ShoppingBag} tone="brand" />
          <StatCard title="Total Purchased" value={formatCurrency(totals.total_amount)} icon={Wallet} tone="blue" />
          <StatCard title="Total Paid" value={formatCurrency(totals.paid_amount)} icon={Wallet} tone="green" />
          <StatCard title="Outstanding Balance" value={formatCurrency(totals.outstanding)} icon={AlertCircle} tone="red" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 space-y-4 lg:col-span-2">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">Supplier Information</h2>
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <DetailRow label="Contact person">{supplier.contact}</DetailRow>
            <DetailRow label="Phone">{supplier.phone}</DetailRow>
            <DetailRow label="Email">{supplier.email}</DetailRow>
            <DetailRow label="Address">{supplier.address}</DetailRow>
            <DetailRow label="Products supplied">{supplier.productsSupplied}</DetailRow>
            <DetailRow label="Outstanding (supplier record)">{formatCurrency(supplier.outstanding)}</DetailRow>
          </div>
          {supplier.notes && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <p className="label">Notes</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{supplier.notes}</p>
            </div>
          )}
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="flex items-center gap-2 font-display font-semibold text-slate-900 dark:text-white">
            <Package size={16} />
            Products ({products.length})
          </h2>
          {products.length ? (
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto text-sm dark:divide-slate-800">
              {products.map((p) => (
                <li key={p.id} className="py-2">
                  {can('products.view') ? (
                    <Link to={`/products/${p.id}`} className="font-medium hover:text-brand-600">{p.name}</Link>
                  ) : <span className="font-medium">{p.name}</span>}
                  <span className="block text-xs text-slate-500">{p.serial_number}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No products linked to this supplier.</p>
          )}
        </div>
      </div>

      {showPurchases && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="font-display font-semibold text-slate-900 dark:text-white">Purchases</h2>
            <p className="text-sm text-slate-500">Outstanding balance counts only purchases that are not cancelled.</p>
          </div>
          <DataTable
            columns={columns}
            data={paged.data}
            emptyTitle="No purchases from this supplier yet."
            emptyDescription="Purchases recorded for this supplier appear here."
          />
          <div className="border-t border-slate-200 px-4 dark:border-slate-800">
            <Pagination page={paged.page} totalPages={paged.totalPages} total={paged.total} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  )
}
