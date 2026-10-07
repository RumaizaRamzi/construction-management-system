import { useState } from 'react'
import { Plus } from 'lucide-react'
import ProductImage from '../ui/ProductImage'
import { formatCurrency } from '../../utils/helpers'
import { calcLineTotal } from '../../utils/saleHelpers'
import { isListedForSale } from '../../utils/productHelpers'

export default function ProductSelector({ products = [], existingItems = [], onAddItem }) {
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [discount, setDiscount] = useState(0)
  const [error, setError] = useState('')

  const selected = products.find((p) => String(p.id) === String(productId))

  const getAvailableStock = (product) => {
    if (!product) return 0
    const inCart = existingItems
      .filter((i) => String(i.productId) === String(product.id))
      .reduce((sum, i) => sum + Number(i.quantity || 0), 0)
    const original = existingItems
      .filter((i) => String(i.productId) === String(product.id))
      .reduce((sum, i) => sum + Number(i._originalQty || 0), 0)
    return Number(product.available || 0) + original - inCart
  }

  const handleAdd = () => {
    if (!selected) {
      setError('Select a product')
      return
    }
    const qty = Number(quantity) || 0
    if (qty <= 0) {
      setError('Quantity must be greater than 0')
      return
    }
    const available = getAvailableStock(selected)
    if (qty > available) {
      setError(`Insufficient stock available. Only ${available} unit(s) left.`)
      return
    }

    setError('')
    onAddItem?.({
      productId: selected.id,
      productName: selected.name,
      serial_number: selected.serial_number,
      quantity: qty,
      unitPrice: Number(selected.salePrice || 0),
      discount: Number(discount || 0),
      total: calcLineTotal(qty, selected.salePrice, discount),
    })
    setProductId('')
    setQuantity(1)
    setDiscount(0)
  }

  const available = selected ? getAvailableStock(selected) : 0

  return (
    <div className="card p-4 space-y-4">
      <p className="font-medium text-slate-900 dark:text-white">Add Product</p>

      <div>
        <label className="label">Product</label>
        <select className="input-field" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Select product</option>
          {products.filter(isListedForSale).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.serial_number}) — {formatCurrency(p.salePrice)}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="flex gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-4">
          <ProductImage src={selected.image} alt={selected.name} className="h-16 w-16 shrink-0" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-slate-900 dark:text-white">{selected.name}</p>
            <p className="text-slate-500">Serial Number: {selected.serial_number}</p>
            <p className="text-emerald-600 dark:text-emerald-400 font-medium">Available: {available}</p>
            <p className="text-brand-600 font-medium">Sale Price: {formatCurrency(selected.salePrice)}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Quantity</label>
          <input
            type="number"
            min="1"
            className="input-field"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Discount (LKR)</label>
          <input
            type="number"
            min="0"
            className="input-field"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Line Total</label>
          <input
            className="input-field bg-slate-50 dark:bg-slate-800"
            value={selected ? formatCurrency(calcLineTotal(quantity, selected.salePrice, discount)) : '—'}
            readOnly
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button type="button" className="btn-primary" onClick={handleAdd} disabled={!selected}>
        <Plus size={16} />
        Add Product
      </button>
    </div>
  )
}
