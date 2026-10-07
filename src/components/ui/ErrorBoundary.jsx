import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('BuildTrack UI error:', error, info)
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 dark:bg-slate-950">
          <div className="card w-full max-w-md space-y-4 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/40">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">Something went wrong.</h1>
              <p className="mt-2 text-sm text-slate-500">
                An unexpected error occurred while rendering this page. You can reload and continue working.
              </p>
              {import.meta.env.DEV && this.state.error?.message ? (
                <p className="mt-3 rounded-lg bg-slate-50 p-2 text-left text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {String(this.state.error.message)}
                </p>
              ) : null}
            </div>
            <button type="button" className="btn-primary w-full" onClick={this.handleReload}>
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
