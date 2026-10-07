import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Boxes, Download, Eye, History, Package, Pencil } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import FilterDropdown from '../../components/ui/FilterDropdown'
import DateRangePicker from '../../components/ui/DateRangePicker'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Pagination from '../../components/ui/Pagination'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import { useApp } from '../../contexts/AppContext'
import stockMovementService, { MOVEMENT_TYPE_LABELS, movementTypeLabel } from '../../services/stockMovementService'
import { getApiErrorMessage } from '../../services/api'
import { formatDate } from '../../utils/helpers'
import { exportCsv as exportCsvFile } from '../../utils/exportHelpers'

const PER_PAGE = 15

const TYPE_OPTIONS = [
  { value: 'all', label: 'All movement types' },
  ...Object.entries(MOVEMENT_TYPE_LABELS)
    .filter(([value]) => value !== 'SALE_CANCELLED')
    .map(([value, label]) => ({ value, label })),
]

const formatTime = (value) =>
  value ? new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—'

function MovementBadge({ movement }) {
  const tone =
    movement.quantity > 0
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
      : movement.quantity < 0
        ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${tone}`}>
      {movementTypeLabel(movement.movementType)}
    </span>
  )
}

function QuantityChange({ value }) {
  const cls = value > 0 ? 'text-emerald-600' : value < 0 ? 'text-red-600' : 'text-slate-500'
  return <span className={`font-semibold ${cls}`}>{value > 0 ? `+${value}` : value}</span>
}

export default function ProductStockHistory() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { can } = useApp()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const filterParams = useCallback(
    () => ({
      movement_type: typeFilter === 'all' ? undefined : typeFilter,
      from: dateFrom || undefined,
      to: dateTo || undefined,
    }),
    [typeFilter, dateFrom, dateTo]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await stockMovementService.getProductStockHistory(id, { ...filterParams(), page, per_page: PER_PAGE })
      setData(result)
      setNotFound(false)
    } catch (err) {
      if (err?.response?.status === 404) setNotFound(true)
      else setError(getApiErrorMessage(err, 'Unable to load stock history for this product.'))
    } finally {
      setLoading(false)
    }
  }, [id, page, filterParams])

  useEffect(() => {
    load()
  }, [load])

  const resetPage = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const referenceCell = (m) => {
    if (m.relatedSale && can('sales.view')) {
      return (
        <Link to={`/sales/${m.relatedSale.id}`} className="font-medium text-brand-600 hover:underline">
          {m.relatedSale.invoiceNumber}
        </Link>
      )
    }
    if (m.relatedRental && can('rentals.view')) {
      return (
        <Link to={`/rentals/${m.relatedRental.id}`} className="font-medium text-brand-600 hover:underline">
          {m.relatedRental.rentalNumber}
        </Link>
      )
    }
    if (m.relatedPurchase && can('purchases.view')) {
      return (
        <Link to={`/purchases/${m.relatedPurchase.id}`} className="font-medium text-brand-600 hover:underline">
          {m.relatedPurchase.purchaseNumber}
        </Link>
      )
    }
    return m.referenceNumber || '—'
  }

  const exportCsv = async () => {
    if (!data) return
    setExporting(true)
    try {
      const rows = []
      let current = 1
      let last = 1
      do {
        const result = await stockMovementService.getProductStockHistory(id, { ...filterParams(), page: current, per_page: 100 })
        rows.push(...result.movements)
        last = result.meta.totalPages
        current += 1
      } while (current <= last)

      exportCsvFile(`stock-history-${data.product.serial_number || data.product.id}`, {
        name: `Stock History — ${data.product.name}`,
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'time', label: 'Time' },
          { key: 'action', label: 'Action' },
          { key: 'quantity', label: 'Quantity' },
          { key: 'previousQuantity', label: 'Available Before' },
          { key: 'balance', label: 'Balance' },
          { key: 'reference', label: 'Reference' },
          { key: 'user', label: 'User' },
          { key: 'notes', label: 'Notes' },
        ],
        rows: rows.map((m) => ({
          ...m,
          date: formatDate(m.createdAt || m.date),
          time: formatTime(m.createdAt),
          action: movementTypeLabel(m.movementType),
          reference: m.referenceNumber || '—',
          notes: m.notes || '—',
        })),
      })
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to export stock history.'))
    } finally {
      setExporting(false)
    }
  }

  if (notFound) {
    return (
      <div className="page-shell">
        <Link to="/stock-history" className="btn-secondary w-fit">
          <ArrowLeft size={16} />
          Back to Stock History
        </Link>
        <div className="card">
          <EmptyState title="Product not found." description="This product may have been deleted." />
        </div>
      </div>
    )
  }

  if (!data && loading) return <LoadingState label="Loading stock history..." />

  if (!data && error) {
    return (
      <div className="page-shell">
        <Link to="/stock-history" className="btn-secondary w-fit">
          <ArrowLeft size={16} />
          Back to Stock History
        </Link>
        <div className="card">
          <ApiErrorState title="Unable to load stock history" message={error} onRetry={load} />
        </div>
      </div>
    )
  }

  const { product, summary, movements, meta } = data

  const columns = [
    { key: 'date', label: 'Date', render: (m) => formatDate(m.createdAt || m.date) },
    { key: 'time', label: 'Time', render: (m) => formatTime(m.createdAt) },
    { key: 'type', label: 'Action', render: (m) => <MovementBadge movement={m} /> },
    { key: 'quantity', label: 'Quantity', className: 'text-right', render: (m) => <QuantityChange value={m.quantity} /> },
    {
      key: 'balance',
      label: 'Balance',
      className: 'text-right',
      render: (m) => (
        <span title={`Available before: ${m.previousQuantity}`}>
          <span className="font-semibold text-slate-900 dark:text-white">{m.balance}</span>
          <span className="ml-1 text-xs text-slate-400">(from {m.previousQuantity})</span>
        </span>
      ),
    },
    { key: 'reference', label: 'Reference', render: referenceCell },
    { key: 'user', label: 'User', render: (m) => m.user || '—' },
    { key: 'notes', label: 'Notes', wrap: true, render: (m) => m.notes || '—' },
  ]

  return (
    <div className="page-shell">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Breadcrumbs items={[{ label: 'Stock History', to: '/stock-history' }, { label: product.name }]} />
          <h1 className="page-title break-words">{product.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span>
              Serial Number: <strong className="text-slate-700 dark:text-slate-300">{product.serial_number || '—'}</strong>
            </span>
            <span>
              Category: <strong className="text-slate-700 dark:text-slate-300">{product.category || '—'}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              Status: <StatusBadge status={product.status || '—'} />
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/stock-history" className="btn-secondary">
            <ArrowLeft size={16} />
            Back to Stock History
          </Link>
          <Link to={`/products/${product.id}`} className="btn-secondary">
            <Eye size={16} />
            View Product
          </Link>
          {can('products.update') && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/products', { state: { editProductId: product.id } })}
            >
              <Pencil size={16} />
              Edit Product
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={exportCsv} disabled={exporting || !summary.movementsCount}>
            <Download size={16} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard title="Current Stock" value={summary.currentStock} icon={Package} tone="brand" trend={product.unit ? `Total units (${product.unit})` : 'Total units'} />
        <StatCard title="Available Stock" value={summary.availableStock} icon={Boxes} tone="blue" trend={`${summary.rentedStock} rented out`} />
        <StatCard title="Total Stock In" value={`+${summary.totalIn}`} icon={ArrowUpRight} tone="green" />
        <StatCard title="Total Stock Out" value={`-${summary.totalOut}`} icon={ArrowDownRight} tone="red" />
        <StatCard
          title="Movements"
          value={summary.movementsCount}
          icon={History}
          tone="slate"
          trend={summary.lastMovementAt ? `Last: ${formatDate(summary.lastMovementAt)}` : 'No movements yet'}
        />
      </div>

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display font-semibold">Stock Movement History</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Only movements for this product. Balance is the available stock after each movement.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <FilterDropdown value={typeFilter} onChange={resetPage(setTypeFilter)} options={TYPE_OPTIONS} className="w-full sm:w-52" />
            <DateRangePicker from={dateFrom} to={dateTo} onFromChange={resetPage(setDateFrom)} onToChange={resetPage(setDateTo)} />
          </div>
        </div>

        {error ? (
          <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {loading ? (
          <LoadingState label="Loading movements..." />
        ) : !movements.length ? (
          <EmptyState
            title={summary.movementsCount ? 'No movements match these filters.' : 'No stock movements recorded yet.'}
            description={summary.movementsCount ? 'Try another movement type or date range.' : 'Sales, rentals, returns and stock adjustments for this product will appear here.'}
          />
        ) : (
          <>
            <DataTable columns={columns} data={movements} className="hidden md:block" />

            <div className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
              {movements.map((m) => (
                <div key={m.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <MovementBadge movement={m} />
                    <QuantityChange value={m.quantity} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <dt className="text-slate-500">Date</dt>
                    <dd className="text-right text-slate-800 dark:text-slate-200">
                      {formatDate(m.createdAt || m.date)} · {formatTime(m.createdAt)}
                    </dd>
                    <dt className="text-slate-500">Balance</dt>
                    <dd className="text-right font-semibold text-slate-800 dark:text-slate-200">
                      {m.balance} <span className="font-normal text-slate-400">(from {m.previousQuantity})</span>
                    </dd>
                    <dt className="text-slate-500">Reference</dt>
                    <dd className="text-right break-words">{referenceCell(m)}</dd>
                    <dt className="text-slate-500">User</dt>
                    <dd className="text-right text-slate-800 dark:text-slate-200 break-words">{m.user || '—'}</dd>
                  </dl>
                  {m.notes ? <p className="text-xs text-slate-500 break-words">{m.notes}</p> : null}
                </div>
              ))}
            </div>

            <div className="px-4">
              <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
