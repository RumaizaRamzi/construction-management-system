import { Plus } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'
import Modal from './Modal'

const EMPTY_BRANCH = { name: '', code: '', address: '', phone: '' }

/** Optional branch picker; admins (branches.manage) can create a branch inline. */
export default function BranchSelect({ value, onChange, label = 'Branch', error, className = '' }) {
  const { branches = [], addBranch, can } = useApp()
  const { success, error: toastError } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState(EMPTY_BRANCH)
  const [draftErrors, setDraftErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const canCreate = can('branches.manage')
  const selected = value != null && value !== '' ? String(value) : ''
  const options = branches.filter((b) => b.status !== 'Inactive' || String(b.id) === selected)

  const openCreate = () => {
    setDraft(EMPTY_BRANCH)
    setDraftErrors({})
    setCreateOpen(true)
  }

  const saveBranch = async () => {
    if (saving) return
    if (!draft.name.trim()) {
      setDraftErrors({ name: 'Branch name is required.' })
      return
    }
    setSaving(true)
    try {
      const { branch, message } = await addBranch(draft)
      success(message || 'Branch created successfully.')
      onChange?.(String(branch.id))
      setCreateOpen(false)
    } catch (err) {
      const fieldErrors = getApiValidationErrors(err)
      if (fieldErrors.name) setDraftErrors({ name: fieldErrors.name })
      toastError(getApiErrorMessage(err, 'Unable to create branch.'))
    } finally {
      setSaving(false)
    }
  }

  const setDraftField = (key, val) => setDraft((prev) => ({ ...prev, [key]: val }))
  const submitOnEnter = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveBranch()
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2">
        <label className="label">
          {label} <span className="font-normal text-slate-400">(Optional)</span>
        </label>
        {canCreate ? (
          <button
            type="button"
            onClick={openCreate}
            className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            <Plus size={12} /> Create Branch
          </button>
        ) : null}
      </div>
      <select className="input-field" value={selected} onChange={(e) => onChange?.(e.target.value)}>
        <option value="">No branch</option>
        {options.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
            {b.status === 'Inactive' ? ' (Inactive)' : ''}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {createOpen
        ? createPortal(
            <Modal
              open
              size="sm"
              title="Create Branch"
              onClose={() => !saving && setCreateOpen(false)}
              footer={
                <>
                  <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)} disabled={saving}>
                    Cancel
                  </button>
                  <button type="button" className="btn-primary" onClick={saveBranch} disabled={saving}>
                    {saving ? 'Saving...' : 'Create Branch'}
                  </button>
                </>
              }
            >
              <div className="space-y-3">
                <div>
                  <label className="label">Branch Name</label>
                  <input
                    autoFocus
                    className="input-field"
                    value={draft.name}
                    onChange={(e) => setDraftField('name', e.target.value)}
                    onKeyDown={submitOnEnter}
                    placeholder="e.g. Head Office"
                    maxLength={150}
                  />
                  {draftErrors.name && <p className="mt-1 text-xs text-red-600">{draftErrors.name}</p>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Code <span className="font-normal text-slate-400">(Optional)</span></label>
                    <input className="input-field" value={draft.code} onChange={(e) => setDraftField('code', e.target.value)} onKeyDown={submitOnEnter} maxLength={30} />
                  </div>
                  <div>
                    <label className="label">Phone <span className="font-normal text-slate-400">(Optional)</span></label>
                    <input className="input-field" value={draft.phone} onChange={(e) => setDraftField('phone', e.target.value)} onKeyDown={submitOnEnter} maxLength={50} />
                  </div>
                </div>
                <div>
                  <label className="label">Address <span className="font-normal text-slate-400">(Optional)</span></label>
                  <input className="input-field" value={draft.address} onChange={(e) => setDraftField('address', e.target.value)} onKeyDown={submitOnEnter} maxLength={500} />
                </div>
              </div>
            </Modal>,
            document.body
          )
        : null}
    </div>
  )
}
