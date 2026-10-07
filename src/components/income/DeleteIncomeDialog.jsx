import ConfirmDialog from '../ui/ConfirmDialog'

export default function DeleteIncomeDialog({ open, onClose, onConfirm, record }) {
  const label = record?.incomeId || 'this income record'
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete Income"
      message={`Are you sure you want to delete ${label}? This cannot be undone.`}
      confirmText="Delete"
      danger
    />
  )
}
