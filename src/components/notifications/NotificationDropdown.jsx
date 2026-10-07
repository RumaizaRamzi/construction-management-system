import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CheckCircle2,
  Info,
  KeyRound,
  Package,
  Wallet,
  Wrench,
} from 'lucide-react'
import NotificationBadge from './NotificationBadge'
import { formatDateTime } from '../../utils/helpers'

const icons = {
  Rentals: KeyRound,
  Bookings: CalendarCheck,
  Inventory: Package,
  Maintenance: Wrench,
  Payments: Wallet,
  System: Bell,
  Info: Info,
  Warning: AlertTriangle,
  Success: CheckCircle2,
  Urgent: AlertTriangle,
}

export default function NotificationDropdown({
  open,
  notifications = [],
  unreadCount = 0,
  onClose,
  onMarkRead,
}) {
  const navigate = useNavigate()
  if (!open) return null

  const recent = notifications.slice(0, 5)

  const openItem = (n) => {
    if (!n.read) onMarkRead?.(n)
    onClose?.()
    navigate(n.link || '/notifications')
  }

  return (
    <div className="absolute right-0 mt-2 w-[min(100vw-1.5rem,22rem)] sm:w-96 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden z-50">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm text-slate-900 dark:text-white">Notifications</p>
          {unreadCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <Link
          to="/notifications"
          onClick={onClose}
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {recent.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">You're all caught up.</p>
        ) : (
          recent.map((n) => {
            const Icon = icons[n.category] || icons[n.type] || Bell
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => openItem(n)}
                className={`w-full border-b border-slate-100 dark:border-slate-800 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 ${
                  !n.read ? 'bg-brand-50/40 dark:bg-brand-950/20' : ''
                }`}
              >
                <div className="flex gap-3">
                  <div className="mt-0.5 text-slate-500">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {n.title}
                      </p>
                      {!n.read && <span className="mt-1 h-2 w-2 rounded-full bg-brand-500 shrink-0" />}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{n.message}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {formatDateTime(n.time)} · {n.category}
                    </p>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 p-3">
        <Link
          to="/notifications"
          onClick={onClose}
          className="btn-primary w-full justify-center text-sm"
        >
          View All Notifications
        </Link>
      </div>
    </div>
  )
}
