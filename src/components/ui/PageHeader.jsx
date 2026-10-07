import Breadcrumbs from './Breadcrumbs'
import { cn } from '../../utils/helpers'

/**
 * Consistent page header: breadcrumbs, title, subtitle, actions, filters.
 * Breadcrumbs sit above the title/actions row so action buttons align with the title.
 */
export default function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  filters,
  className,
}) {
  return (
    <header className={cn('space-y-3', className)}>
      {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">{actions}</div>
        ) : null}
      </div>
      {filters ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">{filters}</div>
      ) : null}
    </header>
  )
}
