import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchBar from '../../components/ui/SearchBar'
import FilterDropdown from '../../components/ui/FilterDropdown'
import DateRangePicker from '../../components/ui/DateRangePicker'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import StatusBadge from '../../components/ui/StatusBadge'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import activityService from '../../services/activityService'
import adminService from '../../services/adminService'
import { getApiErrorMessage } from '../../services/api'
import useDebouncedValue from '../../hooks/useDebouncedValue'

const ACTION_OPTIONS = [
  { value: 'all', label: 'All actions' },
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'status_changed', label: 'Status changed' },
  { value: 'deleted', label: 'Deleted' },
  { value: 'password_reset', label: 'Password reset' },
  { value: 'sms_test', label: 'Test SMS' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
]

const titleCase = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export const formatLogTime = (iso) => {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

/** `admin` renders Administration > Activity Logs (admin endpoint + user filter). */
export default function ActivityHistory({ admin = false }) {
  const [search, setSearch] = useState('')
  const [userId, setUserId] = useState('all')
  const [users, setUsers] = useState([])
  const [module, setModule] = useState('all')
  const [action, setAction] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [state, setState] = useState({ rows: [], meta: null, modules: [], loading: true, error: null })
  const [reloadKey, setReloadKey] = useState(0)
  const debouncedSearch = useDebouncedValue(search, 350)

  useEffect(() => {
    if (!admin) return
    adminService
      .getUsers({ per_page: 100 })
      .then((result) => setUsers(result.rows))
      .catch(() => setUsers([]))
  }, [admin])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, userId, module, action, dateFrom, dateTo])

  useEffect(() => {
    const controller = new AbortController()
    setState((prev) => ({ ...prev, loading: true, error: null }))
    const fetchPage = admin ? adminService.getActivity : activityService.getActivity
    fetchPage(
      {
        search: debouncedSearch,
        user_id: admin ? userId : undefined,
        module,
        action,
        date_from: dateFrom,
        date_to: dateTo,
        page,
        per_page: 25,
      },
      controller.signal
    )
      .then((result) => setState({ ...result, loading: false, error: null }))
      .catch((err) => {
        if (controller.signal.aborted) return
        setState((prev) => ({ ...prev, loading: false, error: getApiErrorMessage(err, 'Unable to load activity history.') }))
      })
    return () => controller.abort()
  }, [admin, debouncedSearch, userId, module, action, dateFrom, dateTo, page, reloadKey])

  const moduleOptions = [
    { value: 'all', label: 'All modules' },
    ...state.modules.map((m) => ({ value: m, label: titleCase(m) })),
  ]

  const columns = [
    { key: 'created_at', label: 'When', render: (r) => formatLogTime(r.created_at) },
    { key: 'user_name', label: 'User' },
    { key: 'module', label: 'Module', render: (r) => titleCase(r.module) },
    { key: 'action', label: 'Action', render: (r) => <StatusBadge status={titleCase(r.action)} /> },
    { key: 'description', label: 'Description', wrap: true, className: 'min-w-[16rem]' },
  ]

  return (
    <div className="page-shell">
      <PageHeader
        title={admin ? 'Activity Logs' : 'Activity History'}
        subtitle="Who did what, and when, across the system"
        breadcrumbs={admin ? [{ label: 'Administration' }, { label: 'Activity Logs' }] : [{ label: 'Activity History' }]}
      />

      <div className="card space-y-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <SearchBar value={search} onChange={setSearch} placeholder="Search description, record, user..." className="flex-1" />
          {admin && (
            <FilterDropdown
              value={userId}
              onChange={setUserId}
              options={[{ value: 'all', label: 'All users' }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]}
              className="lg:w-48"
            />
          )}
          <FilterDropdown value={module} onChange={setModule} options={moduleOptions} className="lg:w-48" />
          <FilterDropdown value={action} onChange={setAction} options={ACTION_OPTIONS} className="lg:w-48" />
        </div>
        <DateRangePicker from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
      </div>

      <div className="card">
        {state.loading && !state.rows.length ? (
          <LoadingState label="Loading activity..." />
        ) : state.error ? (
          <ApiErrorState message={state.error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : (
          <>
            <DataTable
              columns={columns}
              data={state.rows}
              emptyTitle="No activity found"
              emptyDescription="Actions such as creating sales, returns, and payments are recorded here."
            />
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
        <History size={14} /> Activity records are read-only and cannot be edited or deleted from the application.
      </p>
    </div>
  )
}
