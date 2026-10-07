import { useState } from 'react'
import { KeyRound, LogOut } from 'lucide-react'
import BrandLogo from '../../components/ui/BrandLogo'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'

const EMPTY = { current_password: '', password: '', password_confirmation: '' }

/** Shown instead of the app until a user with a temporary password sets their own. */
export default function ChangePasswordRequired() {
  const { user, updateProfile, logout } = useApp()
  const { success, error: toastError } = useToast()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const next = {}
    if (!form.current_password) next.current_password = 'Enter the temporary password you were given.'
    if (form.password.length < 8) next.password = 'The new password must be at least 8 characters.'
    else if (form.password === form.current_password) next.password = 'Choose a password that is different from the temporary one.'
    if (form.password !== form.password_confirmation) next.password_confirmation = 'The passwords do not match.'
    setErrors(next)
    if (Object.keys(next).length) return

    setSaving(true)
    try {
      await updateProfile(form)
      success('Password changed. Welcome to RN TRADING LANKA PVT. LTD.')
    } catch (err) {
      setErrors(getApiValidationErrors(err))
      toastError(getApiErrorMessage(err, 'Unable to change password.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
      <form onSubmit={handleSubmit} className="card w-full max-w-md space-y-5 p-6" noValidate>
        <div className="flex items-center gap-3">
          <BrandLogo className="h-12 w-12 p-0.5 ring-1 ring-slate-200 dark:ring-slate-700" />
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">Set a new password</h1>
            <p className="text-sm text-slate-500">Hi {user?.name}, please replace your temporary password to continue.</p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="cp-current">Temporary password</label>
          <input id="cp-current" type="password" className="input-field" autoComplete="current-password" value={form.current_password} onChange={set('current_password')} />
          {errors.current_password && <p className="mt-1 text-xs text-red-600">{errors.current_password}</p>}
        </div>
        <div>
          <label className="label" htmlFor="cp-new">New password</label>
          <input id="cp-new" type="password" className="input-field" autoComplete="new-password" value={form.password} onChange={set('password')} />
          <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
        </div>
        <div>
          <label className="label" htmlFor="cp-confirm">Confirm new password</label>
          <input id="cp-confirm" type="password" className="input-field" autoComplete="new-password" value={form.password_confirmation} onChange={set('password_confirmation')} />
          {errors.password_confirmation && <p className="mt-1 text-xs text-red-600">{errors.password_confirmation}</p>}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <button type="button" className="btn-secondary justify-center" onClick={() => logout()} disabled={saving}>
            <LogOut size={16} />
            Sign out
          </button>
          <button type="submit" className="btn-primary justify-center" disabled={saving}>
            <KeyRound size={16} />
            {saving ? 'Saving…' : 'Change Password'}
          </button>
        </div>
      </form>
    </div>
  )
}
