import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Shield } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import { useApp } from '../../contexts/AppContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'

/** Personal settings for every user. Company settings live in Administration > Settings. */
export default function Settings() {
  const { user, updateProfile, isAdmin } = useApp()
  const { theme, setTheme } = useTheme()
  const { success, error: toastError } = useToast()
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    current_password: '',
    password: '',
    password_confirmation: '',
  })
  const [profileErrors, setProfileErrors] = useState({})
  const [profileSaving, setProfileSaving] = useState(false)

  useEffect(() => {
    setProfile((prev) => ({
      ...prev,
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    }))
  }, [user])

  const setProfileField = (key, value) => setProfile((prev) => ({ ...prev, [key]: value }))

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setProfileSaving(true)
    setProfileErrors({})
    try {
      const payload = {
        name: profile.name.trim(),
        email: profile.email.trim(),
        phone: profile.phone.trim() || null,
      }
      if (profile.password) {
        payload.password = profile.password
        payload.password_confirmation = profile.password_confirmation
        payload.current_password = profile.current_password
      }
      const { message } = await updateProfile(payload)
      setProfile((prev) => ({
        ...prev,
        current_password: '',
        password: '',
        password_confirmation: '',
      }))
      success(message)
    } catch (err) {
      const validation = getApiValidationErrors(err)
      if (Object.keys(validation).length) setProfileErrors(validation)
      toastError(getApiErrorMessage(err, 'Unable to update profile.'))
    } finally {
      setProfileSaving(false)
    }
  }

  return (
    <div className="page-shell">
      <PageHeader title="My Settings" subtitle="Your profile, password and theme" breadcrumbs={[{ label: 'My Settings' }]} />

      {isAdmin && (
        <Link
          to="/admin/settings"
          className="card flex items-center gap-3 p-4 text-sm text-slate-600 hover:border-brand-400 dark:text-slate-300"
        >
          <Shield size={18} className="shrink-0 text-brand-600" />
          <span>
            Company details, currency, invoice footer and branches are in <strong>Administration › Settings</strong>.
          </span>
        </Link>
      )}

      <form onSubmit={handleProfileSave} className="card space-y-4 p-5">
        <h3 className="font-display text-lg font-semibold">My Profile</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input className="input-field" value={profile.name} onChange={(e) => setProfileField('name', e.target.value)} required />
            {profileErrors.name && <p className="mt-1 text-xs text-red-600">{profileErrors.name}</p>}
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input-field" type="email" value={profile.email} onChange={(e) => setProfileField('email', e.target.value)} required />
            {profileErrors.email && <p className="mt-1 text-xs text-red-600">{profileErrors.email}</p>}
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input-field" value={profile.phone} onChange={(e) => setProfileField('phone', e.target.value)} />
          </div>
          <div>
            <label className="label">Role</label>
            <input className="input-field" value={user?.role || ''} disabled />
          </div>
          <div>
            <label className="label">Current password</label>
            <input
              className="input-field"
              type="password"
              value={profile.current_password}
              onChange={(e) => setProfileField('current_password', e.target.value)}
              autoComplete="current-password"
            />
            {profileErrors.current_password && (
              <p className="mt-1 text-xs text-red-600">{profileErrors.current_password}</p>
            )}
          </div>
          <div>
            <label className="label">New password</label>
            <input
              className="input-field"
              type="password"
              value={profile.password}
              onChange={(e) => setProfileField('password', e.target.value)}
              autoComplete="new-password"
            />
            {profileErrors.password && <p className="mt-1 text-xs text-red-600">{profileErrors.password}</p>}
          </div>
          <div className="md:col-span-2">
            <label className="label">Confirm new password</label>
            <input
              className="input-field"
              type="password"
              value={profile.password_confirmation}
              onChange={(e) => setProfileField('password_confirmation', e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={profileSaving}>
          {profileSaving ? 'Saving…' : 'Save Profile'}
        </button>
      </form>

      <section className="card space-y-4 p-5">
        <h3 className="font-display text-lg font-semibold">Theme</h3>
        <div className="flex flex-wrap gap-3">
          {['light', 'dark'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`rounded-lg border px-4 py-2 text-sm capitalize ${
                theme === t
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              {t} mode
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Theme is a personal preference saved in this browser.</p>
      </section>
    </div>
  )
}
