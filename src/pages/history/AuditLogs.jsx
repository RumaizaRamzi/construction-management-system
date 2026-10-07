import { Fragment, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchBar from '../../components/ui/SearchBar'
import FilterDropdown from '../../components/ui/FilterDropdown'
import DateRangePicker from '../../components/ui/DateRangePicker'
import Pagination from '../../components/ui/Pagination'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import activityService from '../../services/activityService'
import { getApiErrorMessage } from '../../services/api'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import { formatLogTime } from './ActivityHistory'

const ACTION_OPTIONS = [
  { value: 'all', label: 'All actions' },
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'status_changed', label: 'Status changed' },
  { value: 'deleted', label: 'Deleted' },
]

const titleCase = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const displayValue = (value) => {
  if (value === null || value === undefined || value === '') return <span className="text-slate-400">—</span>
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return <code className="text-xs">{JSON.stringify(value)}</code>
  return String(value)
}

export default function AuditLogs() {
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [action, setAction] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState(null)
  const [state, setState] = useState({ rows: [], meta: null, types: [], loading: true, error: null })
  const [reloadKey, setReloadKey] = useState(0)
  const debouncedSearch = useDebouncedValue(search, 350)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, type, action, dateFrom, dateTo])

  useEffect(() => {
    const controller = new AbortController()
    setState((prev) => ({ ...prev, loading: true, error: null }))
    activityService
      .getAuditLogs(
        { search: debouncedSearch, auditable_type: type, action, date_from: dateFrom, date_to: dateTo, page, per_page: 25 },
        controller.signal
      )
      .then((result) => setState({ ...result, loading: false, error: null }))
      .catch((err) => {
        if (controller.signal.aborted) return
        setState((prev) => ({ ...prev, loading: false, error: getApiErrorMessage(err, 'Unable to load audit logs.') }))
      })
    return () => controller.abort()
  }, [debouncedSearch, type, action, dateFrom, dateTo, page, reloadKey])

  const typeOptions = [{ value: 'all', label: 'All record types' }, ...state.types.map((t) => ({ value: t, label: t }))]

  return (
    <div className="page-shell">
      <PageHeader
        title="Audit Logs"
        subtitle="Field-level history of changes to business records"
        breadcrumbs={[{ label: 'Audit Logs' }]}
      />

      <div className="card space-y-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <SearchBar value={search} onChange={setSearch} placeholder="Search record, user, type..." className="flex-1" />
          <FilterDropdown value={type} onChange={setType} options={typeOptions} className="lg:w-48" />
          <FilterDropdown value={action} onChange={setAction} options={ACTION_OPTIONS} className="lg:w-48" />
        </div>
        <DateRangePicker from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
      </div>

      <div className="card">
        {state.loading && !state.rows.length ? (
          <LoadingState label="Loading audit logs..." />
        ) : state.error ? (
          <ApiErrorState message={state.error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : !state.rows.length ? (
          <EmptyState title="No audit records found" description="Changes to records are captured automatically." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="min-w-[720px] w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
                    <th className="w-8 px-3 py-3" />
                    <th className="px-3 py-3">When</th>
                    <th className="px-3 py-3">User</th>
                    <th className="px-3 py-3">Action</th>
                    <th className="px-3 py-3">Record</th>
                    <th className="px-3 py-3">Fields changed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {state.rows.map((row) => {
                    const open = expanded === row.id
                    return (
                      <Fragment key={row.id}>
                        <tr
                          className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                          onClick={() => setExpanded(open ? null : row.id)}
                        >
                          <td className="px-3 py-3 text-slate-400">
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-label={open ? 'Hide changes' : 'Show changes'}
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpanded(open ? null : row.id)
                              }}
                            >
                              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">{formatLogTime(row.created_at)}</td>
                          <td className="whitespace-nowrap px-3 py-3">{row.user_name}</td>
                          <td className="px-3 py-3">
                            <StatusBadge status={titleCase(row.action)} />
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-medium">{row.auditable_type}</span>
                            {row.auditable_label ? <span className="text-slate-500"> · {row.auditable_label}</span> : null}
                          </td>
                          <td className="px-3 py-3 text-slate-500">
                            {row.changes.length ? row.changes.map((c) => c.field).slice(0, 4).join(', ') : '—'}
                            {row.changes.length > 4 ? ` +${row.changes.length - 4}` : ''}
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-slate-50/60 dark:bg-slate-900/40">
                            <td />
                            <td colSpan={5} className="px-3 py-3">
                              {row.changes.length ? (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-slate-500">
                                      <th className="py-1 pr-4">Field</th>
                                      <th className="py-1 pr-4">Old value</th>
                                      <th className="py-1">New value</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.changes.map((change) => (
                                      <tr key={change.field} className="align-top">
                                        <td className="py-1 pr-4 font-medium">{titleCase(change.field)}</td>
                                        <td className="py-1 pr-4 text-red-600 break-all">{displayValue(change.old)}</td>
                                        <td className="py-1 text-emerald-700 break-all">{displayValue(change.new)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="text-xs text-slate-500">No field values were recorded for this entry.</p>
                              )}
                              {row.ip_address && <p className="mt-2 text-xs text-slate-400">IP address: {row.ip_address}</p>}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4">
              <Pagination
                page={state.meta?.current_page || 1}
                totalPages={state.meta?.last_page || 1}
                total={state.meta?.total || 0}
                onChange={setPage}
              />
            </div>
          </>
        )}
      </div>
      <p className="flex items-center gap-2 text-xs text-slate-500">
        <ShieldCheck size={14} /> Audit records are read-only. Passwords, tokens and other secrets are never stored.
      </p>
    </div>
  )
}
