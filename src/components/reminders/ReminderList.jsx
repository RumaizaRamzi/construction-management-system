import ReminderCard from './ReminderCard'

export default function ReminderList({
  title,
  reminders = [],
  emptyMessage = 'No reminders in this section.',
  onMarkRead,
  onComplete,
  onSnooze,
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
          {title}
        </h2>
        <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-full px-2.5 py-1">
          {reminders.length}
        </span>
      </div>

      {reminders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid gap-3">
          {reminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              onMarkRead={onMarkRead}
              onComplete={onComplete}
              onSnooze={onSnooze}
            />
          ))}
        </div>
      )}
    </section>
  )
}
