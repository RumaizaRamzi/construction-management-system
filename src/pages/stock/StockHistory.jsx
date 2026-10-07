import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Download, Eye, History, Package, Pencil } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchBar from '../../components/ui/SearchBar'
import FilterDropdown from '../../components/ui/FilterDropdown'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Pagination from '../../components/ui/Pagination'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import ActionsMenu from '../../components/ui/ActionsMenu'
import { useApp } from '../../contexts/AppContext'
import stockMovementService from '../../services/stockMovementService'
import { getApiErrorMessage } from '../../services/api'
import { formatDate, paginate } from '../../utils/helpers'
import { exportCsv as exportCsvFile } from '../../utils/exportHelpers'

export default function StockHistory() {
  const navigate = useNavigate()
  const { products, productsLoading, productsError, loadProducts, can } = useApp()
  const [summaries, setSummaries] = useState({})
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [page, setPage] = useState(1)

  const loadSummaries = useCallback(async () => {
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const rows = await stockMovementService.getProductSummaries()
      setSummaries(Object.fromEntries(rows.map((r) => [r.productId, r])))
    } catch (error) {
      setSummaryError(getApiErrorMessage(error, 'Unable to load stock movement totals.'))
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSummaries()
  }, [loadSummaries])

  const rows = useMemo(
    () =>
      products.map((p) => {
        const s = summaries[Number(p.id)]
        return {
          ...p,
          movementsCount: s?.movementsCount ?? 0,
          totalIn: s?.totalIn ?? 0,
          totalOut: s?.totalOut ?? 0,
          lastMovementAt: s?.lastMovementAt ?? null,
        }
      }),
    [products, summaries]
  )

  const categoryOptions = useMemo(() => {
    const names = [...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    return [{ value: 'all', label: 'All categories' }, ...names.map((n) => ({ value: n, label: n }))]
  }, [products])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((p) => {
        const matchSearch = !q || p.name?.toLowerCase().includes(q) || p.serial_number?.toLowerCase().includes(q)
        const matchCategory = category === 'all' || p.category === category
        return matchSearch && matchCategory
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rows, search, category])

  const stats = useMemo(() => {
    const list = Object.values(summaries)
    return {
      products: products.length,
      withMovements: list.length,
      inbound: list.reduce((sum, s) => sum + s.totalIn, 0),
      outbound: list.reduce((sum, s) => sum + s.totalOut, 0),
    }
  }, [summaries, products.length])

  const paged = paginate(filtered, page, 10)
  const movementValue = (value) => (summaryLoading || summaryError ? '—' : value)
  const lastMovement = (p) => (summaryError ? '—' : formatDate(p.lastMovementAt))

  const openHistory = (p) => navigate(`/stock-history/${p.id}`)
  const actionsFor = (p) => [
    { label: 'View Stock History', icon: History, onClick: () => openHistory(p) },
    { label: 'View Product', icon: Eye, onClick: () => navigate(`/products/${p.id}`) },
    can('products.update') && {
      label: 'Edit Product',
      icon: Pencil,
      onClick: () => navigate('/products', { state: { editProductId: p.id } }),
    },
  ]

  const exportCsv = () =>
    exportCsvFile('stock-history-products', {
      name: 'Stock History — Products',
      columns: [
        { key: 'name', label: 'Product' },
        { key: 'serial_number', label: 'Serial Number' },
        { key: 'category', label: 'Category' },
        { key: 'quantity', label: 'Current Stock' },
        { key: 'available', label: 'Available' },
        { key: 'status', label: 'Status' },
        { key: 'lastMovement', label: 'Last Movement' },
        { key: 'movementsCount', label: 'Movements' },
      ],
      rows: filtered.map((p) => ({ ...p, lastMovement: p.lastMovementAt ? formatDate(p.lastMovementAt) : '—' })),
    })

  const columns = [
    {
      key: 'name',
      label: 'Product',
      wrap: true,
      render: (p) => (
        <button
          type="button"
          className="text-left font-medium text-slate-900 hover:text-brand-600 dark:text-white"
          onClick={() => openHistory(p)}
        >
          {p.name}
        </button>
      ),
    },
    { key: 'serial_number', label: 'Serial Number', render: (p) => p.serial_number || '—' },
    { key: 'category', label: 'Category', wrap: true, render: (p) => p.category || '—' },
    { key: 'quantity', label: 'Current Stock', className: 'text-right', render: (p) => p.quantity },
    { key: 'available', label: 'Available', className: 'text-right', render: (p) => p.available },
    { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    { key: 'lastMovementAt', label: 'Last Movement', render: lastMovement },
    { key: 'movementsCount', label: 'Movements', className: 'text-right', render: (p) => movementValue(p.movementsCount) },
    { key: 'actions', label: 'Actions', className: 'text-right', render: (p) => <ActionsMenu items={actionsFor(p)} /> },
  ]

  return (
    <div className="page-shell">
      <PageHeader
        title="Stock History"
        subtitle="Select a product to see its complete stock movement history"
        breadcrumbs={[{ label: 'Stock History' }]}
        actions={
          <button type="button" className="btn-secondary" onClick={exportCsv} disabled={!filtered.length}>
            <Download size={16} />
            Export CSV
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Products" value={stats.products} icon={Package} tone="brand" />
        <StatCard title="Products With Movements" value={movementValue(stats.withMovements)} icon={History} tone="blue" />
        <StatCard title="Units In" value={movementValue(`+${stats.inbound}`)} icon={ArrowUpRight} tone="green" />
        <StatCard title="Units Out" value={movementValue(`-${stats.outbound}`)} icon={ArrowDownRight} tone="red" />
      </div>

      {summaryError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <span>{summaryError}</span>
          <button type="button" className="btn-secondary text-xs" onClick={loadSummaries}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search product name or serial number..."
          className="w-full sm:flex-1"
        />
        <FilterDropdown
          value={category}
          onChange={(v) => {
            setCategory(v)
            setPage(1)
          }}
          options={categoryOptions}
          className="w-full sm:w-56"
        />
      </div>

      <div className="card">
        {productsLoading && !products.length ? (
          <LoadingState label="Loading products..." />
        ) : productsError && !products.length ? (
          <ApiErrorState
            title="Unable to load products"
            message={productsError}
            onRetry={() => loadProducts().catch(() => {})}
          />
        ) : !filtered.length ? (
          <EmptyState
            title={products.length ? 'No products match your search.' : 'No data available yet.'}
            description={products.length ? 'Try a different product name, serial number or category.' : 'Products and their stock movements will appear here.'}
          />
        ) : (
          <>
            <DataTable columns={columns} data={paged.data} className="hidden md:block" />

            <div className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
              {paged.data.map((p) => (
                <div key={p.id} className="flex items-start gap-3 p-4">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openHistory(p)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-white break-words">{p.name}</p>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 break-words">
                      {p.serial_number || '—'} · {p.category || '—'}
                    </p>
                    <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <dt className="text-slate-500">Stock</dt>
                        <dd className="font-semibold text-slate-800 dark:text-slate-200">{p.quantity}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Available</dt>
                        <dd className="font-semibold text-slate-800 dark:text-slate-200">{p.available}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Last move</dt>
                        <dd className="font-semibold text-slate-800 dark:text-slate-200">{lastMovement(p)}</dd>
                      </div>
                    </dl>
                  </button>
                  <ActionsMenu items={actionsFor(p)} />
                </div>
              ))}
            </div>

            <div className="px-4">
              <Pagination page={paged.page} totalPages={paged.totalPages} total={paged.total} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
