import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCheck, Settings } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import LoadingState from '../../components/ui/LoadingState'
import StatCard from '../../components/ui/StatCard'
import {
  NotificationCenter,
  NotificationFilters,
} from '../../components/notifications'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage } from '../../services/api'
import { paginate } from '../../utils/helpers'
import {
  filterNotifications,
  getNotificationStats,
} from '../../utils/notificationHelpers'

const PAGE_SIZE = 8

export default function Notifications() {
  const {
    notifications,
    notificationsLoading,
    notificationsError,
    loadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    dismissNotification,
    deleteNotification,
  } = useApp()
  const { success, error: showError } = useToast()

  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('')
  const [readStatus, setReadStatus] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [category, search, priority, readStatus])

  const stats = useMemo(() => getNotificationStats(notifications), [notifications])

  const filtered = useMemo(
    () =>
      filterNotifications(notifications, {
        category,
        search,
        priority,
        readStatus,
      }),
    [notifications, category, search, priority, readStatus]
  )

  const paged = paginate(filtered, page, PAGE_SIZE)

  const handleCategory = (cat) => {
    setCategory(cat)
    setPage(1)
  }

  const handleMarkRead = async (n) => {
    setBusy(true)
    try {
      const result = await markNotificationRead(n.id)
      success(result?.message || 'Notification marked as read.')
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to mark notification as read.'))
    } finally {
      setBusy(false)
    }
  }

  const handleMarkAll = async () => {
    setBusy(true)
    try {
      const result = await markAllNotificationsRead()
      success(result?.message || 'All notifications marked as read.')
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to mark all notifications as read.'))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (n) => {
    setBusy(true)
    try {
      const result = await deleteNotification(n.id)
      success(result?.message || 'Notification deleted.')
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to delete notification.'))
    } finally {
      setBusy(false)
    }
  }

  const handleDismiss = async (n) => {
    setBusy(true)
    try {
      const result = await dismissNotification(n.id)
      success(result?.message || 'Notification dismissed.')
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to dismiss notification.'))
    } finally {
      setBusy(false)
    }
  }

  if (notificationsLoading && notifications.length === 0) {
    return <LoadingState label="Loading notifications..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumbs items={[{ label: 'Notifications' }]} />
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">
            Automatic alerts from rentals, bookings, inventory, maintenance, and payments
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/settings/notifications" className="btn-secondary">
            <Settings size={16} />
            Notification Settings
          </Link>
          {stats.unread > 0 && (
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={handleMarkAll}
            >
              <CheckCheck size={16} />
              Mark All as Read
            </button>
          )}
        </div>
      </div>

      {notificationsError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex flex-wrap items-center justify-between gap-3">
          <span>{notificationsError}</span>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => loadNotifications({ generate: true }).catch(() => {})}
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total" value={stats.total} icon={Bell} tone="brand" />
        <StatCard title="Unread" value={stats.unread} icon={Bell} tone="blue" />
        <StatCard title="Urgent Unread" value={stats.urgent} icon={Bell} tone="red" />
        <StatCard title="Rental Alerts" value={stats.rentals} icon={Bell} tone="violet" />
      </div>

      <NotificationFilters
        category={category}
        onCategory={handleCategory}
        search={search}
        onSearch={(v) => {
          setSearch(v)
          setPage(1)
        }}
        priority={priority}
        onPriority={(v) => {
          setPriority(v)
          setPage(1)
        }}
        readStatus={readStatus}
        onReadStatus={(v) => {
          setReadStatus(v)
          setPage(1)
        }}
      />

      <NotificationCenter
        notifications={paged.data}
        page={paged.page}
        totalPages={paged.totalPages}
        total={paged.total}
        onPageChange={setPage}
        onMarkRead={handleMarkRead}
        onDelete={handleDelete}
        onDismiss={handleDismiss}
      />
    </div>
  )
}
