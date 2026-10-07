import { Link } from 'react-router-dom'
import { ArrowRightLeft, Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ProductImage from '../ui/ProductImage'
import ProductStatusBadge from './ProductStatusBadge'
import { formatCurrency } from '../../utils/helpers'
import { canTransferToSale, getListingLabel, getStockStatus } from '../../utils/productHelpers'

function ActionMenu({ product, onEdit, onTransfer, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        onClick={() => setOpen((v) => !v)}
        aria-label="Actions"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
          <Link
            to={`/products/${product.id}`}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            <Eye size={14} /> View
          </Link>
          {onEdit && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => {
                setOpen(false)
                onEdit(product)
              }}
            >
              <Pencil size={14} /> Edit
            </button>
          )}
          {onTransfer && canTransferToSale(product) && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => {
                setOpen(false)
                onTransfer(product)
              }}
            >
              <ArrowRightLeft size={14} /> Transfer to Sale
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => {
                setOpen(false)
                onDelete(product)
              }}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ProductTable({ products, onEdit, onTransfer, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1200px] w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90">
            {[
              'Image',
              'Product Name',
              'Serial Number',
              'Category',
              'Total Qty',
              'Available',
              'Rented',
              'Sold',
              'Purchase Cost',
              'Sale Price',
              'Rental Price',
              'Condition',
              'Status',
              'Actions',
            ].map((label) => (
              <th
                key={label}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {products.map((product) => (
            <tr key={product.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
              <td className="px-4 py-3">
                <ProductImage src={product.image} alt={product.name} className="h-12 w-12" />
              </td>
              <td className="px-4 py-3">
                <Link to={`/products/${product.id}`} className="font-medium text-slate-900 dark:text-white hover:text-brand-600">
                  {product.name}
                </Link>
                <p className="text-xs text-slate-400">{getListingLabel(product)}</p>
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{product.serial_number}</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{product.category}</td>
              <td className="px-4 py-3">{product.quantity}</td>
              <td className="px-4 py-3 font-medium text-emerald-700 dark:text-emerald-400">{product.available}</td>
              <td className="px-4 py-3 text-sky-700 dark:text-sky-400">{product.rented}</td>
              <td className="px-4 py-3">{product.sold}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(product.purchaseCost)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(product.salePrice)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(product.rentalPrice)}/day</td>
              <td className="px-4 py-3">
                <ProductStatusBadge product={product} type="condition" />
              </td>
              <td className="px-4 py-3">
                <ProductStatusBadge status={getStockStatus(product)} />
              </td>
              <td className="px-4 py-3">
                <ActionMenu product={product} onEdit={onEdit} onTransfer={onTransfer} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
