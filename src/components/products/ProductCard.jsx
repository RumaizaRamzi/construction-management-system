import { Link } from 'react-router-dom'
import { ArrowRightLeft, Eye, Pencil, Trash2 } from 'lucide-react'
import ProductImage from '../ui/ProductImage'
import ProductStatusBadge from './ProductStatusBadge'
import { formatCurrency } from '../../utils/helpers'
import { canTransferToSale, getListingLabel, getStockStatus } from '../../utils/productHelpers'

export default function ProductCard({ product, onEdit, onTransfer, onDelete }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex gap-4 p-4">
        <ProductImage src={product.image} alt={product.name} className="h-20 w-20 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link to={`/products/${product.id}`} className="font-semibold text-slate-900 dark:text-white hover:text-brand-600 line-clamp-1">
                {product.name}
              </Link>
              <p className="text-xs text-slate-500 mt-0.5">{product.serial_number} · {product.category} · {getListingLabel(product)}</p>
            </div>
            <ProductStatusBadge status={getStockStatus(product)} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-slate-500">Available</p>
              <p className="font-semibold text-emerald-700">{product.available}</p>
            </div>
            <div>
              <p className="text-slate-500">Rented</p>
              <p className="font-semibold text-sky-700">{product.rented}</p>
            </div>
            <div>
              <p className="text-slate-500">Total</p>
              <p className="font-semibold">{product.quantity}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-brand-600">{formatCurrency(product.rentalPrice)}/day</p>
              <ProductStatusBadge product={product} type="condition" className="mt-1" />
            </div>
            <div className="flex gap-1">
              <Link to={`/products/${product.id}`} className="btn-secondary !px-2.5 !py-1.5" title="View">
                <Eye size={14} />
              </Link>
              {onEdit && (
                <button type="button" className="btn-secondary !px-2.5 !py-1.5" onClick={() => onEdit(product)} title="Edit">
                  <Pencil size={14} />
                </button>
              )}
              {onTransfer && canTransferToSale(product) && (
                <button type="button" className="btn-secondary !px-2.5 !py-1.5" onClick={() => onTransfer(product)} title="Transfer to Sale" aria-label="Transfer to Sale">
                  <ArrowRightLeft size={14} />
                </button>
              )}
              {onDelete && (
                <button type="button" className="btn-secondary !px-2.5 !py-1.5 text-red-600" onClick={() => onDelete(product)} title="Delete">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
