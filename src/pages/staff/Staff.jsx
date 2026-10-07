import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarOff, Edit2, Eye, Plus, UserCheck, UserMinus, Users, UserX } from 'lucide-react'
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
import StaffAvatar from '../../components/staff/StaffAvatar'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import staffService from '../../services/staffService'
import { getApiErrorMessage } from '../../services/api'
import { formatDate } from '../../utils/helpers'
import { STAFF_STATUSES } from '../../utils/staffHelpers'

const PAGE_SIZE = 10

export default function Staff() {
  const { can, branches = [] } = useApp()
  const { success, error: toastError } = useToast()
  const [rows, setRows] = useState([])
  const [pageInfo, setPageInfo] = useState({ page: 1, totalPages: 1, total: 0 })
  const [summary, setSummary] = useState(null)
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [statusTarget, setStatusTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  const canCreate = can('staff.create')
  const canUpdate = can('staff.update')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => setPage(1), [debouncedSearch, roleFilter, branchFilter, statusFilter])

  useEffect(() => {
    staffService.getRoles().then(setRoles).catch(() => setRoles([]))
  }, [])

  const loadSummary = useCallback(() => {
    staffService.getSummary().then(setSummary).catch(() => setSummary(null))
  }, [])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await staffService.getStaff({
        page,
        per_page: PAGE_SIZE,
        search: debouncedSearch || undefined,
        role_id: roleFilter !== 'all' ? roleFilter : undefined,
        branch_id: branchFilter !== 'all' ? branchFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      })
      setRows(result.rows)
      setPageInfo({ page: result.page, totalPages: result.totalPages, total: result.total })
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Unable to load staff. Please try again.'))
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, roleFilter, branchFilter, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const hasFilters = Boolean(debouncedSearch) || roleFilter !== 'all' || branchFilter !== 'all' || statusFilter !== 'all'

  const clearFilters = () => {
    setSearch('')
    setRoleFilter('all')
    setBranchFilter('all')
    setStatusFilter('all')
  }

  const handleStatusChange = async () => {
    if (!statusTarget) return
    setSaving(true)
    try {
      const next = statusTarget.status === 'Active' ? 'Inactive' : 'Active'
      const { message } = await staffService.setStatus(statusTarget.id, next)
      success(message)
      setStatusTarget(null)
      load()
      loadSummary()
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to update staff status.'))
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      key: 'fullName',
      label: 'Staff',
      render: (r) => (
        <Link to={`/staff/${r.id}`} className="flex items-center gap-3 hover:text-brand-600">
          <StaffAvatar staff={r} />
          <span className="min-w-0">
            <span className="block font-medium text-slate-900 dark:text-white">{r.fullName}</span>
            <span className="block text-xs text-slate-500">{r.staffCode} · {r.nic}</span>
          </span>
        </Link>
      ),
    },
    { key: 'roleName', label: 'Role', render: (r) => r.roleName || '—' },
    { key: 'branchName', label: 'Branch', render: (r) => r.branchName || '—' },
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
    { key: 'joinedDate', label: 'Joined', render: (r) => formatDate(r.joinedDate) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex gap-1">
          <Link to={`/staff/${r.id}`} className="btn-secondary !px-2 !py-1" title="View" aria-label={`View ${r.fullName}`}>
            <Eye size={14} />
          </Link>
          {canUpdate && (
            <>
              <Link to={`/staff/${r.id}/edit`} className="btn-secondary !px-2 !py-1" title="Edit" aria-label={`Edit ${r.fullName}`}>
                <Edit2 size={14} />
              </Link>
              {r.status === 'Active' ? (
                <button type="button" className="btn-danger !px-2 !py-1" onClick={() => setStatusTarget(r)} title="Deactivate" aria-label={`Deactivate ${r.fullName}`}>
                  <UserMinus size={14} />
                </button>
              ) : (
                <button type="button" className="btn-secondary !px-2 !py-1" onClick={() => setStatusTarget(r)} title="Reactivate" aria-label={`Reactivate ${r.fullName}`}>
                  <UserCheck size={14} />
                </button>
              )}
            </>
          )}
        </div>
      ),
    },
  ]

  const noStaffAtAll = !loading && !loadError && !hasFilters && pageInfo.total === 0

  return (
    <div className="page-shell">
      <PageHeader
        title="Staff"
        subtitle="Employees, roles and branches"
        breadcrumbs={[{ label: 'Staff' }]}
        actions={
          canCreate ? (
            <Link to="/staff/create" className="btn-primary">
              <Plus size={16} />
              Add Staff
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Staff" value={summary?.total ?? 0} icon={Users} tone="brand" loading={!summary} />
        <StatCard title="Active" value={summary?.active ?? 0} icon={UserCheck} tone="green" loading={!summary} />
        <StatCard title="Inactive" value={summary?.inactive ?? 0} icon={UserX} tone="slate" loading={!summary} />
        <StatCard title="On Leave Today" value={summary?.onLeaveToday ?? 0} icon={CalendarOff} tone="blue" loading={!summary} />
      </div>

      <div className="card p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 xl:items-end">
          <div className="sm:col-span-2">
            <label className="label">Search</label>
            <SearchBar value={search} onChange={setSearch} placeholder="Name, NIC, phone or staff code..." />
          </div>
          <FilterDropdown
            label="Role"
            value={roleFilter}
            onChange={setRoleFilter}
            options={[{ value: 'all', label: 'All roles' }, ...roles.map((r) => ({ value: String(r.id), label: r.name }))]}
          />
          <FilterDropdown
            label="Branch"
            value={branchFilter}
            onChange={setBranchFilter}
            options={[{ value: 'all', label: 'All branches' }, ...branches.map((b) => ({ value: String(b.id), label: b.name }))]}
          />
          <FilterDropdown
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[{ value: 'all', label: 'All statuses' }, ...STAFF_STATUSES.map((s) => ({ value: s, label: s }))]}
          />
        </div>
        {hasFilters && (
          <div className="mt-3 flex justify-end">
            <button type="button" className="btn-secondary" onClick={clearFilters}>Clear filters</button>
          </div>
        )}
      </div>

      {loading && rows.length === 0 ? (
        <div className="card"><LoadingState label="Loading staff..." /></div>
      ) : loadError && rows.length === 0 ? (
        <div className="card"><ApiErrorState title="Unable to load staff" message={loadError} onRetry={load} /></div>
      ) : noStaffAtAll ? (
        <div className="card p-4">
          <EmptyState title="No staff added yet." description="Add your first staff member to start tracking attendance and assignments." />
          {canCreate && (
            <div className="mt-2 flex justify-center">
              <Link to="/staff/create" className="btn-primary">
                <Plus size={16} />
                Add Staff
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <p className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-800 dark:text-slate-200">{rows.length}</span> of{' '}
              <span className="font-medium text-slate-800 dark:text-slate-200">{pageInfo.total}</span> staff
            </p>
          </div>
          <DataTable
            columns={columns}
            data={rows}
            emptyTitle="No staff match your filters."
            emptyDescription="Try a different search or filter."
          />
          <div className="border-t border-slate-200 px-4 dark:border-slate-800">
            <Pagination page={pageInfo.page} totalPages={pageInfo.totalPages} total={pageInfo.total} onChange={setPage} />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!statusTarget}
        onClose={() => !saving && setStatusTarget(null)}
        onConfirm={handleStatusChange}
        title={statusTarget?.status === 'Active' ? 'Deactivate staff member' : 'Reactivate staff member'}
        message={
          statusTarget?.status === 'Active'
            ? `Deactivate ${statusTarget?.fullName}? They will no longer appear on the attendance sheet or be assignable. Their attendance and assignment history is kept.`
            : `Reactivate ${statusTarget?.fullName}? They will appear on the attendance sheet again.`
        }
        confirmText={statusTarget?.status === 'Active' ? 'Deactivate' : 'Reactivate'}
        danger={statusTarget?.status === 'Active'}
        loading={saving}
      />
    </div>
  )
}
