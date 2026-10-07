import { Eye, Edit2, Trash2 } from 'lucide-react'
import { formatCurrency, formatDateDMY } from '../../utils/helpers'
import EmptyState from '../ui/EmptyState'
import { sumPaymentAmounts } from '../../utils/financialHelpers'

function PaymentCard({ payment, onView, onEdit, onDelete }) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 font-medium">{payment.paymentId}</p>
          <p className="font-semibold text-slate-900 dark:text-white">
            {formatCurrency(payment.amount)}
          </p>
          <p className="text-sm text-slate-500">{formatDateDMY(payment.paymentDate)}</p>
        </div>
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
          {payment.paymentMethod}
        </p>
      </div>
      <p className="text-xs text-slate-500 truncate">
        Ref: {payment.reference || '—'} · {payment.notes || 'No notes'}
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1 text-xs" onClick={() => onView?.(payment)}>
          <Eye size={14} />
          View
        </button>
        <button type="button" className="btn-secondary flex-1 text-xs" onClick={() => onEdit?.(payment)}>
          <Edit2 size={14} />
          Edit
        </button>
        <button type="button" className="btn-danger flex-1 text-xs" onClick={() => onDelete?.(payment)}>
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </div>
  )
}

export default function PaymentHistoryTable({
  payments = [],
  onView,
  onEdit,
  onDelete,
}) {
  const total = sumPaymentAmounts(payments)

  if (!payments.length) {
    return (
      <div className="card p-5">
        <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-3">
          Payment History
        </h3>
        <EmptyState
          title="No payments yet"
          description="Add a payment to start building the payment history."
        />
      </div>
    )
  }

  const sorted = [...payments].sort((a, b) =>
    String(b.paymentDate).localeCompare(String(a.paymentDate))
  )

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <h3 className="font-display font-semibold text-slate-900 dark:text-white">
          Payment History
        </h3>
      </div>

      <div className="grid gap-3 p-4 md:hidden">
        {sorted.map((payment) => (
          <PaymentCard
            key={payment.id}
            payment={payment}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">Payment ID</th>
              <th className="px-4 py-3 font-semibold">Payment Date</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Payment Method</th>
              <th className="px-4 py-3 font-semibold">Reference</th>
              <th className="px-4 py-3 font-semibold">Notes</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sorted.map((payment) => (
              <tr key={payment.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3 font-medium whitespace-nowrap">{payment.paymentId}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(payment.paymentDate)}</td>
                <td className="px-4 py-3 whitespace-nowrap font-medium">
                  {formatCurrency(payment.amount)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{payment.paymentMethod}</td>
                <td className="px-4 py-3 whitespace-nowrap">{payment.reference || '—'}</td>
                <td className="px-4 py-3 max-w-[200px] truncate text-slate-500">
                  {payment.notes || '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      className="btn-secondary !px-2 !py-1"
                      title="View"
                      onClick={() => onView?.(payment)}
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-secondary !px-2 !py-1"
                      title="Edit"
                      onClick={() => onEdit?.(payment)}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-danger !px-2 !py-1"
                      title="Delete"
                      onClick={() => onDelete?.(payment)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <td colSpan={2} className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                Payment Total
              </td>
              <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                {formatCurrency(total)}
              </td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="md:hidden border-t border-slate-200 dark:border-slate-800 px-4 py-3 flex justify-between text-sm">
        <span className="text-slate-500">Payment Total</span>
        <span className="font-bold">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}
