import ConfirmDialog from '../ui/ConfirmDialog'

export default function DeleteSaleDialog({ open, onClose, onConfirm, sale }) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Cancel sale"
      message={
        sale?.saleStatus === 'Cancelled'
          ? 'This sale is already cancelled.'
          : `Cancel sale ${sale?.invoiceNumber || ''}? Sold quantities will be restored to inventory. The sale record is kept for history.`
      }
      confirmText="Cancel sale"
      danger
    />
  )
}
