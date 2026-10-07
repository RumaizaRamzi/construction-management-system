import ConfirmDialog from '../ui/ConfirmDialog'

export default function DeleteCheckDialog({ open, onClose, onConfirm, check }) {
  const label = check?.checkId || check?.check || 'this check'
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete Check"
      message={`Are you sure you want to delete ${label}? This maintenance check will be permanently removed.`}
      confirmText="Delete"
      danger
    />
  )
}
