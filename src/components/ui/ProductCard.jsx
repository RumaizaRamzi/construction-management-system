import { Link } from 'react-router-dom'
import ProductImage from './ProductImage'
import StatusBadge from './StatusBadge'
import { formatCurrency } from '../../utils/helpers'
import { getStockStatus } from '../../utils/productHelpers'

/** Legacy UI card — kept for any shared imports; prefers stock status badges. */
export default function ProductCard({ product }) {
  return (
    <Link to={`/products/${product.id}`} className="card overflow-hidden hover:shadow-md transition-shadow">
      <ProductImage src={product.image} alt={product.name} className="h-40 w-full rounded-none" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500">{product.serial_number}</p>
            <h3 className="font-semibold text-slate-900 dark:text-white">{product.name}</h3>
          </div>
          <StatusBadge status={getStockStatus(product)} />
        </div>
        <p className="mt-2 text-sm text-slate-500">{product.category}</p>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-300">Avail: {product.available}</span>
          <span className="font-medium text-brand-600">{formatCurrency(product.rentalPrice)}/day</span>
        </div>
      </div>
    </Link>
  )
}
