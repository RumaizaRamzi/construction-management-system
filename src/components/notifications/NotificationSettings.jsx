import { REMINDER_TIMING_OPTIONS } from '../../utils/notificationHelpers'

function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-white">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange?.(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}

export default function NotificationSettings({ settings, onChange }) {
  const set = (key, value) => onChange?.({ ...settings, [key]: value })

  return (
    <div className="space-y-6">
      <section className="card p-5 space-y-3">
        <h3 className="font-display font-semibold text-lg text-slate-900 dark:text-white">
          Notification Channels
        </h3>
        <Toggle
          label="Enable Notifications"
          description="Master switch for all automatic frontend alerts."
          checked={!!settings.enableNotifications}
          onChange={(v) => set('enableNotifications', v)}
        />
        <Toggle
          label="Enable Rental Reminders"
          description="Return due and overdue rental alerts."
          checked={!!settings.enableRentalReminders}
          onChange={(v) => set('enableRentalReminders', v)}
        />
        <Toggle
          label="Enable Low Stock Alerts"
          description="When available quantity is at or below minimum stock."
          checked={!!settings.enableLowStockAlerts}
          onChange={(v) => set('enableLowStockAlerts', v)}
        />
        <Toggle
          label="Enable Maintenance Reminders"
          description="Active and overdue maintenance job alerts."
          checked={!!settings.enableMaintenanceReminders}
          onChange={(v) => set('enableMaintenanceReminders', v)}
        />
        <Toggle
          label="Enable Payment Alerts"
          description="Pending and overdue sale/rental payments."
          checked={!!settings.enablePaymentAlerts}
          onChange={(v) => set('enablePaymentAlerts', v)}
        />
        <Toggle
          label="Enable Booking Notifications"
          description="Pending and confirmed booking alerts."
          checked={!!settings.enableBookingNotifications}
          onChange={(v) => set('enableBookingNotifications', v)}
        />
      </section>

      <section className="card p-5 space-y-4">
        <h3 className="font-display font-semibold text-lg text-slate-900 dark:text-white">
          Reminder Timing
        </h3>
        <p className="text-sm text-slate-500">
          How far ahead to generate approaching rental and check reminders.
        </p>
        <div>
          <label className="label">Notify</label>
          <select
            className="input-field max-w-sm"
            value={settings.reminderTiming || '1 Day Before'}
            onChange={(e) => set('reminderTiming', e.target.value)}
            disabled={!settings.enableNotifications}
          >
            {REMINDER_TIMING_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </section>
    </div>
  )
}
