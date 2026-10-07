import { Loader2 } from 'lucide-react'
import Modal from './Modal'

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose?.()}
      title={title}
      size="sm"
      closeOnOverlay={!loading}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            disabled={loading}
            onClick={() => onConfirm?.()}
          >
            {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
            {confirmText}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
    </Modal>
  )
}
