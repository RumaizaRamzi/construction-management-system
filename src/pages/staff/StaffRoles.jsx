import { useCallback, useEffect, useState } from 'react'
import { Edit2, Plus, Trash2 } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import { useToast } from '../../contexts/ToastContext'
import staffService from '../../services/staffService'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'

const EMPTY_FORM = { name: '', description: '' }

/** Staff job roles (shown in the Staff form). Rendered inside Administration > Roles & Permissions. */
export default function StaffRoles() {
  const { success, error: toastError } = useToast()
  const [roles, setRoles] = useState([])
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
      setRoles(await staffService.getRoles())
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Unable to load roles.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openForm = (role = null) => {
    setEditing(role || 'new')
    setForm(role ? { name: role.name, description: role.description } : EMPTY_FORM)
    setErrors({})
  }

  const closeForm = () => !saving && setEditing(null)

  const handleSave = async (e) => {
    e?.preventDefault()
    if (!form.name.trim()) {
      setErrors({ name: 'Role name is required.' })
      return
    }
    setSaving(true)
    try {
      const { message } = editing === 'new' ? await staffService.createRole(form) : await staffService.updateRole(editing.id, form)
      success(message)
      setEditing(null)
      load()
    } catch (error) {
      const fe = getApiValidationErrors(error)
      setErrors({ name: fe.name, description: fe.description })
      toastError(fe.name || getApiErrorMessage(error, 'Unable to save role.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const { message } = await staffService.deleteRole(deleteTarget.id)
      success(message)
      setDeleteTarget(null)
      load()
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to delete role.'))
      setDeleteTarget(null)
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { key: 'name', label: 'Role', render: (r) => <span className="font-medium text-slate-900 dark:text-white">{r.name}</span> },
    { key: 'description', label: 'Description', wrap: true, render: (r) => r.description || '—' },
    { key: 'staffCount', label: 'Staff', render: (r) => r.staffCount },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex gap-1">
          <button type="button" className="btn-secondary !px-2 !py-1" onClick={() => openForm(r)} title="Edit" aria-label={`Edit ${r.name}`}>
            <Edit2 size={14} />
          </button>
          <button
            type="button"
            className="btn-danger !px-2 !py-1 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => setDeleteTarget(r)}
            disabled={r.staffCount > 0}
            title={r.staffCount > 0 ? 'This role is assigned to staff and cannot be deleted' : 'Delete'}
            aria-label={`Delete ${r.name}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">Job roles appear in the Role dropdown on the Staff form. They do not grant any login permissions.</p>
        <button type="button" className="btn-primary justify-center" onClick={() => openForm()}>
          <Plus size={16} />
          Add Job Role
        </button>
      </div>

      {loading && roles.length === 0 ? (
        <div className="card"><LoadingState label="Loading roles..." /></div>
      ) : loadError && roles.length === 0 ? (
        <div className="card"><ApiErrorState title="Unable to load roles" message={loadError} onRetry={load} /></div>
      ) : (
        <div className="card overflow-hidden">
          <DataTable columns={columns} data={roles} emptyTitle="No roles added yet." emptyDescription="Add a role to start adding staff." />
          <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">
            Roles that are assigned to any staff member (including inactive staff) cannot be deleted.
          </p>
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={closeForm}
        title={editing === 'new' ? 'Add Job Role' : 'Edit Job Role'}
        size="sm"
        closeOnOverlay={!saving}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={closeForm} disabled={saving}>Cancel</button>
            <button type="submit" form="staff-role-form" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <form id="staff-role-form" onSubmit={handleSave} className="space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="role-name">Name</label>
            <input
              id="role-name"
              className="input-field"
              value={form.name}
              maxLength={100}
              autoFocus
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }))
                setErrors((p) => ({ ...p, name: undefined }))
              }}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>
          <div>
            <label className="label" htmlFor="role-description">Description <span className="font-normal text-slate-400">(Optional)</span></label>
            <textarea
              id="role-description"
              className="input-field"
              rows={3}
              maxLength={500}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
          </div>
        </form>
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
