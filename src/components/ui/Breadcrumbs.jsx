import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export default function Breadcrumbs({ items = [] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
      <Link to="/" className="hover:text-brand-600 dark:hover:text-brand-400">
        Home
      </Link>
      {items.map((item, idx) => (
        <span key={`${item.label}-${idx}`} className="inline-flex items-center gap-1">
          <ChevronRight size={14} className="shrink-0 text-slate-400" aria-hidden />
          {idx === items.length - 1 || !item.to ? (
            <span className="font-medium text-slate-800 dark:text-slate-200">{item.label}</span>
          ) : (
            <Link to={item.to} className="hover:text-brand-600 dark:hover:text-brand-400">
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
