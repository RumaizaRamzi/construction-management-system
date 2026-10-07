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

export default function RentalCard({ rental, onDelete }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/rentals/${rental.id}`} className="font-semibold text-brand-600 hover:underline">
            {rental.rentalId || rental.rentalNumber}
          </Link>
          <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{rental.customer}</p>
          <p className="text-xs text-slate-500 mt-0.5">{rental.product}</p>
        </div>
        <ActionMenu rental={rental} onDelete={onDelete} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-slate-500">Start</p>
          <p className="font-semibold">{formatDate(rental.startDate)}</p>
        </div>
        <div>
          <p className="text-slate-500">Return</p>
          <p className="font-semibold">{formatDate(rental.expectedReturn)}</p>
        </div>
        <div>
          <p className="text-slate-500">Qty / Duration</p>
          <p className="font-semibold">
            {rental.quantity} × {rental.duration} days
          </p>
        </div>
        <div>
          <p className="text-slate-500">Total</p>
          <p className="font-semibold text-brand-600">{formatCurrency(rental.total)}</p>
        </div>
        <div>
          <p className="text-slate-500">Deposit</p>
          <p className="font-semibold">{formatCurrency(rental.deposit)}</p>
        </div>
        <div>
          <p className="text-slate-500">Rate</p>
          <p className="font-semibold">{formatCurrency(rental.rate)}/day</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PaymentStatusBadge status={rental.paymentStatus} />
        <RentalStatusBadge status={rental.rentalStatus} />
      </div>
    </div>
  )
}
