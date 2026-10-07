import { Link, useNavigate } from 'react-router-dom'
import { FileQuestion, HardHat } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'

export default function NotFound() {
  const { user } = useApp()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="card w-full max-w-md space-y-4 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <FileQuestion size={22} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">404</p>
          <h1 className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-white">Page not found.</h1>
          <p className="mt-2 text-sm text-slate-500">
            The page you requested does not exist or may have been moved.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {user ? (
            <Link to="/" className="btn-primary">
              <HardHat size={16} />
              Go to Dashboard
            </Link>
          ) : (
            <Link to="/login" className="btn-primary">
              Go to Login
            </Link>
          )}
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}
