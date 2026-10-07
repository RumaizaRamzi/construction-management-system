import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlarmClock, Bell } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import StatCard from '../../components/ui/StatCard'
import {
  ReminderFilters,
  ReminderList,
} from '../../components/reminders'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage } from '../../services/api'
import {
  SECTION_META,
  applyReminderOverrides,
  categorizeReminders,
  defaultReminderFilters,
  filterReminders,
  generateReminders,
  snoozeReminderOverride,
} from '../../utils/reminderHelpers'

export default function Reminders() {
  const {
    checks,
    rentals,
    products,
    maintenance,
    reminders,
    recurringReminders,
    reminderOverrides,
    remindersLoading,
    remindersError,
    loadReminders,
    markReminderRead,
    completeReminder,
    dismissReminder,
    snoozeReminder,
  } = useApp()
  const { success, error: toastError } = useToast()

  const [draftFilters, setDraftFilters] = useState(defaultReminderFilters)
  const [appliedFilters, setAppliedFilters] = useState(defaultReminderFilters)

  const generated = useMemo(
    () =>
      generateReminders({
        checks,
        rentals,
        products,
        maintenance,
        recurring: recurringReminders,
      }),
    [checks, rentals, products, maintenance, recurringReminders]
  )

  // Prefer MySQL reminders; merge derived operational reminders that are not already persisted.
  const merged = useMemo(() => {
    const apiIds = new Set(reminders.map((r) => String(r.id)))
    const fromApi = reminders.filter((r) => r.apiStatus !== 'Dismissed' && r.apiStatus !== 'Completed')
    const derived = generated.filter((g) => !apiIds.has(String(g.id)))
    return [...fromApi, ...derived]
  }, [reminders, generated])

  const active = useMemo(
    () => applyReminderOverrides(merged, reminderOverrides),
    [merged, reminderOverrides]
  )

  const filtered = useMemo(
    () => filterReminders(active, appliedFilters),
    [active, appliedFilters]
  )

  const sections = useMemo(() => categorizeReminders(filtered), [filtered])

  const stats = useMemo(
    () => ({
      total: filtered.length,
      today: sections.today.length,
      overdue: sections.overdue.length,
      unread: filtered.filter((r) => (r.status || 'Unread') === 'Unread').length,
    }),
    [filtered, sections]
  )

  const handleMarkRead = async (reminder) => {
    try {
      await markReminderRead(reminder.id)
      success('Reminder marked as read.')
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to update reminder.'))
    }
  }

  const handleComplete = async (reminder) => {
    try {
      await completeReminder(reminder.id)
      success('Reminder completed.')
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to complete reminder.'))
    }
  }

  const handleSnooze = async (reminder) => {
    try {
      await snoozeReminder(reminder.id, snoozeReminderOverride(reminder, 1))
      success('Reminder snoozed for 1 day.')
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to snooze reminder.'))
    }
  }

  const handleDismiss = async (reminder) => {
    try {
      await dismissReminder(reminder.id)
      success('Reminder dismissed.')
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to dismiss reminder.'))
    }
  }

  if (remindersLoading && reminders.length === 0 && generated.length === 0) {
    return <LoadingState label="Loading reminders..." />
  }

  if (remindersError && reminders.length === 0) {
    return (
      <div className="page-shell">
        <ApiErrorState
          title="Unable to load reminders"
          message={remindersError}
          onRetry={() => loadReminders().catch(() => {})}
        />
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Breadcrumbs items={[{ label: 'Reminders' }]} />
          <h1 className="page-title">Reminders</h1>
          <p className="page-subtitle">
            Persistent reminders from MySQL plus operational alerts from checks, rentals, and maintenance
          </p>
        </div>
        <Link to="/reminders/recurring" className="btn-secondary shrink-0">
          <AlarmClock size={16} />
          Recurring Reminders
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Active Reminders" value={stats.total} icon={Bell} tone="brand" />
        <StatCard title="Due Today" value={stats.today} icon={Bell} tone="blue" />
        <StatCard title="Overdue" value={stats.overdue} icon={Bell} tone="red" />
        <StatCard title="Unread" value={stats.unread} icon={Bell} tone="violet" />
      </div>

      <ReminderFilters
        filters={draftFilters}
        onChange={setDraftFilters}
        onFilter={() => setAppliedFilters({ ...draftFilters })}
        onReset={() => {
          const empty = defaultReminderFilters()
          setDraftFilters(empty)
          setAppliedFilters(empty)
        }}
      />

      <div className="space-y-8">
        {SECTION_META.map((section) => (
          <ReminderList
            key={section.key}
            title={section.title}
            reminders={sections[section.key] || []}
            emptyMessage={`No ${section.title.toLowerCase()} reminders.`}
            onMarkRead={handleMarkRead}
            onComplete={handleComplete}
            onSnooze={handleSnooze}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    </div>
  )
}
