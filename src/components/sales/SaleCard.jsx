import { Link } from 'react-router-dom'
import { Eye, MoreHorizontal, Pencil, Printer, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import PaymentStatusBadge from './PaymentStatusBadge'
import SaleStatusBadge from './SaleStatusBadge'
import { formatCurrency, formatDate } from '../../utils/helpers'

function ActionMenu({ sale, onDelete }) {
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
            to={`/sales/${sale.id}`}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            <Eye size={14} /> View
          </Link>
          <Link
            to={`/sales/${sale.id}/edit`}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            <Pencil size={14} /> Edit
          </Link>
          <Link
            to={`/sales/${sale.id}/invoice`}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            <Printer size={14} /> Print
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={() => {
              setOpen(false)
              onDelete?.(sale)
            }}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

export default function SaleCard({ sale, onDelete }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/sales/${sale.id}`} className="font-semibold text-brand-600 hover:underline">
            {sale.invoiceNumber}
          </Link>
          <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{sale.customer}</p>
          <p className="text-xs text-slate-500 mt-0.5">{formatDate(sale.date)}</p>
        </div>
        <ActionMenu sale={sale} onDelete={onDelete} />
      </div>

      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">{sale.products}</p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-slate-500">Items</p>
          <p className="font-semibold">{sale.quantity}</p>
        </div>
        <div>
          <p className="text-slate-500">Total</p>
          <p className="font-semibold text-brand-600">{formatCurrency(sale.total)}</p>
        </div>
        <div>
          <p className="text-slate-500">Discount</p>
          <p className="font-semibold">{formatCurrency(sale.discount)}</p>
        </div>
        <div>
          <p className="text-slate-500">Method</p>
          <p className="font-semibold">{sale.paymentMethod}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PaymentStatusBadge status={sale.paymentStatus} />
        <SaleStatusBadge status={sale.saleStatus} />
      </div>
    </div>
  )
}
