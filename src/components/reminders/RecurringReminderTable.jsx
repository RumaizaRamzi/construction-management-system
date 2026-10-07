import { Edit2, Pause, Play, Trash2 } from 'lucide-react'
import ReminderBadge from './ReminderBadge'
import PriorityBadge from '../checks/PriorityBadge'
import { formatDateDMY } from '../../utils/helpers'
import EmptyState from '../ui/EmptyState'

export default function RecurringReminderTable({
  records = [],
  onEdit,
  onPause,
  onResume,
  onDelete,
}) {
  if (!records.length) {
    return (
      <EmptyState
        title="No recurring reminders"
        description="Create a recurring reminder to schedule automatic follow-ups."
      />
    )
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {records.map((item) => (
          <div key={item.id} className="card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white">{item.reminder}</p>
                <p className="text-sm text-slate-500">{item.product}</p>
              </div>
              <ReminderBadge status={item.status} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-slate-400">Frequency</p>
                <p className="font-medium">{item.frequency}</p>
              </div>
              <div>
                <p className="text-slate-400">Priority</p>
                <PriorityBadge priority={item.priority} />
              </div>
              <div>
                <p className="text-slate-400">Next Reminder</p>
                <p className="font-medium">{formatDateDMY(item.nextReminder)}</p>
              </div>
              <div>
                <p className="text-slate-400">Last Sent</p>
                <p className="font-medium">{formatDateDMY(item.lastSent)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary flex-1 text-xs" onClick={() => onEdit?.(item)}>
                <Edit2 size={14} />
                Edit
              </button>
              {item.status === 'Active' ? (
                <button type="button" className="btn-secondary flex-1 text-xs" onClick={() => onPause?.(item)}>
                  <Pause size={14} />
                  Pause
                </button>
              ) : (
                <button type="button" className="btn-secondary flex-1 text-xs" onClick={() => onResume?.(item)}>
                  <Play size={14} />
                  Resume
                </button>
              )}
              <button type="button" className="btn-danger flex-1 text-xs" onClick={() => onDelete?.(item)}>
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">Reminder</th>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Frequency</th>
              <th className="px-4 py-3 font-semibold">Next Reminder</th>
              <th className="px-4 py-3 font-semibold">Last Sent</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {records.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white min-w-[180px]">
                  {item.reminder}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{item.product}</td>
                <td className="px-4 py-3 whitespace-nowrap">{item.frequency}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(item.nextReminder)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(item.lastSent)}</td>
                <td className="px-4 py-3">
                  <ReminderBadge status={item.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      className="btn-secondary !px-2 !py-1"
                      title="Edit"
                      onClick={() => onEdit?.(item)}
                    >
                      <Edit2 size={14} />
                    </button>
                    {item.status === 'Active' ? (
                      <button
                        type="button"
                        className="btn-secondary !px-2 !py-1"
                        title="Pause"
                        onClick={() => onPause?.(item)}
                      >
                        <Pause size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary !px-2 !py-1"
                        title="Resume"
                        onClick={() => onResume?.(item)}
                      >
                        <Play size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-danger !px-2 !py-1"
                      title="Delete"
                      onClick={() => onDelete?.(item)}
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
