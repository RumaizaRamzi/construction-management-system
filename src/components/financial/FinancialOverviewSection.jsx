import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  CircleDollarSign,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Scale,
  Wallet,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import StatCard from '../ui/StatCard'
import ChartCard from '../ui/ChartCard'
import { formatCurrency } from '../../utils/helpers'
import { AXIS_PROPS, BRAND, CURSOR, GRID_PROPS, LEGEND_PROPS, compactNumber } from '../dashboard/chartTheme'
import { ChartTooltip, GradientDefs } from '../dashboard/ChartParts'
import {
  getFinancialOverview,
  getIncomeBySourceBreakdown,
  getMonthlyFinancialSeries,
} from '../../utils/financialHelpers'

const SOURCE_COLORS = {
  Sales: BRAND.red,
  Rentals: BRAND.gold,
  Bookings: BRAND.charcoal,
  Other: '#64748b',
}

const MONTH_AXIS = {
  ...AXIS_PROPS,
  tick: { fontSize: 11, fill: '#64748b' },
  interval: 0,
  tickFormatter: (m) => String(m).slice(0, 3),
}

const CURRENT_MONTH = new Date().toLocaleString('en-US', { month: 'long' })
const CURRENT_YEAR = new Date().getFullYear()

function LegendChip({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function MiniStat({ label, value, tone = 'text-slate-900 dark:text-white', dot }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/50">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {dot ? <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} /> : null}
        {label}
      </p>
      <p className={`mt-0.5 truncate font-display text-sm font-bold tabular-nums sm:text-base ${tone}`} title={value}>
        {value}
      </p>
    </div>
  )
}

function TooltipShell({ label, children }) {
  return (
    <div className="min-w-[200px] overflow-hidden rounded-xl border border-slate-200 bg-white/95 text-xs shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <div className="border-b border-slate-100 bg-gradient-to-r from-neutral-900 to-brand-900 px-3 py-2 font-semibold text-white dark:border-slate-800">
        {label} {CURRENT_YEAR}
      </div>
      <div className="space-y-1.5 px-3 py-2.5">{children}</div>
    </div>
  )
}

function TooltipRow({ color, label, value, strong = false }) {
  return (
    <p className={`flex items-center justify-between gap-4 ${strong ? 'border-t border-slate-100 pt-1.5 dark:border-slate-800' : ''}`}>
      <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
        {color ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> : null}
        {label}
      </span>
      <span className={`tabular-nums ${strong ? 'font-bold' : 'font-semibold'} text-slate-900 dark:text-white`}>{value}</span>
    </p>
  )
}

function IncomeExpenseTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}
  const diff = (Number(row.income) || 0) - (Number(row.expenses) || 0)
  return (
    <TooltipShell label={label}>
      <TooltipRow color={BRAND.gold} label="Income" value={formatCurrency(row.income)} />
      <TooltipRow color={BRAND.red} label="Expenses" value={formatCurrency(row.expenses)} />
      <TooltipRow label={diff >= 0 ? 'Surplus' : 'Deficit'} value={formatCurrency(diff)} strong />
    </TooltipShell>
  )
}

function NetCashFlowTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}
  return (
    <TooltipShell label={label}>
      <TooltipRow color={BRAND.gold} label="Paid income" value={formatCurrency(row.paidIncome)} />
      <TooltipRow color={BRAND.red} label="Paid expenses" value={formatCurrency(row.paidExpenses)} />
      <TooltipRow
        color={Number(row.netCashFlow) < 0 ? BRAND.red : BRAND.gold}
        label="Net cash flow"
        value={formatCurrency(row.netCashFlow)}
        strong
      />
    </TooltipShell>
  )
}

export default function FinancialOverviewSection({
  income = [],
  expenses = [],
  incomePayments = [],
  expensePayments = [],
}) {
  const overview = useMemo(
    () => getFinancialOverview(income, expenses, incomePayments, expensePayments),
    [income, expenses, incomePayments, expensePayments]
  )

  const monthlySeries = useMemo(
    () =>
      getMonthlyFinancialSeries(income, expenses, incomePayments, expensePayments, { year: new Date().getFullYear() }),
    [income, expenses, incomePayments, expensePayments]
  )

  const incomeBySource = useMemo(() => getIncomeBySourceBreakdown(income), [income])

  const yearTotals = useMemo(() => {
    const sum = (key) => monthlySeries.reduce((total, row) => total + (Number(row[key]) || 0), 0)
    const values = monthlySeries.map((row) => Number(row.netCashFlow) || 0)
    const max = Math.max(0, ...values)
    const min = Math.min(0, ...values)
    return {
      income: sum('income'),
      expenses: sum('expenses'),
      paidIncome: sum('paidIncome'),
      paidExpenses: sum('paidExpenses'),
      net: sum('netCashFlow'),
      hasNegative: min < 0,
      zeroOffset: max === min ? 1 : max / (max - min),
    }
  }, [monthlySeries])
  const accrualDiff = yearTotals.income - yearTotals.expenses

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-400">Finance</p>
          <h2 className="mt-0.5 font-display text-lg font-semibold text-slate-900 dark:text-white sm:text-xl">
            Financial Overview
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Monitor income, expenses and outstanding payments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/income" className="btn-secondary text-xs">
            Income
          </Link>
          <Link to="/expenses" className="btn-secondary text-xs">
            Expenses
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard accent title="Total Income" value={formatCurrency(overview.totalIncome)} icon={ArrowUpRight} tone="green" />
        <StatCard accent title="Total Expenses" value={formatCurrency(overview.totalExpenses)} icon={ArrowDownRight} tone="red" />
        <StatCard
          accent
          title="Net Cash Flow"
          value={formatCurrency(overview.netCashFlow)}
          icon={Scale}
          tone={overview.netCashFlow >= 0 ? 'dark' : 'red'}
          trend="Paid income − paid expenses"
        />
        <StatCard accent title="Outstanding Income" value={formatCurrency(overview.outstandingIncome)} icon={CircleDollarSign} tone="gold" />
        <StatCard accent title="Outstanding Expenses" value={formatCurrency(overview.outstandingExpenses)} icon={Wallet} tone="slate" />
        <StatCard
          accent
          title="This Month"
          value={formatCurrency(overview.thisMonth)}
          icon={CalendarRange}
          tone="brand"
          trend="Paid income − paid expenses (current month)"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          accent
          title="Income vs Expenses"
          subtitle={`Monthly totals (LKR) · ${CURRENT_YEAR}`}
          icon={BarChart3}
          bodyClassName="h-auto"
          action={
            <div className="flex flex-wrap gap-1.5">
              <LegendChip color={BRAND.gold} label="Income" />
              <LegendChip color={BRAND.red} label="Expenses" />
            </div>
          }
        >
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Income" value={formatCurrency(yearTotals.income)} dot={BRAND.gold} />
            <MiniStat label="Expenses" value={formatCurrency(yearTotals.expenses)} dot={BRAND.red} />
            <MiniStat
              label={accrualDiff >= 0 ? 'Surplus' : 'Deficit'}
              value={formatCurrency(accrualDiff)}
              tone={accrualDiff >= 0 ? 'text-gold-700 dark:text-gold-300' : 'text-brand-600 dark:text-brand-400'}
            />
          </div>
          <div className="mt-4 h-60 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySeries} barGap={3} barCategoryGap="22%" margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                <GradientDefs
                  items={[
                    { id: 'fin-income', color: BRAND.gold, from: 1, to: 0.65 },
                    { id: 'fin-expense', color: BRAND.red, from: 1, to: 0.65 },
                  ]}
                />
                <CartesianGrid {...GRID_PROPS} />
                <ReferenceArea x1={CURRENT_MONTH} x2={CURRENT_MONTH} fill={BRAND.gold} fillOpacity={0.08} ifOverflow="extendDomain" />
                <XAxis dataKey="month" {...MONTH_AXIS} />
                <YAxis {...AXIS_PROPS} tickFormatter={compactNumber} width={48} />
                <Tooltip content={<IncomeExpenseTooltip />} cursor={CURSOR} />
                <Bar dataKey="income" name="Income" fill="url(#fin-income)" radius={[6, 6, 0, 0]} maxBarSize={16} />
                <Bar dataKey="expenses" name="Expenses" fill="url(#fin-expense)" radius={[6, 6, 0, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          accent
          title="Net Cash Flow"
          subtitle="Paid income − paid expenses by month"
          icon={LineChartIcon}
          bodyClassName="h-auto"
          action={
            <div className="flex flex-wrap gap-1.5">
              <LegendChip color={BRAND.gold} label="Positive" />
              <LegendChip color={BRAND.red} label="Negative" />
            </div>
          }
        >
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Paid in" value={formatCurrency(yearTotals.paidIncome)} dot={BRAND.gold} />
            <MiniStat label="Paid out" value={formatCurrency(yearTotals.paidExpenses)} dot={BRAND.red} />
            <MiniStat
              label="Net"
              value={formatCurrency(yearTotals.net)}
              tone={yearTotals.net >= 0 ? 'text-gold-700 dark:text-gold-300' : 'text-brand-600 dark:text-brand-400'}
            />
          </div>
          <div className="mt-4 h-60 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySeries} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="fin-net-stroke" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={yearTotals.zeroOffset} stopColor={BRAND.gold} />
                    <stop offset={yearTotals.zeroOffset} stopColor={BRAND.red} />
                  </linearGradient>
                  <linearGradient id="fin-net-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={BRAND.gold} stopOpacity={0.35} />
                    <stop offset={yearTotals.zeroOffset} stopColor={BRAND.gold} stopOpacity={0.04} />
                    <stop offset={yearTotals.zeroOffset} stopColor={BRAND.red} stopOpacity={0.04} />
                    <stop offset="1" stopColor={BRAND.red} stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GRID_PROPS} />
                <ReferenceLine x={CURRENT_MONTH} stroke={BRAND.gold} strokeOpacity={0.6} strokeDasharray="3 3" />
                <XAxis dataKey="month" {...MONTH_AXIS} />
                <YAxis {...AXIS_PROPS} tickFormatter={compactNumber} width={48} />
                <ReferenceLine y={0} stroke={BRAND.charcoal} strokeOpacity={0.35} strokeDasharray="4 4" />
                <Tooltip content={<NetCashFlowTooltip />} cursor={{ stroke: BRAND.charcoal, strokeOpacity: 0.2 }} />
                <Area
                  type="monotone"
                  dataKey="netCashFlow"
                  name="Net Cash Flow"
                  stroke={yearTotals.hasNegative ? 'url(#fin-net-stroke)' : BRAND.gold}
                  fill="url(#fin-net-fill)"
                  strokeWidth={2.75}
                  dot={false}
                  activeDot={{ r: 5, fill: BRAND.charcoal, stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          accent
          title="Income by Source"
          subtitle="Distribution across income sources"
          icon={PieChartIcon}
          empty={incomeBySource.length === 0}
          emptyLabel="No income records available."
          bodyClassName="h-64 sm:h-72"
        >
          <div className="relative h-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={incomeBySource}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="60%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {incomeBySource.map((row) => (
                    <Cell key={row.source} fill={SOURCE_COLORS[row.source] || '#64748b'} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend {...LEGEND_PROPS} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-x-0 top-0 bottom-8 flex flex-col items-center justify-center">
              <span className="text-xs text-slate-500">Total</span>
              <span className="font-display text-base font-bold tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(overview.totalIncome)}
              </span>
            </div>
          </div>
        </ChartCard>

        <div className="card p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
              <CircleDollarSign size={17} aria-hidden />
            </div>
            <div>
              <h3 className="font-display font-semibold text-slate-900 dark:text-white">Income by Source</h3>
              <p className="mt-0.5 text-sm text-slate-500">Source, amount and share of total income</p>
            </div>
          </div>
          {incomeBySource.length === 0 ? (
            <p className="text-sm text-slate-500">No income records available.</p>
          ) : (
            <ul className="space-y-4">
              {incomeBySource.map((row) => {
                const color = SOURCE_COLORS[row.source] || '#64748b'
                return (
                  <li key={row.source}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                        <span className="font-medium text-slate-800 dark:text-slate-200">{row.source}</span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{formatCurrency(row.amount)}</span>
                        <span className="ml-2 text-xs tabular-nums text-slate-500">{row.percentage}%</span>
                      </div>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, Number(row.percentage) || 0)}%`, backgroundColor: color }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
