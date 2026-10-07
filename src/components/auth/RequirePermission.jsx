import { Navigate } from 'react-router-dom'
import { useApp } from '../../contexts/AppContext'

/**
 * Renders children only when the user has at least one of the given permissions.
 */
export default function RequirePermission({ any = [], children }) {
  const { user, can, authReady } = useApp()

  if (!authReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500" role="status">
        Checking access…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (any.length > 0 && !any.some((slug) => can(slug))) {
    return <Navigate to="/403" replace />
  }

  return children
}
