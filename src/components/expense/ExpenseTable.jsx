import { Eye, Edit2, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import ExpenseCategoryBadge from './ExpenseCategoryBadge'
import ExpensePaymentStatusBadge from './ExpensePaymentStatusBadge'
import { formatCurrency, formatDateDMY } from '../../utils/helpers'
import EmptyState from '../ui/EmptyState'

function ExpenseCard({ record, onEdit, onDelete }) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 font-medium">{record.expenseId}</p>
          <p className="font-semibold text-slate-900 dark:text-white truncate">{record.supplier}</p>
          <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{record.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <ExpenseCategoryBadge category={record.category} />
          <ExpensePaymentStatusBadge status={record.paymentStatus} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
        <div>
          <p className="text-slate-400">Date</p>
          <p className="font-medium">{formatDateDMY(record.date)}</p>
        </div>
        <div>
          <p className="text-slate-400">Amount</p>
          <p className="font-medium">{formatCurrency(record.amount)}</p>
        </div>
        <div>
          <p className="text-slate-400">Reference</p>
          <p className="font-medium truncate">{record.reference || '—'}</p>
        </div>
        <div>
          <p className="text-slate-400">Product</p>
          <p className="font-medium truncate">{record.product || '—'}</p>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Link to={`/expenses/${record.id}`} className="btn-secondary flex-1 text-xs justify-center">
          <Eye size={14} />
          View
        </Link>
        <button type="button" className="btn-secondary flex-1 text-xs" onClick={() => onEdit?.(record)}>
          <Edit2 size={14} />
          Edit
        </button>
        <button type="button" className="btn-danger flex-1 text-xs" onClick={() => onDelete?.(record)}>
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </div>
  )
}

export default function ExpenseTable({ records = [], onEdit, onDelete }) {
  if (!records.length) {
    return (
      <EmptyState
        title="No expense records"
        description="Adjust filters or add a new expense entry."
      />
    )
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {records.map((record) => (
          <ExpenseCard
            key={record.id}
            record={record}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">Expense ID</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Expense Category</th>
              <th className="px-4 py-3 font-semibold">Supplier / Payee</th>
              <th className="px-4 py-3 font-semibold">Reference</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Payment Method</th>
              <th className="px-4 py-3 font-semibold">Payment Status</th>
              <th className="px-4 py-3 font-semibold">Related Product</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {records.map((record) => (
              <tr key={record.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  <Link
                    to={`/expenses/${record.id}`}
                    className="text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {record.expenseId}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(record.date)}</td>
                <td className="px-4 py-3">
                  <ExpenseCategoryBadge category={record.category} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{record.supplier}</td>
                <td className="px-4 py-3 whitespace-nowrap">{record.reference || '—'}</td>
                <td className="px-4 py-3 max-w-[200px] truncate text-slate-600 dark:text-slate-300">
                  {record.description}
                </td>
                <td className="px-4 py-3 whitespace-nowrap font-medium">
                  {formatCurrency(record.amount)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{record.paymentMethod}</td>
                <td className="px-4 py-3">
                  <ExpensePaymentStatusBadge status={record.paymentStatus} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{record.product || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Link
                      to={`/expenses/${record.id}`}
                      className="btn-secondary !px-2 !py-1"
                      title="View"
                    >
                      <Eye size={14} />
                    </Link>
                    <button
                      type="button"
                      className="btn-secondary !px-2 !py-1"
                      title="Edit"
                      onClick={() => onEdit?.(record)}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-danger !px-2 !py-1"
                      title="Delete"
                      onClick={() => onDelete?.(record)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
