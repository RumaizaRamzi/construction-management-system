import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'

export default function RelatedRecordCard({ title = 'Related Records', items = [] }) {
  const visible = items.filter(Boolean)
  if (!visible.length) return null

  return (
    <div className="card p-5 print:hidden">
      <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-4">{title}</h3>
      <div className="space-y-3">
        {visible.map((item) => (
          <div
            key={item.key || item.label}
            className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-1 font-medium text-slate-900 dark:text-white">{item.title}</p>
            {item.subtitle && (
              <p className="text-sm text-slate-500 mt-0.5">{item.subtitle}</p>
            )}
            {item.to && (
              <Link to={item.to} className="btn-secondary mt-3 text-xs inline-flex">
                <ExternalLink size={14} />
                {item.actionLabel || 'View'}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
