import { cn, formatCurrency, formatDateDMY } from '../../utils/helpers'

const toneDot = {
  slate: 'bg-slate-400',
  blue: 'bg-sky-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
}

export default function FinancialTimeline({ events = [], title = 'Transaction Timeline' }) {
  if (!events.length) return null

  return (
    <div className="card p-5 print:hidden">
      <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-4">{title}</h3>
      <ol className="relative space-y-0">
        {events.map((event, index) => (
          <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
            {index < events.length - 1 && (
              <span className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />
            )}
            <span
              className={cn(
                'relative z-10 mt-1 h-4 w-4 shrink-0 rounded-full ring-4 ring-white dark:ring-slate-900',
                toneDot[event.tone] || toneDot.slate
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-slate-900 dark:text-white">{event.title}</p>
                <p className="text-xs text-slate-500">{formatDateDMY(event.date)}</p>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{event.description}</p>
              {event.meta ? <p className="text-xs text-slate-400 mt-1">{event.meta}</p> : null}
            </div>
          </li>
        ))}
      </ol>
      {events.some((e) => e.id === 'fully-paid') ? null : (
        <p className="mt-2 text-xs text-slate-400">Awaiting full settlement</p>
      )}
    </div>
  )
}

export function TimelineAmountHint({ amount }) {
  return <span>{formatCurrency(amount)}</span>
}
