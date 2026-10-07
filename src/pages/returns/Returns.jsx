import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, Eye, Plus, Undo2 } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import SearchBar from '../../components/ui/SearchBar'
import FilterDropdown from '../../components/ui/FilterDropdown'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import Modal from '../../components/ui/Modal'
import StatusBadge from '../../components/ui/StatusBadge'
import StatCard from '../../components/ui/StatCard'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import { useApp } from '../../contexts/AppContext'
import { formatCurrency, formatDate, paginate } from '../../utils/helpers'
import { exportCsv as exportCsvFile } from '../../utils/exportHelpers'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Maintenance', label: 'Sent to maintenance' },
]

const RETURNABLE_STATUSES = ['Active', 'Overdue', 'Confirmed']

const lineSummary = (ret) =>
  ret.items?.length
    ? ret.items
        .map((line) => {
          const parts = [`${line.returnedQty} returned`]
          if (line.damagedQty) parts.push(`${line.damagedQty} damaged`)
          if (line.missingQty) parts.push(`${line.missingQty} missing`)
          return `${line.productName || 'Item'}: ${parts.join(', ')}`
        })
        .join('; ')
    : ''

export default function Returns() {
  const { returns, rentals, rentalsLoading, rentalsError, loadRentals, can } = useApp()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedRental, setSelectedRental] = useState('')

  const canReturn = can('rentals.return')
  const openRentals = useMemo(() => rentals.filter((r) => RETURNABLE_STATUSES.includes(r.rentalStatus)), [rentals])

  const stats = useMemo(
    () => ({
      total: returns.length,
      units: returns.reduce((sum, r) => sum + (r.returnedQty || 0) + (r.damagedQty || 0) + (r.missingQty || 0), 0),
      damagedOrMissing: returns.reduce((sum, r) => sum + (r.damagedQty || 0) + (r.missingQty || 0), 0),
      fees: returns.reduce((sum, r) => sum + (r.lateFee || 0) + (r.damageFee || 0), 0),
    }),
    [returns]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return returns.filter((r) => {
      const matchStatus = statusFilter === 'all' || r.returnStatus === statusFilter
      const matchSearch =
        !q ||
        String(r.rentalId || '').toLowerCase().includes(q) ||
        String(r.customer || '').toLowerCase().includes(q) ||
        String(r.product || '').toLowerCase().includes(q)
      return matchStatus && matchSearch
    })
  }, [returns, search, statusFilter])

  const paged = paginate(filtered, page, 10)

  const exportCsv = () =>
    exportCsvFile('returns', {
      name: 'Returns',
      columns: [
        { key: 'returnDate', label: 'Return Date' },
        { key: 'rentalId', label: 'Rental ID' },
        { key: 'customer', label: 'Customer' },
        { key: 'product', label: 'Products' },
        { key: 'lines', label: 'Item Breakdown', value: lineSummary },
        { key: 'returnedQty', label: 'Returned' },
        { key: 'damagedQty', label: 'Damaged' },
        { key: 'missingQty', label: 'Missing' },
        { key: 'lateDays', label: 'Late Days' },
        { key: 'lateFee', label: 'Late Fee' },
        { key: 'damageFee', label: 'Damage Fee' },
        { key: 'depositRefund', label: 'Deposit Refund' },
        { key: 'condition', label: 'Condition' },
        { key: 'returnStatus', label: 'Status' },
      ],
      rows: filtered,
    })

  const columns = [
    { key: 'returnDate', label: 'Date', render: (r) => formatDate(r.returnDate) },
    { key: 'rentalId', label: 'Rental ID' },
    { key: 'customer', label: 'Customer' },
    {
      key: 'product',
      label: 'Items',
      render: (r) => (
        <div className="max-w-xs">
          <p className="truncate">{r.product}</p>
          {r.items?.length > 1 && <p className="text-xs text-slate-500">{lineSummary(r)}</p>}
        </div>
      ),
    },
    { key: 'returnedQty', label: 'Returned' },
    { key: 'damagedQty', label: 'Damaged' },
    { key: 'missingQty', label: 'Missing' },
    { key: 'lateDays', label: 'Late Days' },
    { key: 'lateFee', label: 'Late Fee', render: (r) => formatCurrency(r.lateFee) },
    { key: 'damageFee', label: 'Damage Fee', render: (r) => formatCurrency(r.damageFee) },
    { key: 'depositRefund', label: 'Deposit Refund', render: (r) => formatCurrency(r.depositRefund) },
    { key: 'returnStatus', label: 'Status', render: (r) => <StatusBadge status={r.returnStatus} /> },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <Link to={`/rentals/${r.rentalDbId}`} className="btn-secondary !px-2 !py-1" title="View rental">
          <Eye size={14} />
        </Link>
      ),
    },
  ]

  if (rentalsLoading && !rentals.length) return <LoadingState label="Loading returns..." />
  if (rentalsError && !rentals.length) {
    return <ApiErrorState message={rentalsError} onRetry={() => loadRentals().catch(() => {})} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Breadcrumbs items={[{ label: 'Returns' }]} />
          <h1 className="page-title">Returns</h1>
          <p className="page-subtitle">Rental returns recorded against each rental, including damaged and missing units</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={exportCsv} disabled={!filtered.length}>
            <Download size={16} />
            Export CSV
          </button>
          {canReturn && (
            <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
              <Plus size={16} />
              Record Return
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Returns" value={stats.total} icon={Undo2} tone="brand" />
        <StatCard title="Units Processed" value={stats.units} icon={Undo2} tone="blue" />
        <StatCard title="Damaged / Missing" value={stats.damagedOrMissing} icon={Undo2} tone="red" />
        <StatCard title="Late + Damage Fees" value={formatCurrency(stats.fees)} icon={Undo2} tone="green" />
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search rental, customer, product..."
          className="min-w-[240px] flex-1"
        />
        <FilterDropdown
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
          options={STATUS_OPTIONS}
          className="w-52"
        />
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={paged.data}
          emptyTitle="No returns"
          emptyDescription="Returns appear here once equipment is checked back in from a rental."
        />
        <div className="px-4">
          <Pagination page={paged.page} totalPages={paged.totalPages} total={paged.total} onChange={setPage} />
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Return"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!selectedRental}
              onClick={() => navigate(`/rentals/${selectedRental}/return`)}
            >
              Continue
            </button>
          </>
        }
      >
        <label className="label" htmlFor="return-rental">
          Rental
        </label>
        <select
          id="return-rental"
          className="input-field"
          value={selectedRental}
          onChange={(e) => setSelectedRental(e.target.value)}
        >
          <option value="">Select an active rental</option>
          {openRentals.map((r) => (
            <option key={r.id} value={r.id}>
              {r.rentalId} — {r.customer} ({r.items?.map((i) => i.product).join(', ') || r.product})
            </option>
          ))}
        </select>
        {openRentals.length === 0 && <p className="mt-2 text-sm text-slate-500">There are no active rentals to return.</p>}
      </Modal>
    </div>
  )
}
