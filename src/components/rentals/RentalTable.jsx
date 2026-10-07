import { Link } from 'react-router-dom'
import { Eye, MoreHorizontal, Pencil, Printer, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import PaymentStatusBadge from '../sales/PaymentStatusBadge'
import RentalStatusBadge from './RentalStatusBadge'
import { formatCurrency, formatDate } from '../../utils/helpers'

const RETURNABLE_STATUSES = ['Active', 'Overdue', 'Confirmed']

function ActionMenu({ rental, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const canReturn = RETURNABLE_STATUSES.includes(rental.rentalStatus)

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
            to={`/rentals/${rental.id}`}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            <Eye size={14} /> View
          </Link>
          <Link
            to={`/rentals/${rental.id}/edit`}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            <Pencil size={14} /> Edit
          </Link>
          {canReturn && (
            <Link
              to={`/rentals/${rental.id}/return`}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => setOpen(false)}
            >
              <RotateCcw size={14} /> Return
            </Link>
          )}
          <Link
            to={`/rentals/${rental.id}/agreement`}
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
              onDelete?.(rental)
            }}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

export default function RentalTable({ rentals = [], onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1400px] w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90">
            {[
              'Rental ID',
              'Customer',
              'Product',
              'Qty',
              'Start',
              'Expected Return',
              'Duration',
              'Rate',
              'Deposit',
              'Total',
              'Payment Status',
              'Rental Status',
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
          {rentals.map((rental) => (
            <tr key={rental.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
              <td className="px-4 py-3 whitespace-nowrap">
                <Link to={`/rentals/${rental.id}`} className="font-medium text-brand-600 hover:underline">
                  {rental.rentalId || rental.rentalNumber}
                </Link>
              </td>
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                {rental.customer}
              </td>
              <td className="px-4 py-3 max-w-[180px] truncate text-slate-600 dark:text-slate-300">
                {rental.product}
              </td>
              <td className="px-4 py-3">{rental.quantity}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDate(rental.startDate)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDate(rental.expectedReturn)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{rental.duration} days</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(rental.rate)}/day</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(rental.deposit)}</td>
              <td className="px-4 py-3 font-medium whitespace-nowrap">{formatCurrency(rental.total)}</td>
              <td className="px-4 py-3">
                <PaymentStatusBadge status={rental.paymentStatus} />
              </td>
              <td className="px-4 py-3">
                <RentalStatusBadge status={rental.rentalStatus} />
              </td>
              <td className="px-4 py-3">
                <ActionMenu rental={rental} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
