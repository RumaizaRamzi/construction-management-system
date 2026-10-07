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

export default function SaleTable({ sales, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1200px] w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90">
            {[
              'Invoice No',
              'Customer',
              'Sale Date',
              'Products',
              'Items',
              'Subtotal',
              'Discount',
              'Total',
              'Payment Status',
              'Payment Method',
              'Sale Status',
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
          {sales.map((sale) => (
            <tr key={sale.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
              <td className="px-4 py-3 whitespace-nowrap">
                <Link to={`/sales/${sale.id}`} className="font-medium text-brand-600 hover:underline">
                  {sale.invoiceNumber}
                </Link>
              </td>
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">{sale.customer}</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatDate(sale.date)}</td>
              <td className="px-4 py-3 max-w-[200px] truncate text-slate-600 dark:text-slate-300">{sale.products}</td>
              <td className="px-4 py-3">{sale.quantity}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(sale.subtotal)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(sale.discount)}</td>
              <td className="px-4 py-3 font-medium whitespace-nowrap">{formatCurrency(sale.total)}</td>
              <td className="px-4 py-3">
                <PaymentStatusBadge status={sale.paymentStatus} />
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{sale.paymentMethod}</td>
              <td className="px-4 py-3">
                <SaleStatusBadge status={sale.saleStatus} />
              </td>
              <td className="px-4 py-3">
                <ActionMenu sale={sale} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
