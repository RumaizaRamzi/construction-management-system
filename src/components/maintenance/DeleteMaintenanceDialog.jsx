import ConfirmDialog from '../ui/ConfirmDialog'

export default function DeleteMaintenanceDialog({ open, onClose, onConfirm, record }) {
  const label = record?.maintenanceId || 'this maintenance record'
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete Maintenance"
      message={`Are you sure you want to delete ${label}? This cannot be undone.`}
      confirmText="Delete"
      danger
    />
  )
}
