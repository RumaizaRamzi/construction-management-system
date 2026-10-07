import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import Modal from '../ui/Modal'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import purchaseService from '../../services/purchaseService'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'

/** Cancels a purchase after checking server-side that none of its units are sold, rented or booked. */
export default function CancelPurchaseDialog({ purchase, onClose, onCancelled }) {
  const { loadProducts, loadStockHistory } = useApp()
  const { success, error: toastError } = useToast()
  const [reason, setReason] = useState('')
  const [blockers, setBlockers] = useState([])
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)

  const open = Boolean(purchase)

  useEffect(() => {
    if (!purchase) return undefined
    let active = true
    setReason('')
    setBlockers([])
    setChecking(true)
    purchaseService
      .getPurchase(purchase.id)
      .then((data) => active && setBlockers(data.cancelBlockers))
      .catch(() => {})
      .finally(() => active && setChecking(false))
    return () => {
      active = false
    }
  }, [purchase])

  const handleConfirm = async () => {
    setSaving(true)
    try {
      const { message } = await purchaseService.cancelPurchase(purchase.id, reason)
      success(message)
      loadProducts().catch(() => {})
      loadStockHistory().catch(() => {})
      onCancelled?.()
    } catch (error) {
      const fieldErrors = getApiValidationErrors(error)
      if (fieldErrors.purchase) setBlockers([fieldErrors.purchase])
      toastError(fieldErrors.purchase || getApiErrorMessage(error, 'Unable to cancel purchase.'))
    } finally {
      setSaving(false)
    }
  }

  const blocked = blockers.length > 0

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose?.()}
      title={`Cancel purchase ${purchase?.purchaseNumber || ''}`}
      size="md"
      closeOnOverlay={!saving}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Keep Purchase
          </button>
          <button type="button" className="btn-danger" onClick={handleConfirm} disabled={saving || checking || blocked}>
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
            Cancel Purchase
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        {checking ? (
          <p className="text-slate-500">Checking whether this purchase can be cancelled…</p>
        ) : blocked ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle size={16} />
              This purchase cannot be cancelled
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {blockers.map((message) => <li key={message}>{message}</li>)}
            </ul>
          </div>
        ) : (
          <p className="text-slate-600 dark:text-slate-300">
            The purchased quantities are removed from stock and a &ldquo;Purchase Cancelled&rdquo; entry is added to Stock History.
            Products created by this purchase are kept.
          </p>
        )}
        {!blocked && (
          <div>
            <label className="label" htmlFor="purchase-cancel-reason">Reason (optional)</label>
            <textarea
              id="purchase-cancel-reason"
              className="input-field"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={saving}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}
