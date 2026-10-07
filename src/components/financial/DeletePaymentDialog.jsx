import ConfirmDialog from '../ui/ConfirmDialog'

export default function DeletePaymentDialog({ open, onClose, onConfirm, payment }) {
  const label = payment?.paymentId || 'this payment'
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete Payment"
      message={`Are you sure you want to delete this payment (${label})?`}
      confirmText="Delete"
      danger
    />
  )
}
