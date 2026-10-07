import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import { NotificationSettings } from '../../components/notifications'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage } from '../../services/api'
import { DEFAULT_NOTIFICATION_SETTINGS } from '../../utils/notificationHelpers'

export default function NotificationSettingsPage() {
  const { settings, updateSettings, can } = useApp()
  const { success, error: toastError } = useToast()
  const [saving, setSaving] = useState(false)
  const canManage = can('settings.manage')
  const [form, setForm] = useState({
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...settings,
  })

  useEffect(() => {
    setForm({
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...settings,
    })
  }, [settings])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateSettings({
      enableNotifications: form.enableNotifications,
      enableRentalReminders: form.enableRentalReminders,
      enableLowStockAlerts: form.enableLowStockAlerts,
      enableMaintenanceReminders: form.enableMaintenanceReminders,
      enablePaymentAlerts: form.enablePaymentAlerts,
      enableBookingNotifications: form.enableBookingNotifications,
      reminderTiming: form.reminderTiming,
      emailNotifications: form.emailNotifications ?? settings.emailNotifications,
      smsNotifications: form.smsNotifications ?? settings.smsNotifications,
      })
      success('Notification settings saved.')
    } catch (err) {
      toastError(getApiErrorMessage(err, 'Unable to save notification settings.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Settings', to: '/settings' },
              { label: 'Notifications' },
            ]}
          />
          <h1 className="page-title">Notification Settings</h1>
          <p className="page-subtitle">
            Control which automatic alerts appear in the notification center
          </p>
        </div>
        <Link to="/settings" className="btn-secondary shrink-0">
          <ArrowLeft size={16} />
          Back to Settings
        </Link>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {!canManage && (
          <p className="text-sm text-amber-600">Changing notification settings requires the settings.manage permission.</p>
        )}
        <fieldset disabled={!canManage} className="contents">
          <NotificationSettings settings={form} onChange={setForm} />
        </fieldset>
        <div className="flex flex-wrap gap-3">
          {canManage && (
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Notification Settings'}
            </button>
          )}
          <Link to="/notifications" className="btn-secondary">
            Open Notification Center
          </Link>
        </div>
      </form>
    </div>
  )
}
