import { Trash2 } from 'lucide-react'
import { calcLineTotal } from '../../utils/saleHelpers'
import { formatCurrency } from '../../utils/helpers'

export default function SaleItemRow({ item, index, onChange, onRemove, error }) {
  const update = (field, value) => {
    const next = { ...item, [field]: value }
    next.total = calcLineTotal(next.quantity, next.unitPrice, next.discount)
    onChange?.(index, next)
  }

  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4 sm:grid-cols-12 sm:items-end">
      <div className="sm:col-span-3">
        <p className="label">Product</p>
        <p className="font-medium text-slate-900 dark:text-white">{item.productName}</p>
        <p className="text-xs text-slate-500">{item.serial_number}</p>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Qty</label>
        <input
          type="number"
          min="1"
          className="input-field"
          value={item.quantity}
          onChange={(e) => update('quantity', e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Unit Price</label>
        <input
          type="number"
          min="0"
          className="input-field"
          value={item.unitPrice}
          onChange={(e) => update('unitPrice', e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Discount</label>
        <input
          type="number"
          min="0"
          className="input-field"
          value={item.discount || 0}
          onChange={(e) => update('discount', e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <p className="label">Line Total</p>
        <p className="font-semibold text-brand-600 py-2">{formatCurrency(item.total ?? calcLineTotal(item.quantity, item.unitPrice, item.discount))}</p>
      </div>
      <div className="sm:col-span-1 flex sm:justify-end">
        <button
          type="button"
          className="btn-secondary !px-2.5 !py-2 text-red-600"
          onClick={() => onRemove?.(index)}
          title="Remove item"
        >
          <Trash2 size={16} />
        </button>
      </div>
      {error && <p className="sm:col-span-12 text-xs text-red-600">{error}</p>}
    </div>
  )
}
