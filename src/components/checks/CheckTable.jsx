import { Eye, Edit2, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import CheckStatusBadge from './CheckStatusBadge'
import PriorityBadge from './PriorityBadge'
import { deriveCheckStatus } from '../../utils/checkHelpers'
import { formatDateDMY } from '../../utils/helpers'
import EmptyState from '../ui/EmptyState'

function CheckCard({ check, status, onEdit, onDelete }) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 font-medium">{check.checkId || check.checkNumber}</p>
          <p className="font-semibold text-slate-900 dark:text-white truncate">{check.check}</p>
          <p className="text-sm text-slate-500 mt-0.5">{check.product}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <CheckStatusBadge status={status} />
          <PriorityBadge priority={check.priority} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
        <div>
          <p className="text-slate-400">Category</p>
          <p className="font-medium">{check.category || '—'}</p>
        </div>
        <div>
          <p className="text-slate-400">Frequency</p>
          <p className="font-medium">{check.frequency}</p>
        </div>
        <div>
          <p className="text-slate-400">Check Date</p>
          <p className="font-medium">{formatDateDMY(check.checkDate)}</p>
        </div>
        <div>
          <p className="text-slate-400">Next Check</p>
          <p className="font-medium">{formatDateDMY(check.nextCheck)}</p>
        </div>
        <div>
          <p className="text-slate-400">Assigned To</p>
          <p className="font-medium">{check.assignedTo || '—'}</p>
        </div>
        <div>
          <p className="text-slate-400">Last Completed</p>
          <p className="font-medium">{formatDateDMY(check.lastCompleted)}</p>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Link to={`/checks/${check.id}`} className="btn-secondary flex-1 text-xs justify-center">
          <Eye size={14} />
          View
        </Link>
        <button type="button" className="btn-secondary flex-1 text-xs" onClick={() => onEdit?.(check)}>
          <Edit2 size={14} />
          Edit
        </button>
        <button type="button" className="btn-danger flex-1 text-xs" onClick={() => onDelete?.(check)}>
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </div>
  )
}

export default function CheckTable({ checks = [], onEdit, onDelete }) {
  if (!checks.length) {
    return (
      <EmptyState
        title="No checks found"
        description="Adjust filters or add a new equipment check."
      />
    )
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {checks.map((check) => {
          const status = deriveCheckStatus(check)
          return (
            <CheckCard
              key={check.id}
              check={check}
              status={status}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )
        })}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">Check ID</th>
              <th className="px-4 py-3 font-semibold">Check Name</th>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Check Date</th>
              <th className="px-4 py-3 font-semibold">Frequency</th>
              <th className="px-4 py-3 font-semibold">Assigned To</th>
              <th className="px-4 py-3 font-semibold">Last Completed</th>
              <th className="px-4 py-3 font-semibold">Next Check</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Priority</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {checks.map((check) => {
              const status = deriveCheckStatus(check)
              return (
                <tr key={check.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                    <Link
                      to={`/checks/${check.id}`}
                      className="text-brand-600 hover:underline dark:text-brand-400"
                    >
                      {check.checkId || check.checkNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-100 min-w-[140px]">
                    {check.check}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {check.product}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {check.category || '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(check.checkDate)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{check.frequency}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{check.assignedTo}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(check.lastCompleted)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(check.nextCheck)}</td>
                  <td className="px-4 py-3">
                    <CheckStatusBadge status={status} />
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={check.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Link
                        to={`/checks/${check.id}`}
                        className="btn-secondary !px-2 !py-1"
                        title="View"
                      >
                        <Eye size={14} />
                      </Link>
                      <button
                        type="button"
                        className="btn-secondary !px-2 !py-1"
                        title="Edit"
                        onClick={() => onEdit?.(check)}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-danger !px-2 !py-1"
                        title="Delete"
                        onClick={() => onDelete?.(check)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
