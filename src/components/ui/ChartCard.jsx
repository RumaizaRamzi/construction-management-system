export default function ChartCard({
  title,
  subtitle,
  children,
  action,
  empty = false,
  emptyLabel = 'No data recorded for this period yet.',
  icon: Icon,
  className = '',
  bodyClassName = 'h-56 sm:h-64',
  accent = false,
}) {
  return (
    <div
      className={`card p-4 sm:p-5 ${
        accent ? 'relative overflow-hidden transition-shadow duration-200 hover:shadow-lg' : ''
      } ${className}`}
    >
      {accent ? (
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-brand-50/70 to-transparent dark:from-brand-950/20"
          aria-hidden
        />
      ) : null}
      <div className={`mb-4 flex flex-wrap items-start justify-between gap-3 ${accent ? 'relative' : ''}`}>
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                accent
                  ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-500/30'
                  : 'bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400'
              }`}
            >
              <Icon size={17} aria-hidden />
            </div>
          ) : null}
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-slate-900 dark:text-white">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className={`w-full min-w-0 overflow-hidden ${accent ? 'relative' : ''} ${bodyClassName}`}>
        {empty ? (
          <div
            className={`flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-700 ${
              accent ? 'bg-slate-50/60 dark:bg-slate-800/30' : ''
            }`}
          >
            {emptyLabel}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
