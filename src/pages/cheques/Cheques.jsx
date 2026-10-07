import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BadgeCheck, Ban, CalendarClock, Edit2, Eye, Landmark, Plus, RefreshCw, Trash2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchBar from '../../components/ui/SearchBar'
import FilterDropdown from '../../components/ui/FilterDropdown'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import Pagination from '../../components/ui/Pagination'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import EmptyState from '../../components/ui/EmptyState'
import ChequeStatusModal from '../../components/cheques/ChequeStatusModal'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import chequeService from '../../services/chequeService'
import { getApiErrorMessage } from '../../services/api'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { CHEQUE_STATUSES, CHEQUE_TYPES, chequeDueText, chequeTypeLabel } from '../../utils/chequeHelpers'

const PAGE_SIZE = 10

export default function Cheques() {
  const { can } = useApp()
  const { success, error: toastError } = useToast()
  const [rows, setRows] = useState([])
  const [pageInfo, setPageInfo] = useState({ page: 1, totalPages: 1, total: 0 })
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [customerFilter, setCustomerFilter] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [statusTarget, setStatusTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const canCreate = can('cheques.create')
  const canUpdate = can('cheques.update')
  const canDelete = can('cheques.delete')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => setPage(1), [debouncedSearch, statusFilter, typeFilter, customerFilter, from, to])

  const loadSummary = useCallback(() => {
    chequeService.getSummary().then(setSummary).catch(() => setSummary(null))
  }, [])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await chequeService.getCheques({
        page,
        per_page: PAGE_SIZE,
        search: debouncedSearch,
        status: statusFilter,
        type: typeFilter,
        customer_id: customerFilter,
        from,
        to,
      })
      setRows(result.rows)
      setPageInfo({ page: result.page, totalPages: result.totalPages, total: result.total })
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Unable to load cheques. Please try again.'))
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, statusFilter, typeFilter, customerFilter, from, to])

  useEffect(() => {
    load()
  }, [load])

  const refresh = () => {
    load()
    loadSummary()
  }

  const hasFilters =
    Boolean(debouncedSearch) || statusFilter !== 'all' || typeFilter !== 'all' || customerFilter !== 'all' || Boolean(from) || Boolean(to)

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setTypeFilter('all')
    setCustomerFilter('all')
    setFrom('')
    setTo('')
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { message } = await chequeService.deleteCheque(deleteTarget.id)
      success(message)
      setDeleteTarget(null)
      refresh()
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to delete cheque.'))
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: 'chequeNumber',
      label: 'Cheque',
      render: (r) => (
        <Link to={`/cheques/${r.id}`} className="block hover:text-brand-600">
          <span className="block font-medium text-slate-900 dark:text-white">
            {r.chequeNumber || <span className="text-amber-600">Number missing</span>}
          </span>
          <span className="block text-xs text-slate-500">{r.bank || 'Bank not set'}</span>
        </Link>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (r) => (
        <span className={`text-xs font-medium ${r.type === 'issued' ? 'text-violet-600 dark:text-violet-400' : 'text-sky-600 dark:text-sky-400'}`}>
          {chequeTypeLabel(r.type)}
        </span>
      ),
    },
    { key: 'partyName', label: 'Customer / Supplier', render: (r) => r.partyName || '—' },
    { key: 'amount', label: 'Amount', render: (r) => <span className="font-medium">{formatCurrency(r.amount)}</span> },
    {
      key: 'chequeDate',
      label: 'Cheque Date',
      render: (r) => (
        <span className="whitespace-nowrap">
          {formatDate(r.chequeDate)}
          {chequeDueText(r) && (
            <span className={`block text-xs ${r.isOverdue ? 'text-red-600' : 'text-amber-600'}`}>{chequeDueText(r)}</span>
          )}
        </span>
      ),
    },
    {
      key: 'referenceLabel',
      label: 'Linked To',
      render: (r) =>
        r.referenceUrl ? (
          <Link to={r.referenceUrl} className="text-brand-600 hover:underline">
            {r.referenceLabel}
          </Link>
        ) : (
          '—'
        ),
    },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.isOverdue ? 'Overdue' : r.status} /> },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex gap-1">
          <Link to={`/cheques/${r.id}`} className="btn-secondary !px-2 !py-1" title={canUpdate ? 'Edit' : 'View'} aria-label={`Open cheque ${r.chequeNumber}`}>
            {canUpdate ? <Edit2 size={14} /> : <Eye size={14} />}
          </Link>
          {canUpdate && (
            <button type="button" className="btn-secondary !px-2 !py-1" onClick={() => setStatusTarget(r)} title="Update status" aria-label={`Update status of cheque ${r.chequeNumber}`}>
              <RefreshCw size={14} />
            </button>
          )}
          {canDelete && (
            <button type="button" className="btn-danger !px-2 !py-1" onClick={() => setDeleteTarget(r)} title="Delete" aria-label={`Delete cheque ${r.chequeNumber}`}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ]

  const noChequesAtAll = !loading && !loadError && !hasFilters && pageInfo.total === 0
  const statLabel = (t) => (t ? `${t.count} · ${formatCurrency(t.amount)}` : '0')

  return (
    <div className="page-shell">
      <PageHeader
        title="Cheques"
        subtitle="Received and issued cheques, due dates and clearance"
        breadcrumbs={[{ label: 'Finance' }, { label: 'Cheques' }]}
        actions={
          canCreate ? (
            <Link to="/cheques/new" className="btn-primary">
              <Plus size={16} />
              Add Cheque
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Pending" value={statLabel(summary?.pending)} icon={Landmark} tone="brand" loading={!summary} />
        <StatCard title="Due in 7 Days" value={statLabel(summary?.dueThisWeek)} icon={CalendarClock} tone="blue" loading={!summary} />
        <StatCard title="Overdue" value={statLabel(summary?.overdue)} icon={AlertTriangle} tone="red" loading={!summary} />
        <StatCard title="Cleared" value={statLabel(summary?.cleared)} icon={BadgeCheck} tone="green" loading={!summary} />
        <StatCard title="Bounced" value={statLabel(summary?.bounced)} icon={Ban} tone="slate" loading={!summary} />
      </div>

      <div className="card p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6 xl:items-end">
          <div className="sm:col-span-2">
            <label className="label">Search</label>
            <SearchBar value={search} onChange={setSearch} placeholder="Cheque number, bank, customer or supplier..." />
          </div>
          <FilterDropdown
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All statuses' },
              ...CHEQUE_STATUSES.map((s) => ({ value: s, label: s })),
              { value: 'Overdue', label: 'Overdue (pending)' },
            ]}
          />
          <FilterDropdown
            label="Type"
            value={typeFilter}
            onChange={setTypeFilter}
            options={[{ value: 'all', label: 'All types' }, ...CHEQUE_TYPES]}
          />
          <FilterDropdown
            label="Customer"
            value={customerFilter}
            onChange={setCustomerFilter}
            options={[{ value: 'all', label: 'All customers' }, ...(summary?.customers || []).map((c) => ({ value: String(c.id), label: c.name }))]}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">From</label>
              <input type="date" className="input-field" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input-field" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 flex justify-end">
            <button type="button" className="btn-secondary" onClick={clearFilters}>Clear filters</button>
          </div>
        )}
      </div>

      {loading && rows.length === 0 ? (
        <div className="card"><LoadingState label="Loading cheques..." /></div>
      ) : loadError && rows.length === 0 ? (
        <div className="card"><ApiErrorState title="Unable to load cheques" message={loadError} onRetry={load} /></div>
      ) : noChequesAtAll ? (
        <div className="card p-4">
          <EmptyState
            title="No cheques recorded yet."
            description="Add a cheque here, or record a payment with the Cheque method and it will appear automatically."
          />
          {canCreate && (
            <div className="mt-2 flex justify-center">
              <Link to="/cheques/new" className="btn-primary">
                <Plus size={16} />
                Add Cheque
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <p className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-800 dark:text-slate-200">{rows.length}</span> of{' '}
              <span className="font-medium text-slate-800 dark:text-slate-200">{pageInfo.total}</span> cheques
            </p>
          </div>
          <DataTable columns={columns} data={rows} emptyTitle="No cheques match your filters." emptyDescription="Try a different search or filter." />
          <div className="border-t border-slate-200 px-4 dark:border-slate-800">
            <Pagination page={pageInfo.page} totalPages={pageInfo.totalPages} total={pageInfo.total} onChange={setPage} />
          </div>
        </div>
      )}

      {statusTarget && (
        <ChequeStatusModal key={statusTarget.id} cheque={statusTarget} onClose={() => setStatusTarget(null)} onSaved={refresh} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete cheque"
        message={`Delete cheque ${deleteTarget?.chequeNumber || `#${deleteTarget?.id}`} for ${formatCurrency(deleteTarget?.amount || 0)}? This cannot be undone.`}
        confirmText="Delete"
        danger
        loading={deleting}
      />
    </div>
  )
}
