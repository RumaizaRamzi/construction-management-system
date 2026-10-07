import ConfirmDialog from '../ui/ConfirmDialog'

export default function DeleteConfirmation({ open, onClose, onConfirm, productName }) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete Product"
      message={
        productName
          ? `Are you sure you want to delete "${productName}"? This action cannot be undone.`
          : 'Are you sure you want to delete this product?'
      }
      confirmText="Delete Product"
      danger
    />
  )
}
