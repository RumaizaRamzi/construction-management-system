import { X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'

export default function Modal({ open, onClose, title, children, size = 'md', footer, closeOnOverlay = true }) {
  const titleId = useId()
  const panelRef = useRef(null)
  // Parents usually pass an inline onClose; keeping it in a ref stops the effect below
  // from re-running (and re-focusing) on every parent render, e.g. on each keystroke.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
      // With stacked modals only the topmost one should close.
      if (dialogs.length && dialogs[dialogs.length - 1] !== panelRef.current) return
      onCloseRef.current?.()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Focus first focusable in dialog once, when it opens
    const t = window.setTimeout(() => {
      if (panelRef.current?.contains(document.activeElement)) return
      const el = panelRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      el?.focus?.()
    }, 0)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="presentation">
      <div
        className="absolute inset-0 bg-slate-900/50"
        onClick={() => closeOnOverlay && onClose?.()}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[92vh] w-full flex-col rounded-t-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900 sm:max-h-[90vh] sm:rounded-xl ${sizes[size]}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5 sm:py-4">
          <h3 id={titleId} className="font-display text-base font-semibold text-slate-900 dark:text-white sm:text-lg">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer ? (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:justify-end sm:px-5 sm:py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
