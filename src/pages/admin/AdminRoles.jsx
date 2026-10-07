import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BadgeCheck, Edit2, Eye, Lock, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import PermissionMatrix from '../../components/admin/PermissionMatrix'
import StaffRoles from '../staff/StaffRoles'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import adminService from '../../services/adminService'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'

const EMPTY_FORM = { name: '', description: '', permissions: [] }

function LoginRoles() {
  const { refreshUser } = useApp()
  const { success, error: toastError } = useToast()
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [roleRows, permissionRows] = await Promise.all([adminService.getRoles(), adminService.getPermissions()])
      setRoles(roleRows)
      setPermissions(permissionRows)
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Unable to load roles.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openForm = (role = null) => {
    setEditing(role || 'new')
    setErrors({})
    setForm(
      role
        ? { name: role.name, description: role.description || '', permissions: role.locked ? permissions.map((p) => p.slug) : role.permissions }
        : EMPTY_FORM
    )
  }

  const locked = editing && editing !== 'new' && editing.locked

  const handleSave = async () => {
    if (!form.name.trim()) {
      setErrors({ name: 'Role name is required.' })
      return
    }
    setSaving(true)
    try {
      const payload = { name: form.name.trim(), description: form.description.trim() || null, permissions: form.permissions }
      const { message } = editing === 'new' ? await adminService.createRole(payload) : await adminService.updateRole(editing.id, payload)
      success(message)
      setEditing(null)
      load()
      refreshUser().catch(() => {})
    } catch (err) {
      const fe = getApiValidationErrors(err)
      setErrors(fe)
      toastError(fe.name || getApiErrorMessage(err, 'Unable to save role.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      const { message } = await adminService.deleteRole(deleteTarget.id)
      success(message)
      load()
    } catch (err) {
      toastError(getApiErrorMessage(err, 'Unable to delete role.'))
    } finally {
      setDeleteTarget(null)
      setSaving(false)
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Role',
      render: (r) => (
        <span className="inline-flex items-center gap-2 font-medium text-slate-900 dark:text-white">
          {r.locked ? <Lock size={14} className="text-brand-600" aria-hidden /> : <ShieldCheck size={14} className="text-slate-400" aria-hidden />}
          {r.name}
        </span>
      ),
    },
    { key: 'description', label: 'Description', wrap: true, render: (r) => r.description || '—' },
    { key: 'permissions', label: 'Permissions', render: (r) => (r.locked ? 'Full access' : `${r.permissions.length} of ${permissions.length}`) },
    { key: 'users_count', label: 'Users', render: (r) => r.users_count },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex gap-1">
          <button type="button" className="btn-secondary !px-2 !py-1" onClick={() => openForm(r)} title={r.locked ? 'View' : 'Edit'} aria-label={`${r.locked ? 'View' : 'Edit'} ${r.name}`}>
            {r.locked ? <Eye size={14} /> : <Edit2 size={14} />}
          </button>
          {!r.locked && (
            <button
              type="button"
              className="btn-danger !px-2 !py-1 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => setDeleteTarget(r)}
              disabled={r.users_count > 0}
              title={r.users_count > 0 ? 'This role is assigned to users and cannot be deleted' : 'Delete'}
              aria-label={`Delete ${r.name}`}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ]

  if (loading && !roles.length) return <div className="card"><LoadingState label="Loading roles…" /></div>
  if (loadError && !roles.length) return <div className="card"><ApiErrorState title="Unable to load roles" message={loadError} onRetry={load} /></div>

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">Login roles decide what each user can see and do. The Admin role is locked with full access.</p>
        <button type="button" className="btn-primary justify-center" onClick={() => openForm()}>
          <Plus size={16} />
          Add Role
        </button>
      </div>

      <div className="card overflow-hidden">
        <DataTable columns={columns} data={roles} emptyTitle="No roles found." />
        <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">
          Roles assigned to any user cannot be deleted. Move those users to another role first.
        </p>
      </div>

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing === 'new' ? 'Add Role' : locked ? `${editing.name} (locked)` : `Edit ${editing?.name || 'Role'}`}
        size="xl"
        closeOnOverlay={!saving}
        footer={
          locked ? (
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Close</button>
          ) : (
            <>
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editing === 'new' ? 'Create Role' : 'Save Changes'}
              </button>
            </>
          )
        }
      >
        <div className="space-y-4">
          {locked && (
            <div className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
              <Lock size={16} className="mt-0.5 shrink-0" />
              The Admin role always has every permission and cannot be edited or deleted.
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="role-name">Name</label>
              <input
                id="role-name"
                className="input-field"
                value={form.name}
                maxLength={100}
                disabled={locked}
                onChange={(e) => {
                  setForm((f) => ({ ...f, name: e.target.value }))
                  setErrors((p) => ({ ...p, name: undefined }))
                }}
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>
            <div>
              <label className="label" htmlFor="role-description">Description <span className="font-normal text-slate-400">(Optional)</span></label>
              <input
                id="role-description"
                className="input-field"
                value={form.description}
                maxLength={500}
                disabled={locked}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="label !mb-0">Permissions</span>
              <span className="text-xs text-slate-500">{form.permissions.length} of {permissions.length} selected</span>
            </div>
            <PermissionMatrix
              permissions={permissions}
              selected={form.permissions}
              disabled={locked}
              onChange={(next) => setForm((f) => ({ ...f, permissions: next }))}
            />
            {errors.permissions && <p className="mt-1 text-xs text-red-600">{errors.permissions}</p>}
            <p className="mt-2 text-xs text-slate-500">
              A dash means the app has no separate permission for that action yet (for example, printing is allowed for anyone who can view the record).
            </p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !saving && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete role"
        message={`Delete the "${deleteTarget?.name}" role? This cannot be undone.`}
        confirmText="Delete"
        danger
        loading={saving}
      />
    </div>
  )
}

export default function AdminRoles() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'staff' ? 'staff' : 'login'

  const tabClass = (key) =>
    `inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition sm:flex-none ${
      tab === key
        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
    }`

  return (
    <div className="page-shell">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Login roles with permissions, and staff job roles"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Roles & Permissions' }]}
      />

      <div className="inline-flex w-full rounded-xl bg-slate-100 p-1 sm:w-auto dark:bg-slate-800" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'login'} className={tabClass('login')} onClick={() => setParams({}, { replace: true })}>
          <ShieldCheck size={16} />
          Login Roles & Permissions
        </button>
        <button type="button" role="tab" aria-selected={tab === 'staff'} className={tabClass('staff')} onClick={() => setParams({ tab: 'staff' }, { replace: true })}>
          <BadgeCheck size={16} />
          Staff Job Roles
        </button>
      </div>

      {tab === 'login' ? <LoginRoles /> : <StaffRoles />}
    </div>
  )
}
