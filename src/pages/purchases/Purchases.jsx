import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Ban, Edit2, Eye, Package, Plus, ShoppingBag, Wallet } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchBar from '../../components/ui/SearchBar'
import FilterDropdown from '../../components/ui/FilterDropdown'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import Pagination from '../../components/ui/Pagination'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import CancelPurchaseDialog from '../../components/purchases/CancelPurchaseDialog'
import { useApp } from '../../contexts/AppContext'
import purchaseService, { PURCHASE_PAYMENT_STATUSES } from '../../services/purchaseService'
import { getApiErrorMessage } from '../../services/api'
import { formatCurrency, formatDate, paginate } from '../../utils/helpers'

const PAGE_SIZE = 10

export default function Purchases() {
  const { can } = useApp()
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [paymentStatus, setPaymentStatus] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [cancelTarget, setCancelTarget] = useState(null)

  const canCreate = can('purchases.create')
  const canEdit = can('purchases.edit')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setPurchases(await purchaseService.getPurchases())
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Unable to load purchases. Please try again.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => setPage(1), [search, supplierFilter, paymentStatus, statusFilter, from, to])

  const supplierOptions = useMemo(() => {
    const seen = new Map()
    purchases.forEach((p) => {
      if (p.supplierId && !seen.has(p.supplierId)) seen.set(p.supplierId, p.supplierName)
    })
    return [...seen.entries()]
      .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
      .map(([value, label]) => ({ value: String(value), label }))
  }, [purchases])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return purchases.filter((p) => {
      if (supplierFilter !== 'all' && String(p.supplierId) !== supplierFilter) return false
      if (paymentStatus !== 'all' && p.paymentStatus !== paymentStatus) return false
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (from && p.purchaseDate < from) return false
      if (to && p.purchaseDate > to) return false
      if (!q) return true
      return [p.purchaseNumber, p.billNumber, p.supplierName, ...p.productNames]
        .some((f) => String(f || '').toLowerCase().includes(q))
    })
  }, [purchases, search, supplierFilter, paymentStatus, statusFilter, from, to])

  const stats = useMemo(() => {
    const live = filtered.filter((p) => p.status !== 'Cancelled')
    return {
      count: live.length,
      total: live.reduce((sum, p) => sum + p.totalAmount, 0),
      outstanding: live.reduce((sum, p) => sum + p.balance, 0),
      units: live.reduce((sum, p) => sum + p.totalQuantity, 0),
    }
  }, [filtered])

  const paged = paginate(filtered, page, PAGE_SIZE)
  const hasFilters = search || supplierFilter !== 'all' || paymentStatus !== 'all' || statusFilter !== 'all' || from || to

  const clearFilters = () => {
    setSearch('')
    setSupplierFilter('all')
    setPaymentStatus('all')
    setStatusFilter('all')
    setFrom('')
    setTo('')
  }

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
    { key: 'supplierName', label: 'Supplier' },
    {
      key: 'items',
      label: 'Items',
      wrap: true,
      className: 'max-w-[260px]',
      render: (r) => (
        <div className="text-xs">
          <div className="font-medium text-slate-800 dark:text-slate-200">{r.itemsCount} item(s) · {r.totalQuantity} unit(s)</div>
          <div className="text-slate-500">{r.productNames.join(', ')}</div>
        </div>
      ),
    },
    { key: 'totalAmount', label: 'Total', render: (r) => formatCurrency(r.totalAmount) },
    {
      key: 'payment',
      label: 'Payment',
      render: (r) => (
        <div className="text-xs">
          <StatusBadge status={r.paymentStatus} />
          <div className="mt-1 text-slate-500">{r.paymentType} · Balance {formatCurrency(r.balance)}</div>
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex gap-1">
          <Link to={`/purchases/${r.id}`} className="btn-secondary !px-2 !py-1" title="View" aria-label={`View ${r.purchaseNumber}`}>
            <Eye size={14} />
          </Link>
          {canEdit && r.status !== 'Cancelled' && (
            <>
              <Link to={`/purchases/${r.id}/edit`} className="btn-secondary !px-2 !py-1" title="Edit" aria-label={`Edit ${r.purchaseNumber}`}>
                <Edit2 size={14} />
              </Link>
              <button type="button" className="btn-danger !px-2 !py-1" onClick={() => setCancelTarget(r)} title="Cancel" aria-label={`Cancel ${r.purchaseNumber}`}>
                <Ban size={14} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="page-shell">
      <PageHeader
        title="Purchases"
        subtitle="Stock bought from suppliers"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Purchases' }]}
        actions={
          canCreate ? (
            <Link to="/purchases/new" className="btn-primary">
              <Plus size={16} />
              New Purchase
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Purchases" value={stats.count} icon={ShoppingBag} tone="brand" loading={loading} />
        <StatCard title="Total Purchased" value={formatCurrency(stats.total)} icon={Wallet} tone="blue" loading={loading} />
        <StatCard title="Outstanding Balance" value={formatCurrency(stats.outstanding)} icon={AlertCircle} tone="red" loading={loading} />
        <StatCard title="Units Received" value={stats.units} icon={Package} tone="green" loading={loading} />
      </div>

      <div className="card p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6 md:items-end">
          <div className="xl:col-span-2">
            <label className="label">Search</label>
            <SearchBar value={search} onChange={setSearch} placeholder="Purchase #, bill, supplier, product..." />
          </div>
          <FilterDropdown
            label="Supplier"
            value={supplierFilter}
            onChange={setSupplierFilter}
            options={[{ value: 'all', label: 'All suppliers' }, ...supplierOptions]}
          />
          <FilterDropdown
            label="Payment Status"
            value={paymentStatus}
            onChange={setPaymentStatus}
            options={[{ value: 'all', label: 'All payment statuses' }, ...PURCHASE_PAYMENT_STATUSES.map((s) => ({ value: s, label: s }))]}
          />
          <div>
            <label className="label">From</label>
            <input type="date" className="input-field" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input-field" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          <FilterDropdown
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'Completed', label: 'Completed' },
              { value: 'Cancelled', label: 'Cancelled' },
            ]}
          />
          {hasFilters && (
            <div>
              <button type="button" className="btn-secondary w-full" onClick={clearFilters}>Clear filters</button>
            </div>
          )}
        </div>
      </div>

      {loading && purchases.length === 0 ? (
        <div className="card"><LoadingState label="Loading purchases..." /></div>
      ) : loadError && purchases.length === 0 ? (
        <div className="card"><ApiErrorState title="Unable to load purchases" message={loadError} onRetry={load} /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <p className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-800 dark:text-slate-200">{paged.data.length}</span> of{' '}
              <span className="font-medium text-slate-800 dark:text-slate-200">{filtered.length}</span> purchases
            </p>
          </div>
          <DataTable
            columns={columns}
            data={paged.data}
            emptyTitle={purchases.length ? 'No purchases match your filters.' : 'No purchases recorded yet.'}
            emptyDescription={purchases.length ? 'Try a different search or filter.' : 'Record stock bought from suppliers to update inventory.'}
          />
          <div className="border-t border-slate-200 px-4 dark:border-slate-800">
            <Pagination page={paged.page} totalPages={paged.totalPages} total={paged.total} onChange={setPage} />
          </div>
        </div>
      )}

      <CancelPurchaseDialog
        purchase={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onCancelled={() => {
          setCancelTarget(null)
          load()
        }}
      />
    </div>
  )
}
