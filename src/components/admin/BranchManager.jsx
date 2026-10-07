import { useCallback, useEffect, useState } from 'react'
import { Edit2, Plus, Trash2 } from 'lucide-react'
import DataTable from '../ui/DataTable'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import StatusBadge from '../ui/StatusBadge'
import LoadingState from '../ui/LoadingState'
import ApiErrorState from '../ui/ApiErrorState'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import adminService from '../../services/adminService'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'

const EMPTY = { name: '', code: '', address: '', phone: '', status: 'Active' }

export default function BranchManager() {
  const { loadBranches } = useApp()
  const { success, error: toastError } = useToast()
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setBranches(await adminService.getBranches())
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Unable to load branches.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const refresh = () => {
    load()
    loadBranches?.()
  }

  const openForm = (branch = null) => {
    setEditing(branch || 'new')
    setForm(branch ? { name: branch.name, code: branch.code, address: branch.address, phone: branch.phone, status: branch.status } : EMPTY)
    setErrors({})
  }

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((p) => ({ ...p, [key]: undefined }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setErrors({ name: 'Branch name is required.' })
      return
    }
    setSaving(true)
    try {
      const { message } = editing === 'new' ? await adminService.createBranch(form) : await adminService.updateBranch(editing.id, form)
      success(message)
      setEditing(null)
      refresh()
    } catch (err) {
      const fe = getApiValidationErrors(err)
      setErrors(fe)
      toastError(fe.name || getApiErrorMessage(err, 'Unable to save branch.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      const { message } = await adminService.deleteBranch(deleteTarget.id)
      success(message)
      refresh()
    } catch (err) {
      const fe = getApiValidationErrors(err)
      toastError(Object.values(fe)[0] || getApiErrorMessage(err, 'Unable to delete branch.'))
    } finally {
      setDeleteTarget(null)
      setSaving(false)
    }
  }

  const columns = [
    { key: 'name', label: 'Branch', render: (b) => <span className="font-medium text-slate-900 dark:text-white">{b.name}</span> },
    { key: 'code', label: 'Code', render: (b) => b.code || '—' },
    { key: 'phone', label: 'Phone', render: (b) => b.phone || '—' },
    { key: 'address', label: 'Address', wrap: true, render: (b) => b.address || '—' },
    { key: 'status', label: 'Status', render: (b) => <StatusBadge status={b.status} /> },
    {
      key: 'actions',
      label: '',
      render: (b) => (
        <div className="flex gap-1">
          <button type="button" className="btn-secondary !px-2 !py-1" onClick={() => openForm(b)} title="Edit" aria-label={`Edit ${b.name}`}>
            <Edit2 size={14} />
          </button>
          <button type="button" className="btn-danger !px-2 !py-1" onClick={() => setDeleteTarget(b)} title="Delete" aria-label={`Delete ${b.name}`}>
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div>
          <h3 className="font-display text-lg font-semibold">Branches</h3>
          <p className="text-xs text-slate-500">Branches that are in use cannot be deleted; set them to Inactive instead.</p>
        </div>
        <button type="button" className="btn-primary justify-center" onClick={() => openForm()}>
          <Plus size={16} />
          Add Branch
        </button>
      </div>

      {loading && !branches.length ? (
        <LoadingState label="Loading branches…" />
      ) : loadError && !branches.length ? (
        <ApiErrorState title="Unable to load branches" message={loadError} onRetry={load} />
      ) : (
        <DataTable columns={columns} data={branches} emptyTitle="No branches yet." emptyDescription="Add your first branch." />
      )}

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing === 'new' ? 'Add Branch' : 'Edit Branch'}
        size="sm"
        closeOnOverlay={!saving}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Branch Name</label>
            <input className="input-field" value={form.name} maxLength={150} onChange={set('name')} autoFocus />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Code <span className="font-normal text-slate-400">(Optional)</span></label>
              <input className="input-field" value={form.code} maxLength={30} onChange={set('code')} />
            </div>
            <div>
              <label className="label">Phone <span className="font-normal text-slate-400">(Optional)</span></label>
              <input className="input-field" value={form.phone} maxLength={50} onChange={set('phone')} />
            </div>
          </div>
          <div>
            <label className="label">Address <span className="font-normal text-slate-400">(Optional)</span></label>
            <input className="input-field" value={form.address} maxLength={500} onChange={set('address')} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input-field" value={form.status} onChange={set('status')}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !saving && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete branch"
        message={`Delete the "${deleteTarget?.name}" branch? Branches linked to records cannot be deleted.`}
        confirmText="Delete"
        danger
        loading={saving}
      />
    </section>
  )
}
