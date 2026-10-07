import { Link, useNavigate } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'

export default function Forbidden() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="card w-full max-w-md space-y-4 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40">
          <ShieldOff size={22} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">403</p>
          <h1 className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-white">
            You don&apos;t have permission to access this page.
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Contact an administrator if you believe this is a mistake.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
            Go Back
          </button>
          <Link to="/" className="btn-primary">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
