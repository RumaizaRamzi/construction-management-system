import { Navigate, Outlet } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import ChangePasswordRequired from '../pages/auth/ChangePasswordRequired'

export default function ProtectedRoute() {
  const { user, authReady } = useApp()

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500 dark:bg-slate-950">
        Loading session…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (user.must_change_password) return <ChangePasswordRequired />
  return <Outlet />
}
