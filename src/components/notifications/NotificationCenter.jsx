import NotificationCard from './NotificationCard'
import EmptyState from '../ui/EmptyState'
import Pagination from '../ui/Pagination'

export default function NotificationCenter({
  notifications = [],
  page,
  totalPages,
  total,
  onPageChange,
  onMarkRead,
  onDelete,
  onDismiss,
  onView,
}) {
  if (!notifications.length) {
    return (
      <EmptyState
        title="No notifications found."
        description="You're all caught up — no alerts match your filters."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {notifications.map((n) => (
          <NotificationCard
            key={n.id}
            notification={n}
            onMarkRead={onMarkRead}
            onDelete={onDelete}
            onDismiss={onDismiss}
            onView={onView}
          />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} onChange={onPageChange} />
    </div>
  )
}
