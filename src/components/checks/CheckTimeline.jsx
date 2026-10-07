import { CheckCircle2, Circle } from 'lucide-react'
import { cn, formatDateDMY } from '../../utils/helpers'
import { DEFAULT_CHECK_TIMELINE, buildCheckTimeline } from '../../utils/checkHelpers'

export default function CheckTimeline({ check }) {
  const events = buildCheckTimeline(check)
  const eventMap = Object.fromEntries(events.map((e) => [e.event, e]))

  return (
    <div className="card p-5">
      <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-6">
        Check Timeline
      </h3>
      <ol className="relative ml-3 space-y-0">
        {DEFAULT_CHECK_TIMELINE.map((step, index) => {
          const entry = eventMap[step]
          const completed = Boolean(entry)
          const isLast = index === DEFAULT_CHECK_TIMELINE.length - 1

          return (
            <li key={step} className="relative pb-6 last:pb-0 pl-6">
              {!isLast && (
                <span
                  className={cn(
                    'absolute left-0 top-5 bottom-0 w-px -translate-x-1/2',
                    completed ? 'bg-emerald-200 dark:bg-emerald-800' : 'bg-slate-200 dark:bg-slate-700'
                  )}
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  'absolute left-0 top-0.5 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-white dark:bg-slate-900',
                  completed ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                )}
              >
                {completed ? <CheckCircle2 size={20} /> : <Circle size={16} />}
              </span>
              <div>
                <p
                  className={cn(
                    'text-sm font-medium',
                    completed ? 'text-slate-900 dark:text-white' : 'text-slate-400'
                  )}
                >
                  {step}
                </p>
                {entry?.date && (
                  <p className="text-xs text-slate-500 mt-0.5">{formatDateDMY(entry.date)}</p>
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
