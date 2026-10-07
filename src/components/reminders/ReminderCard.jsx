import { Link } from 'react-router-dom'
import {
  AlarmClock,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Package,
  KeyRound,
  Wrench,
  Bell,
  Clock,
} from 'lucide-react'
import ReminderBadge from './ReminderBadge'
import PriorityBadge from '../checks/PriorityBadge'
import { formatDateDMY } from '../../utils/helpers'

const sourceIcons = {
  Check: ClipboardCheck,
  Rental: KeyRound,
  Stock: Package,
  Maintenance: Wrench,
  Recurring: AlarmClock,
  Manual: Bell,
}

const sourceTones = {
  Check: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
  Rental: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  Stock: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
  Maintenance: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  Recurring: 'bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400',
  Manual: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

export default function ReminderCard({
  reminder,
  onView,
  onMarkRead,
  onComplete,
  onSnooze,
}) {
  const Icon = sourceIcons[reminder.source] || Bell
  const tone = sourceTones[reminder.source] || sourceTones.Manual
  const status = reminder.status || (reminder.read ? 'Read' : 'Unread')

  return (
    <div
      className={`card p-4 transition-colors ${
        status === 'Unread'
          ? 'border-brand-200 bg-brand-50/30 dark:border-brand-900 dark:bg-brand-950/20'
          : ''
      }`}
    >
      <div className="flex gap-3">
        <div className={`rounded-xl p-2.5 h-fit shrink-0 ${tone}`}>
          <Icon size={18} />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-slate-900 dark:text-white">{reminder.title}</p>
              <p className="text-sm text-slate-500 mt-0.5">
                {reminder.product}
                {reminder.meta ? ` · ${reminder.meta}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 shrink-0">
              <PriorityBadge priority={reminder.priority} />
              <ReminderBadge status={status} />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock size={12} />
              {formatDateDMY(reminder.date)}
            </span>
            <span>Source: {reminder.source}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {reminder.link ? (
              <Link to={reminder.link} className="btn-secondary !px-2.5 !py-1.5 text-xs">
                <Eye size={14} />
                View
              </Link>
            ) : (
              <button
                type="button"
                className="btn-secondary !px-2.5 !py-1.5 text-xs"
                onClick={() => onView?.(reminder)}
              >
                <Eye size={14} />
                View
              </button>
            )}
            {status === 'Unread' && (
              <button
                type="button"
                className="btn-secondary !px-2.5 !py-1.5 text-xs"
                onClick={() => onMarkRead?.(reminder)}
              >
                Mark as Read
              </button>
            )}
            <button
              type="button"
              className="btn-primary !px-2.5 !py-1.5 text-xs"
              onClick={() => onComplete?.(reminder)}
            >
              <CheckCircle2 size={14} />
              Complete
            </button>
            <button
              type="button"
              className="btn-secondary !px-2.5 !py-1.5 text-xs"
              onClick={() => onSnooze?.(reminder)}
            >
              <AlarmClock size={14} />
              Snooze
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
