const CURRENCY_PATTERN = /^(-?)\s*(LKR)\s*(.+)$/u

function splitCurrency(value) {
  if (typeof value !== 'string') return null
  const match = value.trim().match(CURRENCY_PATTERN)
  if (!match) return null
  return { currency: match[2], amount: `${match[1]}${match[3]}` }
}

const TONES = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400',
  blue: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
  red: 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400',
  gold: 'bg-gold-50 text-gold-700 dark:bg-gold-900/30 dark:text-gold-300',
  dark: 'bg-neutral-900 text-gold-400 dark:bg-neutral-800 dark:text-gold-300',
}

const ACCENTS = {
  brand: 'from-brand-500 to-brand-700',
  blue: 'from-sky-400 to-sky-600',
  green: 'from-emerald-400 to-emerald-600',
  red: 'from-red-400 to-red-600',
  slate: 'from-slate-300 to-slate-500',
  violet: 'from-violet-400 to-violet-600',
  gold: 'from-gold-300 to-gold-600',
  dark: 'from-neutral-700 to-neutral-900',
}

const ICON_ACCENTS = {
  brand: 'from-brand-500 to-brand-700 text-white shadow-brand-500/30',
  blue: 'from-sky-400 to-sky-600 text-white shadow-sky-500/30',
  green: 'from-emerald-400 to-emerald-600 text-white shadow-emerald-500/30',
  red: 'from-red-500 to-red-700 text-white shadow-red-500/30',
  slate: 'from-slate-400 to-slate-600 text-white shadow-slate-500/30',
  violet: 'from-violet-400 to-violet-600 text-white shadow-violet-500/30',
  gold: 'from-gold-400 to-gold-600 text-white shadow-gold-500/30',
  dark: 'from-neutral-800 to-neutral-950 text-gold-400 shadow-neutral-900/30',
}

export default function StatCard({ title, value, icon: Icon, trend, tone = 'brand', loading = false, accent = false }) {
  const money = splitCurrency(value)
  const fullValue = typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
  const gradient = ACCENTS[tone] || ACCENTS.brand

  return (
    <div
      className={`card flex h-full min-h-[128px] flex-col justify-between p-4 ${
        accent
          ? 'group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg dark:hover:border-slate-700'
          : ''
      }`}
    >
      {accent ? (
        <>
          <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${gradient}`} aria-hidden />
          <span
            className={`pointer-events-none absolute -bottom-12 -right-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-[0.07] transition-opacity duration-200 group-hover:opacity-[0.14] ${gradient}`}
            aria-hidden
          />
        </>
      ) : null}
      <div className={accent ? 'relative' : undefined}>
        <div className="flex items-start justify-between gap-3">
          <p
            className={`min-w-0 flex-1 text-sm text-gray-500 dark:text-slate-400 ${
              accent ? 'font-semibold uppercase tracking-wide text-[11px]' : ''
            }`}
          >
            {title}
          </p>
          {Icon ? (
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                accent
                  ? `bg-gradient-to-br shadow-md transition-transform duration-200 group-hover:scale-105 ${ICON_ACCENTS[tone] || ICON_ACCENTS.brand}`
                  : TONES[tone] || TONES.brand
              }`}
            >
              <Icon size={18} aria-hidden />
            </div>
          ) : null}
        </div>
        {loading ? (
          <div className="mt-3 h-8 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" aria-hidden />
        ) : (
          <div className="mt-1" title={fullValue}>
            <p
              className={`text-xs font-medium text-gray-500 dark:text-slate-400 ${money ? '' : 'invisible'}`}
              aria-hidden={money ? undefined : true}
            >
              {money ? money.currency : 'LKR'}
            </p>
            <p className="break-words font-display text-lg font-bold leading-tight tabular-nums text-slate-900 dark:text-white 2xl:text-2xl">
              {money ? money.amount : value}
            </p>
          </div>
        )}
      </div>
      {trend && !loading ? (
        accent ? (
          <p className="relative mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r ${gradient}`} aria-hidden />
            <span className="min-w-0 truncate" title={trend}>{trend}</span>
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">{trend}</p>
        )
      ) : (
        <p className={`invisible text-xs ${accent ? 'mt-3 border-t pt-2' : 'mt-2'}`} aria-hidden>&nbsp;</p>
      )}
    </div>
  )
}
