import { useState } from 'react'
import Modal from '../ui/Modal'
import StatusBadge from '../ui/StatusBadge'
import { useToast } from '../../contexts/ToastContext'
import chequeService from '../../services/chequeService'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'
import { CHEQUE_STATUSES } from '../../utils/chequeHelpers'
import { formatCurrency } from '../../utils/helpers'

/** Mount with a `key` per cheque so the selection resets when a different cheque is opened. */
export default function ChequeStatusModal({ cheque, onClose, onSaved }) {
  const { success, error: toastError } = useToast()
  const [status, setStatus] = useState(() => CHEQUE_STATUSES.find((s) => s !== cheque?.status) || 'Pending')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  if (!cheque) return null

  const handleSave = async () => {
    setSaving(true)
    setErrors({})
    try {
      const { cheque: updated, message } = await chequeService.updateStatus(cheque.id, status, note)
      success(message)
      onSaved?.(updated)
      onClose()
    } catch (err) {
      setErrors(getApiValidationErrors(err))
      toastError(getApiErrorMessage(err, 'Unable to update cheque status.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title="Update Cheque Status"
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={saving || status === cheque.status}>
            {saving ? 'Saving…' : 'Update Status'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
          <p className="font-medium text-slate-900 dark:text-white">
            Cheque {cheque.chequeNumber || `#${cheque.id}`} {cheque.bank && <span className="text-slate-500">· {cheque.bank}</span>}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-slate-500">
            {formatCurrency(cheque.amount)} · Current status <StatusBadge status={cheque.status} />
          </p>
        </div>
        <div>
          <label className="label">New status</label>
          <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
            {CHEQUE_STATUSES.map((s) => (
              <option key={s} value={s} disabled={s === cheque.status}>
                {s}
              </option>
            ))}
          </select>
          {errors.status && <p className="mt-1 text-xs text-red-600">{errors.status}</p>}
        </div>
        <div>
          <label className="label">Note (optional)</label>
          <textarea
            className="input-field"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={status === 'Bounced' ? 'e.g. Insufficient funds' : 'e.g. Deposited at main branch'}
          />
          {errors.note && <p className="mt-1 text-xs text-red-600">{errors.note}</p>}
        </div>
        {status === 'Bounced' && cheque.paymentId && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            This cheque is linked to a recorded payment. Marking it bounced does not reverse that payment; update the
            payment on {cheque.referenceLabel || 'the linked record'} if the amount is now unpaid.
          </p>
        )}
      </div>
    </Modal>
  )
}
