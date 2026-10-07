import ProductImage from '../ui/ProductImage'
import { formatCurrency } from '../../utils/helpers'
import { isProductRentable } from '../../utils/maintenanceHelpers'
import { isListedForRent } from '../../utils/productHelpers'

export default function RentalProductSelector({
  products = [],
  productId,
  quantity = 1,
  rate,
  onChange,
  errors = {},
  originalQty = 0,
}) {
  const selected = products.find((p) => String(p.id) === String(productId))
  const available = selected
    ? Number(selected.available || 0) + Number(originalQty || 0)
    : 0

  const rentableProducts = products.filter(
    (p) => (isProductRentable(p) && isListedForRent(p)) || String(p.id) === String(productId)
  )

  const handleProductChange = (id) => {
    const product = products.find((p) => String(p.id) === String(id))
    if (product) {
      onChange?.({
        productId: String(product.id),
        product: product.name,
        product_serial_number: product.serial_number,
        productCategory: product.category,
        productImage: product.image,
        productCondition: product.condition || 'Used',
        rate: product.rentalPrice ?? rate ?? '',
      })
    } else {
      onChange?.({
        productId: '',
        product: '',
        product_serial_number: '',
        productCategory: '',
        productImage: '',
        productCondition: '',
        rate: '',
      })
    }
  }

  return (
    <div className="card p-5 space-y-4">
      <p className="font-medium text-slate-900 dark:text-white">Equipment</p>

      <div>
        <label className="label">Product</label>
        <select
          className="input-field"
          value={productId || ''}
          onChange={(e) => handleProductChange(e.target.value)}
        >
          <option value="">Select product</option>
          {rentableProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.serial_number}) — {formatCurrency(p.rentalPrice)}/day
            </option>
          ))}
        </select>
        {errors.product && <p className="mt-1 text-xs text-red-600">{errors.product}</p>}
        {selected?.status === 'Maintenance' && (
          <p className="mt-1 text-xs text-violet-600 dark:text-violet-400">
            This product is under maintenance and is not available for new rentals.
          </p>
        )}
      </div>

      {selected && (
        <div className="flex gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-4">
          <ProductImage src={selected.image} alt={selected.name} className="h-16 w-16 shrink-0" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-slate-900 dark:text-white">{selected.name}</p>
            <p className="text-slate-500">Serial Number: {selected.serial_number}</p>
            {selected.status === 'Maintenance' ? (
              <p className="text-violet-600 dark:text-violet-400 font-medium">Status: Maintenance</p>
            ) : (
              <p className="text-emerald-600 dark:text-emerald-400 font-medium">Available: {available}</p>
            )}
            <p className="text-brand-600 font-medium">Rate: {formatCurrency(selected.rentalPrice)}/day</p>
            <p className="text-slate-500">Condition: {selected.condition || 'Used'}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Quantity</label>
          <input
            type="number"
            min="1"
            className="input-field"
            value={quantity}
            disabled={selected?.status === 'Maintenance'}
            onChange={(e) => onChange?.({ quantity: e.target.value })}
          />
          {errors.quantity && <p className="mt-1 text-xs text-red-600">{errors.quantity}</p>}
          {errors.stock && !errors.quantity && (
            <p className="mt-1 text-xs text-red-600">{errors.stock}</p>
          )}
        </div>
        <div>
          <label className="label">Daily Rate (LKR)</label>
          <input
            type="number"
            min="0"
            className="input-field"
            value={rate ?? ''}
            onChange={(e) => onChange?.({ rate: e.target.value })}
          />
          {errors.rate && <p className="mt-1 text-xs text-red-600">{errors.rate}</p>}
        </div>
      </div>
    </div>
  )
}
