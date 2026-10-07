import { Link } from 'react-router-dom'
import { AlarmClock, ArrowRight, Bell, CalendarCheck, PackageX, Undo2, Wrench } from 'lucide-react'
import StatusBadge from '../ui/StatusBadge'
import { formatDate, formatDateDMY } from '../../utils/helpers'
import NotificationCard from './NotificationCard'

function WidgetCard({ title, to, linkLabel = 'View all', icon: Icon, children }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-3">
          {Icon ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
              <Icon size={17} aria-hidden />
            </div>
          ) : null}
          <h3 className="truncate font-display font-semibold text-slate-900 dark:text-white">{title}</h3>
        </div>
        {to && (
          <Link
            to={to}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            {linkLabel}
            <ArrowRight size={14} aria-hidden />
          </Link>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function SimpleList({ items, empty, render }) {
  if (!items.length) {
    return <p className="text-sm text-slate-500 py-4 text-center">{empty}</p>
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-sm transition-colors hover:border-brand-100 hover:bg-brand-50/40 dark:border-slate-800 dark:bg-slate-800/30 dark:hover:bg-slate-800/60"
        >
          {render(item)}
        </li>
      ))}
    </ul>
  )
}

export default function DashboardAlertWidgets({
  widgets,
  notifications = [],
  onMarkRead,
}) {
  const {
    upcomingChecks = [],
    overdueChecks = [],
    upcomingMaintenance = [],
    rentalReturnsDue = [],
    lowStockAlerts = [],
  } = widgets || {}

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-400">Operations</p>
        <h2 className="mt-0.5 font-display text-lg font-semibold text-slate-900 dark:text-white sm:text-xl">
          Operations Alerts
        </h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Live checks, maintenance, returns, stock, and notifications
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <WidgetCard title="Upcoming Checks" to="/checks" icon={CalendarCheck}>
          <SimpleList
            items={upcomingChecks.slice(0, 5)}
            empty="No upcoming checks this week."
            render={(c) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.check}</p>
                  <p className="text-xs text-slate-500">
                    {c.product} · {formatDateDMY(c.checkDate)}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>
            )}
          />
        </WidgetCard>

        <WidgetCard title="Overdue Checks" to="/checks" icon={AlarmClock}>
          <SimpleList
            items={overdueChecks.slice(0, 5)}
            empty="No overdue checks."
            render={(c) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.check}</p>
                  <p className="text-xs text-slate-500">
                    {c.product} · due {formatDateDMY(c.checkDate)}
                  </p>
                </div>
                <StatusBadge status="Overdue" />
              </div>
            )}
          />
        </WidgetCard>

        <WidgetCard title="Upcoming Maintenance" to="/maintenance" icon={Wrench}>
          <SimpleList
            items={upcomingMaintenance.slice(0, 5)}
            empty="No active maintenance jobs."
            render={(m) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{m.product}</p>
                  <p className="text-xs text-slate-500">
                    {m.maintenanceType} · {formatDateDMY(m.expectedCompletion)}
                  </p>
                </div>
                <StatusBadge status={m.status} />
              </div>
            )}
          />
        </WidgetCard>

        <WidgetCard title="Rental Returns Due" to="/rentals" icon={Undo2}>
          <SimpleList
            items={rentalReturnsDue.slice(0, 5)}
            empty="No returns due soon."
            render={(r) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.product}</p>
                  <p className="text-xs text-slate-500">
                    {r.rentalId || r.rentalNumber} · {formatDate(r.expectedReturn)}
                  </p>
                </div>
                <StatusBadge status={r.rentalStatus} />
              </div>
            )}
          />
        </WidgetCard>

        <WidgetCard title="Low Stock Alerts" to="/products" icon={PackageX}>
          <SimpleList
            items={lowStockAlerts.slice(0, 5)}
            empty="Stock levels look healthy."
            render={(p) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    Available {p.available} / min {p.minStock}
                  </p>
                </div>
                <StatusBadge status="Urgent" />
              </div>
            )}
          />
        </WidgetCard>

        <WidgetCard title="Recent Notifications" to="/notifications" linkLabel="Open center" icon={Bell}>
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No recent notifications.</p>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 4).map((n) => (
                <NotificationCard
                  key={n.id}
                  notification={n}
                  compact
                  showActions={false}
                  onMarkRead={() => onMarkRead?.(n)}
                />
              ))}
            </div>
          )}
        </WidgetCard>
      </div>
    </div>
  )
}
