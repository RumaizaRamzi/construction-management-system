import { formatCurrency } from '../../utils/helpers'
import { DONUT_COLORS } from './chartTheme'

/** Vertical gradient defs for bars/areas; reference with fill="url(#id)". */
export function GradientDefs({ items }) {
  return (
    <defs>
      {items.map(({ id, color, from = 0.95, to = 0.55 }) => (
        <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={from} />
          <stop offset="100%" stopColor={color} stopOpacity={to} />
        </linearGradient>
      ))}
    </defs>
  )
}

export function ChartTooltip({ active, payload, label, currency = true }) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-[150px] rounded-xl border border-slate-200 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      {label != null && label !== '' ? (
        <p className="mb-1.5 font-semibold text-slate-900 dark:text-white">{label}</p>
      ) : null}
      <ul className="space-y-1">
        {payload.map((entry) => (
          <li key={entry.dataKey ?? entry.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.payload?.fill || entry.color || entry.fill }}
              />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
              {currency ? formatCurrency(entry.value) : Number(entry.value || 0).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Side legend for donut charts: colour dot, name, value and share. */
export function DonutLegend({ data, colors = DONUT_COLORS, valueFormatter = (v) => v }) {
  const total = data.reduce((sum, row) => sum + (Number(row.value) || 0), 0)
  return (
    <ul className="w-full space-y-2.5">
      {data.map((row, i) => {
        const share = total > 0 ? Math.round(((Number(row.value) || 0) / total) * 100) : 0
        return (
          <li key={row.name ?? i} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
              <span className="truncate text-slate-700 dark:text-slate-300" title={row.name}>
                {row.name}
              </span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{valueFormatter(row.value)}</span>
              <span className="w-9 text-right text-xs tabular-nums text-slate-400">{share}%</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
