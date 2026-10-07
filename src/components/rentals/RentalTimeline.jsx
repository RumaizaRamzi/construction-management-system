import { CheckCircle2, Circle } from 'lucide-react'
import { cn, formatDate } from '../../utils/helpers'
import { DEFAULT_RENTAL_TIMELINE } from '../../utils/rentalHelpers'

export default function RentalTimeline({ rental }) {
  const events = rental?.timeline || []
  const eventMap = Object.fromEntries(events.map((e) => [e.event, e]))

  return (
    <div className="card p-5">
      <h3 className="font-medium text-slate-900 dark:text-white mb-6">Rental Timeline</h3>
      <ol className="relative border-l border-slate-200 dark:border-slate-700 ml-3 space-y-6">
        {DEFAULT_RENTAL_TIMELINE.map((step, index) => {
          const entry = eventMap[step]
          const completed = Boolean(entry)
          const isLast = index === DEFAULT_RENTAL_TIMELINE.length - 1

          return (
            <li key={step} className="relative pl-6">
              <span
                className={cn(
                  'absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-900',
                  completed ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                )}
              >
                {completed ? <CheckCircle2 size={20} /> : <Circle size={16} />}
              </span>
              {!isLast && (
                <span
                  className={cn(
                    'absolute -left-px top-5 h-full w-px',
                    completed ? 'bg-emerald-200 dark:bg-emerald-800' : 'bg-slate-200 dark:bg-slate-700'
                  )}
                />
              )}
              <div>
                <p className={cn('text-sm font-medium', completed ? 'text-slate-900 dark:text-white' : 'text-slate-400')}>
                  {step}
                </p>
                {entry?.date && (
                  <p className="text-xs text-slate-500 mt-0.5">{formatDate(entry.date)}</p>
                )}
                {entry?.note && (
                  <p className="text-xs text-slate-500 mt-1">{entry.note}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
