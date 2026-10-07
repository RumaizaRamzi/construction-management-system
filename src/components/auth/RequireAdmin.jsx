import { Navigate } from 'react-router-dom'
import { useApp } from '../../contexts/AppContext'

/** Renders children only for users with the Admin role; everyone else gets the Access Denied page. */
export default function RequireAdmin({ children }) {
  const { user, isAdmin, authReady } = useApp()

  if (!authReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500" role="status">
        Checking access…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/403" replace />

  return children
}
