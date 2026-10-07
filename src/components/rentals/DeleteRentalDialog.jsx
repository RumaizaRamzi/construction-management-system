import ConfirmDialog from '../ui/ConfirmDialog'

export default function DeleteRentalDialog({ open, onClose, onConfirm, rental }) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete rental"
      message={
        rental
          ? `Are you sure you want to delete rental ${rental.rentalId || rental.rentalNumber}? This action cannot be undone.`
          : 'Are you sure you want to delete this rental?'
      }
      confirmText="Delete"
      danger
    />
  )
}
