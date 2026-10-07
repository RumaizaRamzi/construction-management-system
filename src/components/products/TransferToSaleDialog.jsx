import { useEffect, useState } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import Modal from '../ui/Modal'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'

export default function TransferToSaleDialog({ product, onClose, onTransferred }) {
  const { transferProductToSale } = useApp()
  const { success, error: toastError } = useToast()
  const [salePrice, setSalePrice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!product) return
    setSalePrice(Number(product.salePrice) > 0 ? String(product.salePrice) : '')
    setError('')
  }, [product])

  const rentedOut = Number(product?.rented || 0)

  const close = () => {
    if (!saving) onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (salePrice === '' || !(Number(salePrice) > 0)) {
      setError('Enter a sale price greater than zero.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const result = await transferProductToSale(product.id, salePrice)
      success(result.message || 'Product transferred to sales inventory.')
      onTransferred?.(result.product)
      onClose()
    } catch (err) {
      const fieldErrors = getApiValidationErrors(err)
      const message = fieldErrors.sale_price || fieldErrors.product || getApiErrorMessage(err, 'Unable to transfer product.')
      setError(message)
      toastError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!product}
      onClose={close}
      title="Transfer to Sale"
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={close} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="transfer-to-sale-form" className="btn-primary" disabled={saving || rentedOut > 0}>
            <ArrowRightLeft size={16} aria-hidden />
            {saving ? 'Transferring...' : 'Transfer to Sale'}
          </button>
        </>
      }
    >
      {product ? (
        <form id="transfer-to-sale-form" onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <span className="font-medium text-slate-900 dark:text-white">{product.name}</span> ({product.serial_number}) will
            move from the rental inventory to the sales inventory. It will be available for sale and will no longer be
            offered for rent. Its details, stock and history stay the same.
          </p>
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
            <div>
              <p className="text-xs text-slate-500">Available stock</p>
              <p className="font-semibold">{product.available}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total quantity</p>
              <p className="font-semibold">{product.quantity}</p>
            </div>
          </div>
          {rentedOut > 0 ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {rentedOut} {rentedOut === 1 ? 'unit is' : 'units are'} still out on rental. Record the return before
              transferring this product to sale.
            </p>
          ) : null}
          <div>
            <label className="label" htmlFor="transfer-sale-price">Sale Price (LKR)</label>
            <input
              id="transfer-sale-price"
              type="number"
              min="0"
              step="0.01"
              className="input-field"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              disabled={saving}
              required
            />
            {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
          </div>
        </form>
      ) : null}
    </Modal>
  )
}
