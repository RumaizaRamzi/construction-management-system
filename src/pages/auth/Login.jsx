import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import BrandLogo from '../../components/ui/BrandLogo'
import { useApp } from '../../contexts/AppContext'
import { getApiErrorMessage } from '../../services/api'

export default function Login() {
  const { user, login, authReady } = useApp()
  const navigate = useNavigate()
  const remembered = localStorage.getItem('bt_remember') || ''
  const [email, setEmail] = useState(remembered || (import.meta.env.DEV ? 'admin@buildtrack.local' : ''))
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(Boolean(remembered))
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500 dark:bg-slate-950">
        Loading…
      </div>
    )
  }

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please enter email and password.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await login({ email: email.trim(), password })
      if (remember) localStorage.setItem('bt_remember', email.trim())
      else localStorage.removeItem('bt_remember')
      navigate('/')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid email or password.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-100 dark:bg-slate-950">
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-slate-900 p-10 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-500/30 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url(/images/product-1.svg)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="relative z-10 flex items-center gap-3">
          <BrandLogo className="h-16 w-16 p-1" />
          <div>
            <p className="font-display text-xl font-bold">RN TRADING LANKA PVT. LTD</p>
            <p className="text-sm text-slate-300">Construction Management System</p>
          </div>
        </div>
        <div className="relative z-10 max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight">
            Manage equipment, rentals, and jobsites in one place.
          </h1>
          <p className="mt-4 text-slate-300">
            Track inventory, sales, bookings, maintenance checks, and financials with a professional operations dashboard built for construction businesses.
          </p>
        </div>
        <p className="relative z-10 text-sm text-slate-400">© {new Date().getFullYear()} RN TRADING LANKA PVT. LTD — Construction Management System</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandLogo className="h-14 w-14 p-0.5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700" />
            <div>
              <p className="font-display text-lg font-bold leading-tight text-slate-900 dark:text-white">RN TRADING LANKA PVT. LTD</p>
              <p className="text-xs text-slate-500">Construction Management System</p>
            </div>
          </div>

          <div className="card p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">Sign in to your RN TRADING LANKA PVT. LTD account</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error && <div className="rounded-lg bg-red-50 text-sm px-3 py-2 text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="username"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input-field pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Remember me
                </label>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Login'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
