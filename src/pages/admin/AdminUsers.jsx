import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Edit2, KeyRound, Plus, Power, ShieldCheck, Trash2, UserCheck, UserCog, Users } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchBar from '../../components/ui/SearchBar'
import FilterDropdown from '../../components/ui/FilterDropdown'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import StatusBadge from '../../components/ui/StatusBadge'
import StatCard from '../../components/ui/StatCard'
import BranchSelect from '../../components/ui/BranchSelect'
import PermissionMatrix from '../../components/admin/PermissionMatrix'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import adminService from '../../services/adminService'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'
import { formatDateTime } from '../../utils/helpers'
import useDebouncedValue from '../../hooks/useDebouncedValue'

const PAGE_SIZE = 15

const EMPTY_FORM = {
  staff_id: '',
  name: '',
  email: '',
  phone: '',
  branch_id: '',
  role_id: '',
  status: 'Active',
  passwordMode: 'generate',
  password: '',
  must_change_password: true,
  access_mode: 'role',
  permissions: [],
}

const ACCESS_OPTIONS = [
  { value: 'role', label: 'Role default', hint: "Uses the features of the user's role." },
  { value: 'full', label: 'Full access', hint: 'Every feature. The Administration area stays admin-only.' },
  { value: 'custom', label: 'Selected features', hint: 'Only the features you tick below.' },
]

function AccessBadge({ row }) {
  if (row.is_admin) return <span className="text-xs font-medium text-brand-600">Administrator</span>
  if (row.access_mode === 'full') return <StatusBadge status="Full access" className="!border-emerald-200 !bg-emerald-50 !text-emerald-700 dark:!border-emerald-800 dark:!bg-emerald-950/40 dark:!text-emerald-300" />
  if (row.access_mode === 'custom') return <StatusBadge status={`${row.feature_count} feature${row.feature_count === 1 ? '' : 's'}`} className="!border-sky-200 !bg-sky-50 !text-sky-700 dark:!border-sky-800 dark:!bg-sky-950/40 dark:!text-sky-300" />
  return <span className="text-xs text-slate-500">Role default ({row.feature_count ?? 0})</span>
}

const EMPTY_RESET = { passwordMode: 'generate', password: '', must_change_password: true }

function PasswordFields({ value, onChange, error }) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
        {[
          ['generate', 'Generate a temporary password'],
          ['manual', 'Set a temporary password'],
        ].map(([mode, label]) => (
          <label key={mode} className="flex items-center gap-2 text-sm">
            <input type="radio" name="password-mode" checked={value.passwordMode === mode} onChange={() => onChange({ passwordMode: mode, password: '' })} />
            {label}
          </label>
        ))}
      </div>
      {value.passwordMode === 'manual' && (
        <div>
          <input
            type="text"
            className="input-field font-mono"
            value={value.password}
            onChange={(e) => onChange({ password: e.target.value })}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            maxLength={100}
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.must_change_password} onChange={(e) => onChange({ must_change_password: e.target.checked })} />
        Require a password change on first login
      </label>
    </div>
  )
}

export default function AdminUsers() {
  const { user: currentUser } = useApp()
  const { success, error: toastError } = useToast()

  const [state, setState] = useState({ rows: [], page: 1, totalPages: 1, total: 0, summary: null })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [roles, setRoles] = useState([])
  const debouncedSearch = useDebouncedValue(search, 300)

  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [staffOptions, setStaffOptions] = useState([])
  const [resetTarget, setResetTarget] = useState(null)
  const [resetForm, setResetForm] = useState(EMPTY_RESET)
  const [resetError, setResetError] = useState('')
  const [statusTarget, setStatusTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [revealed, setRevealed] = useState(null)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [permissionList, setPermissionList] = useState([])

  useEffect(() => {
    adminService.getUserOptions().then((o) => setRoles(o.roles)).catch(() => setRoles([]))
    adminService.getPermissions().then(setPermissionList).catch(() => setPermissionList([]))
  }, [])

  useEffect(() => setPage(1), [debouncedSearch, statusFilter, roleFilter])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setState(
        await adminService.getUsers({
          page,
          per_page: PAGE_SIZE,
          search: debouncedSearch.trim(),
          status: statusFilter,
          role_id: roleFilter,
        })
      )
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Unable to load users.'))
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, statusFilter, roleFilter])

  useEffect(() => {
    load()
  }, [load])

  const isSelf = (row) => Boolean(row && typeof row === 'object' && Number(row.id) === Number(currentUser?.id))

  const openForm = async (row = null) => {
    setEditing(row || 'new')
    setFormErrors({})
    setForm(
      row
        ? {
            ...EMPTY_FORM,
            staff_id: row.staff ? String(row.staff.id) : '',
            name: row.name || '',
            email: row.email || '',
            phone: row.phone || '',
            branch_id: row.branch_id ? String(row.branch_id) : '',
            role_id: row.role_id ? String(row.role_id) : '',
            status: row.status,
            access_mode: row.access_mode || 'role',
            permissions: row.permissions || [],
          }
        : { ...EMPTY_FORM, role_id: String(roles.find((r) => r.slug === 'staff')?.id || roles[0]?.id || '') }
    )
    try {
      const options = await adminService.getUserOptions(row?.id)
      setStaffOptions(options.staff)
      setRoles(options.roles)
    } catch {
      setStaffOptions([])
    }
  }

  const patchForm = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setFormErrors((prev) => {
      const next = { ...prev }
      Object.keys(patch).forEach((k) => delete next[k])
      return next
    })
  }

  const chooseStaff = (staffId) => {
    const staff = staffOptions.find((s) => String(s.id) === staffId)
    patchForm({
      staff_id: staffId,
      ...(staff && editing === 'new'
        ? {
            name: form.name || staff.full_name,
            email: form.email || staff.email || '',
            phone: form.phone || staff.phone || '',
            branch_id: form.branch_id || (staff.branch_id ? String(staff.branch_id) : ''),
          }
        : {}),
    })
  }

  const selectedRoleIsAdmin = roles.find((r) => String(r.id) === String(form.role_id))?.slug === 'admin'

  const validate = () => {
    const errs = {}
    if (!form.name.trim() && !form.staff_id) errs.name = 'Enter a name or choose a staff member.'
    if (!form.email.trim()) errs.email = 'Email address is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'Enter a valid email address.'
    if (!form.role_id) errs.role_id = 'Please choose a role.'
    if (editing === 'new' && form.passwordMode === 'manual' && form.password.length < 8) {
      errs.password = 'The password must be at least 8 characters.'
    }
    if (!selectedRoleIsAdmin && form.access_mode === 'custom' && form.permissions.length === 0) {
      errs.permissions = 'Select at least one feature, or choose full access.'
    }
    return errs
  }

  const handleSave = async (e) => {
    e?.preventDefault()
    const errs = validate()
    setFormErrors(errs)
    if (Object.keys(errs).length) return

    const payload = {
      staff_id: form.staff_id ? Number(form.staff_id) : null,
      name: form.name.trim() || null,
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      branch_id: form.branch_id ? Number(form.branch_id) : null,
      role_id: Number(form.role_id),
      ...(selectedRoleIsAdmin || isSelf(editing)
        ? {}
        : { access_mode: form.access_mode, permissions: form.access_mode === 'custom' ? form.permissions : [] }),
    }

    setSaving(true)
    try {
      if (editing === 'new') {
        const result = await adminService.createUser({
          ...payload,
          status: form.status,
          password: form.passwordMode === 'manual' ? form.password : null,
          must_change_password: form.must_change_password,
        })
        success(result.message)
        if (result.generatedPassword) setRevealed({ name: result.user?.name, password: result.generatedPassword })
      } else {
        const result = await adminService.updateUser(editing.id, payload)
        success(result.message)
      }
      setEditing(null)
      load()
    } catch (err) {
      setFormErrors(getApiValidationErrors(err))
      toastError(getApiErrorMessage(err, 'Unable to save user.'))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (resetForm.passwordMode === 'manual' && resetForm.password.length < 8) {
      setResetError('The password must be at least 8 characters.')
      return
    }
    setSaving(true)
    try {
      const result = await adminService.resetPassword(resetTarget.id, {
        password: resetForm.passwordMode === 'manual' ? resetForm.password : null,
        must_change_password: resetForm.must_change_password,
      })
      success(result.message)
      if (result.generatedPassword) setRevealed({ name: resetTarget.name, password: result.generatedPassword })
      setResetTarget(null)
      load()
    } catch (err) {
      setResetError(getApiValidationErrors(err).password || '')
      toastError(getApiErrorMessage(err, 'Unable to reset password.'))
    } finally {
      setSaving(false)
    }
  }

  const handleStatus = async () => {
    setSaving(true)
    try {
      const next = statusTarget.status === 'Active' ? 'Inactive' : 'Active'
      const { message } = await adminService.setUserStatus(statusTarget.id, next)
      success(message)
      setStatusTarget(null)
      load()
    } catch (err) {
      toastError(getApiErrorMessage(err, 'Unable to update login status.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      const { message } = await adminService.deleteUser(deleteTarget.id)
      success(message)
      setDeleteTarget(null)
      load()
    } catch (err) {
      toastError(getApiErrorMessage(err, 'Unable to delete user.'))
      setDeleteTarget(null)
    } finally {
      setSaving(false)
    }
  }

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(revealed.password)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toastError('Copy failed. Select the password and copy it manually.')
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'User',
      render: (r) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {r.name} {isSelf(r) && <span className="text-xs font-normal text-slate-400">(you)</span>}
          </p>
          <p className="truncate text-xs text-slate-500">{r.email}</p>
        </div>
      ),
    },
    {
      key: 'staff',
      label: 'Linked Staff',
      render: (r) => (r.staff ? <span className="text-sm">{r.staff.full_name} <span className="text-xs text-slate-500">({r.staff.staff_code})</span></span> : <span className="text-slate-400">Standalone</span>),
    },
    {
      key: 'role',
      label: 'Role',
      render: (r) => (
        <span className="inline-flex items-center gap-1 text-sm">
          {r.is_admin && <ShieldCheck size={14} className="text-brand-600" aria-hidden />}
          {r.role || '—'}
        </span>
      ),
    },
    { key: 'access', label: 'Access', render: (r) => <AccessBadge row={r} /> },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <div className="space-y-1">
          <StatusBadge status={r.status} />
          {r.must_change_password && <p className="text-[11px] text-amber-600 dark:text-amber-400">Must change password</p>}
        </div>
      ),
    },
    { key: 'last_login_at', label: 'Last Login', render: (r) => (r.last_login_at ? formatDateTime(r.last_login_at) : <span className="text-slate-400">Never</span>) },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex gap-1">
          <button type="button" className="btn-secondary !px-2 !py-1" title="Edit" aria-label={`Edit ${r.name}`} onClick={() => openForm(r)}>
            <Edit2 size={14} />
          </button>
          <button
            type="button"
            className="btn-secondary !px-2 !py-1"
            title="Reset password"
            aria-label={`Reset password for ${r.name}`}
            onClick={() => {
              setResetTarget(r)
              setResetForm(EMPTY_RESET)
              setResetError('')
            }}
          >
            <KeyRound size={14} />
          </button>
          {!isSelf(r) && (
            <>
              <button
                type="button"
                className={`${r.status === 'Active' ? 'btn-danger' : 'btn-secondary'} !px-2 !py-1`}
                title={r.status === 'Active' ? 'Disable login' : 'Enable login'}
                aria-label={`${r.status === 'Active' ? 'Disable' : 'Enable'} login for ${r.name}`}
                onClick={() => setStatusTarget(r)}
              >
                {r.status === 'Active' ? <Power size={14} /> : <UserCheck size={14} />}
              </button>
              <button type="button" className="btn-danger !px-2 !py-1" title="Delete" aria-label={`Delete ${r.name}`} onClick={() => setDeleteTarget(r)}>
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  const summary = state.summary

  return (
    <div className="page-shell">
      <PageHeader
        title="Users & Logins"
        subtitle="Login accounts, roles and passwords"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Users & Logins' }]}
        actions={
          <button type="button" className="btn-primary" onClick={() => openForm()}>
            <Plus size={16} aria-hidden />
            Add User
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Users" value={summary?.total ?? 0} icon={Users} tone="brand" loading={!summary} />
        <StatCard title="Active Logins" value={summary?.active ?? 0} icon={UserCheck} tone="green" loading={!summary} />
        <StatCard title="Active Admins" value={summary?.admins ?? 0} icon={ShieldCheck} tone="violet" loading={!summary} />
        <StatCard title="Must Change Password" value={summary?.must_change_password ?? 0} icon={KeyRound} tone="blue" loading={!summary} />
      </div>

      <div className="card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <div className="sm:col-span-2">
            <label className="label">Search</label>
            <SearchBar value={search} onChange={setSearch} placeholder="Name, email, phone or staff..." />
          </div>
          <FilterDropdown
            label="Role"
            value={roleFilter}
            onChange={setRoleFilter}
            options={[{ value: 'all', label: 'All roles' }, ...roles.map((r) => ({ value: String(r.id), label: r.name }))]}
          />
          <FilterDropdown
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' },
            ]}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading && !state.rows.length ? (
          <LoadingState label="Loading users…" />
        ) : loadError && !state.rows.length ? (
          <ApiErrorState title="Unable to load users" message={loadError} onRetry={load} />
        ) : (
          <>
            <DataTable columns={columns} data={state.rows} emptyTitle="No users found." emptyDescription="Try a different search or filter." />
            <div className="border-t border-slate-200 px-4 dark:border-slate-800">
              <Pagination page={state.page} totalPages={state.totalPages} total={state.total} onChange={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing === 'new' ? 'Add User' : 'Edit User'}
        size={form.access_mode === 'custom' && !selectedRoleIsAdmin ? 'xl' : 'lg'}
        closeOnOverlay={!saving}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
            <button type="submit" form="admin-user-form" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing === 'new' ? 'Create User' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form id="admin-user-form" onSubmit={handleSave} className="space-y-4" noValidate>
          <div>
            <label className="label">Link to Staff Member <span className="font-normal text-slate-400">(Optional)</span></label>
            <select className="input-field" value={form.staff_id} onChange={(e) => chooseStaff(e.target.value)}>
              <option value="">Standalone login (not linked to staff)</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.staff_code}{s.role_name ? ` · ${s.role_name}` : ''})
                </option>
              ))}
            </select>
            {formErrors.staff_id && <p className="mt-1 text-xs text-red-600">{formErrors.staff_id}</p>}
            <p className="mt-1 text-xs text-slate-500">Only active staff without a login are listed. Deactivating the staff member disables this login.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Name</label>
              <input className="input-field" value={form.name} maxLength={255} onChange={(e) => patchForm({ name: e.target.value })} />
              {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input-field" value={form.email} maxLength={255} autoComplete="off" onChange={(e) => patchForm({ email: e.target.value })} />
              {formErrors.email && <p className="mt-1 text-xs text-red-600">{formErrors.email}</p>}
            </div>
            <div>
              <label className="label">Role</label>
              <select
                className="input-field"
                value={form.role_id}
                disabled={isSelf(editing)}
                onChange={(e) => patchForm({ role_id: e.target.value })}
              >
                <option value="">Select role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              {isSelf(editing) && <p className="mt-1 text-xs text-slate-500">You cannot change your own role.</p>}
              {formErrors.role_id && <p className="mt-1 text-xs text-red-600">{formErrors.role_id}</p>}
            </div>
            <div>
              <label className="label">Phone <span className="font-normal text-slate-400">(Optional)</span></label>
              <input className="input-field" value={form.phone} maxLength={50} onChange={(e) => patchForm({ phone: e.target.value })} />
              {formErrors.phone && <p className="mt-1 text-xs text-red-600">{formErrors.phone}</p>}
            </div>
            <BranchSelect value={form.branch_id} onChange={(v) => patchForm({ branch_id: v })} error={formErrors.branch_id} />
            {editing === 'new' && (
              <div>
                <label className="label">Login Status</label>
                <select className="input-field" value={form.status} onChange={(e) => patchForm({ status: e.target.value })}>
                  <option value="Active">Enabled</option>
                  <option value="Inactive">Disabled</option>
                </select>
              </div>
            )}
          </div>
          {editing === 'new' && (
            <div>
              <label className="label">Password</label>
              <PasswordFields value={form} onChange={patchForm} error={formErrors.password} />
            </div>
          )}
          <div>
            <label className="label">Feature Access</label>
            {selectedRoleIsAdmin ? (
              <p className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                Administrators always have full control over every feature, including the Administration area.
              </p>
            ) : isSelf(editing) ? (
              <p className="text-xs text-slate-500">You cannot change the feature access of your own account.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  {ACCESS_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors ${
                        form.access_mode === opt.value
                          ? 'border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-900/30'
                          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <span className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
                        <input type="radio" name="access-mode" checked={form.access_mode === opt.value} onChange={() => patchForm({ access_mode: opt.value, permissions: form.permissions })} />
                        {opt.label}
                      </span>
                      <span className="text-xs text-slate-500">{opt.hint}</span>
                    </label>
                  ))}
                </div>
                {form.access_mode === 'custom' && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">
                      {form.permissions.length} of {permissionList.length} features selected. The user can use only these features.
                    </p>
                    {permissionList.length ? (
                      <PermissionMatrix permissions={permissionList} selected={form.permissions} onChange={(next) => patchForm({ permissions: next })} />
                    ) : (
                      <p className="text-sm text-slate-500">Loading features…</p>
                    )}
                  </div>
                )}
                {formErrors.permissions && <p className="text-xs text-red-600">{formErrors.permissions}</p>}
                {formErrors.access_mode && <p className="text-xs text-red-600">{formErrors.access_mode}</p>}
              </div>
            )}
          </div>
        </form>
      </Modal>

      <Modal
        open={!!resetTarget}
        onClose={() => !saving && setResetTarget(null)}
        title={`Reset password · ${resetTarget?.name || ''}`}
        size="sm"
        closeOnOverlay={!saving}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setResetTarget(null)} disabled={saving}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleReset} disabled={saving}>
              {saving ? 'Resetting…' : 'Reset Password'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <PasswordFields
            value={resetForm}
            onChange={(patch) => {
              setResetForm((f) => ({ ...f, ...patch }))
              setResetError('')
            }}
            error={resetError}
          />
          {resetTarget && !isSelf(resetTarget) && <p className="text-xs text-slate-500">The user will be signed out of all devices.</p>}
        </div>
      </Modal>

      <Modal
        open={!!revealed}
        onClose={() => setRevealed(null)}
        title="Temporary password"
        size="sm"
        closeOnOverlay={false}
        footer={<button type="button" className="btn-primary" onClick={() => setRevealed(null)}>Done</button>}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Share this password with <strong>{revealed?.name}</strong>. It is shown only once and is not stored anywhere in readable form.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 select-all break-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-base text-slate-900 dark:bg-slate-800 dark:text-white">
              {revealed?.password}
            </code>
            <button type="button" className="btn-secondary !px-3" onClick={copyPassword} aria-label="Copy password">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!statusTarget}
        onClose={() => !saving && setStatusTarget(null)}
        onConfirm={handleStatus}
        title={statusTarget?.status === 'Active' ? 'Disable login' : 'Enable login'}
        message={
          statusTarget?.status === 'Active'
            ? `Disable login for ${statusTarget?.name}? They will be signed out and cannot sign in until re-enabled.`
            : `Enable login for ${statusTarget?.name}?`
        }
        confirmText={statusTarget?.status === 'Active' ? 'Disable' : 'Enable'}
        danger={statusTarget?.status === 'Active'}
        loading={saving}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !saving && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete user"
        message={`Permanently delete the login for ${deleteTarget?.name}? Their activity history is kept. Consider disabling the login instead.`}
        confirmText="Delete"
        danger
        loading={saving}
      />

      <p className="flex items-center gap-2 text-xs text-slate-500">
        <UserCog size={14} /> You cannot disable or delete your own account, and the last active Admin is always protected.
      </p>
    </div>
  )
}
