import ConfirmDialog from '../ui/ConfirmDialog'

export default function DeleteExpenseDialog({ open, onClose, onConfirm, record }) {
  const label = record?.expenseId || 'this expense record'
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete Expense"
      message={`Are you sure you want to delete ${label}? This cannot be undone.`}
      confirmText="Delete"
      danger
    />
  )
}
