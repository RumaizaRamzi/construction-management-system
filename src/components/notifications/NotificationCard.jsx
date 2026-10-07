import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CheckCircle2,
  Info,
  KeyRound,
  Package,
  Trash2,
  Eye,
  Wallet,
  Wrench,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import PriorityBadge from '../checks/PriorityBadge'
import { formatDateTime } from '../../utils/helpers'

const typeIcons = {
  Info: Info,
  Warning: AlertTriangle,
  Success: CheckCircle2,
  Urgent: AlertTriangle,
}

const categoryIcons = {
  Rentals: KeyRound,
  Bookings: CalendarCheck,
  Inventory: Package,
  Maintenance: Wrench,
  Payments: Wallet,
  System: Bell,
}

const tones = {
  Info: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
  Warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  Success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  Urgent: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
}

export default function NotificationCard({
  notification,
  onMarkRead,
  onDelete,
  onDismiss,
  onView,
  compact = false,
  showActions = true,
}) {
  const Icon =
    categoryIcons[notification.category] || typeIcons[notification.type] || Bell
  const tone =
    tones[notification.type] ||
    (notification.priority === 'Critical' || notification.priority === 'High'
      ? tones.Urgent
      : tones.Info)

  return (
    <div
      className={`rounded-xl border px-4 py-3 transition-colors ${
        notification.read
          ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          : 'border-brand-200 bg-brand-50/40 dark:border-brand-900 dark:bg-brand-950/20'
      }`}
    >
      <div className="flex gap-3">
        <div className={`rounded-lg p-2 h-fit shrink-0 ${tone}`}>
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-slate-900 dark:text-white text-sm">
              {notification.title}
            </p>
            {!notification.read && (
              <span className="mt-1 h-2 w-2 rounded-full bg-brand-500 shrink-0" />
            )}
          </div>
          <p className={`mt-1 text-sm text-slate-500 ${compact ? 'line-clamp-1' : 'line-clamp-2'}`}>
            {notification.message}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{formatDateTime(notification.time)}</span>
            <span>·</span>
            <span>{notification.category || 'System'}</span>
            <span>·</span>
            <span>{notification.notificationType || notification.type}</span>
            {notification.priority && <PriorityBadge priority={notification.priority} />}
          </div>

          {showActions && (
            <div className="mt-3 flex flex-wrap gap-2">
              {notification.link && (
                <Link
                  to={notification.link}
                  className="btn-secondary !px-2.5 !py-1 text-xs"
                  onClick={() => onView?.(notification)}
                >
                  <Eye size={13} />
                  View Details
                </Link>
              )}
              {!notification.read && (
                <button
                  type="button"
                  className="btn-secondary !px-2.5 !py-1 text-xs"
                  onClick={() => onMarkRead?.(notification)}
                >
                  Mark as Read
                </button>
              )}
              {onDismiss && (
                <button
                  type="button"
                  className="btn-secondary !px-2.5 !py-1 text-xs"
                  onClick={() => onDismiss?.(notification)}
                >
                  Dismiss
                </button>
              )}
              <button
                type="button"
                className="btn-danger !px-2.5 !py-1 text-xs"
                onClick={() => onDelete?.(notification)}
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
