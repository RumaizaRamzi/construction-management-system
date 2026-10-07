import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  CalendarClock,
  ClipboardCheck,
  KeyRound,
  Package,
  PieChart as PieChartIcon,
  Plus,
  Receipt,
  RotateCcw,
  ShoppingCart,
  TrendingUp,
  Undo2,
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import LoadingState from '../../components/ui/LoadingState'
import StatCard from '../../components/ui/StatCard'
import ChartCard from '../../components/ui/ChartCard'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/ui/DataTable'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import {
  DashboardAlertWidgets,
  NotificationCard,
} from '../../components/notifications'
import { FinancialOverviewSection } from '../../components/financial'
import {
  AXIS_PROPS,
  BRAND,
  CURSOR,
  DONUT_COLORS,
  GRID_PROPS,
  LEGEND_PROPS,
  compactNumber,
} from '../../components/dashboard/chartTheme'
import { ChartTooltip, DonutLegend, GradientDefs } from '../../components/dashboard/ChartParts'
import { useApp } from '../../contexts/AppContext'
import useReportQuery from '../../hooks/useReportQuery'
import reportService from '../../services/reportService'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { getDashboardAlertWidgets } from '../../utils/notificationHelpers'
import { resolveReportDateRange } from '../../utils/reportHelpers'

const MONEY_COLUMN = 'whitespace-nowrap tabular-nums text-right'

const SHRINK_CELL = 'max-w-0 w-1/3'

const truncatedCell = (value) => (
  <span className="block max-w-[180px] truncate" title={value ?? ''}>
    {value}
  </span>
)

const compactBadge = (status) => <StatusBadge status={status} className="!px-2" />

const greeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex gap-3">
        <span className="mt-1 w-1 shrink-0 self-stretch rounded-full bg-gradient-to-b from-brand-500 to-gold-400" aria-hidden />
        <div>
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-400">{eyebrow}</p>
          ) : null}
          <h2 className="mt-0.5 font-display text-lg font-semibold text-slate-900 dark:text-white sm:text-xl">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  )
}

function Panel({ title, icon: Icon, to, linkLabel = 'View all', count, children }) {
  return (
    <div className="card min-w-0 overflow-hidden transition-shadow duration-200 hover:shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-white px-5 py-4 dark:border-slate-800 dark:from-slate-800/40 dark:via-slate-900 dark:to-slate-900">
        <div className="flex min-w-0 items-center gap-3">
          {Icon ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-500/30">
              <Icon size={17} aria-hidden />
            </div>
          ) : null}
          <h3 className="truncate font-display font-semibold text-slate-900 dark:text-white">{title}</h3>
          {count != null ? (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-100 dark:bg-brand-950/50 dark:text-brand-300 dark:ring-brand-900">
              {count}
            </span>
          ) : null}
        </div>
        {to ? (
          <Link
            to={to}
            className="group/link inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:text-brand-400 dark:hover:bg-brand-950/40"
          >
            {linkLabel}
            <ArrowRight size={14} className="transition-transform group-hover/link:translate-x-0.5" aria-hidden />
          </Link>
        ) : null}
      </div>
      {children}
    </div>
  )
}

export default function Dashboard() {
  const {
    user,
    stats: contextStats,
    sales,
    rentals,
    checks,
    products,
    maintenance,
    notifications,
    markNotificationRead,
    income,
    expenses,
    incomePayments,
    expensePayments,
    can,
  } = useApp()
  const canIncome = can('income.view')
  const canExpenses = can('expenses.view')
  const restrictedMoney = (value, allowed) => (allowed ? formatCurrency(value) : 'Restricted')

  const yearRange = resolveReportDateRange('this_year')
  const fetchDashboard = useCallback(
    (params) =>
      reportService.getDashboardReport({
        from: params?.from || yearRange.from,
        to: params?.to || yearRange.to,
      }),
    [yearRange.from, yearRange.to]
  )
  const { data: dashboard, loading, error, reload } = useReportQuery(fetchDashboard, {
    from: yearRange.from,
    to: yearRange.to,
  })

  const stats = useMemo(() => {
    if (!dashboard?.summary) return contextStats
    const s = dashboard.summary
    return {
      ...contextStats,
      totalProducts: s.totalProducts,
      inventoryValue: s.inventoryValue,
      totalSales: s.totalSales,
      rentalIncome: s.rentalIncome,
      totalExpenses: s.totalExpenses,
      totalIncome: s.totalIncome,
      netIncome: s.netIncome,
      activeRentals: s.activeRentals,
      pendingBookings: s.pendingBookings,
      lowStock: (dashboard.lowStock || []).map((p) => ({
        id: p.id,
        name: p.name,
        available: p.available,
        minStock: p.minimum_stock ?? p.minimumStock,
      })),
      upcomingChecks: contextStats.upcomingChecks || [],
    }
  }, [dashboard, contextStats])

  const chartData = dashboard?.chartData || {
    salesVsRental: [],
    monthlyRevenue: [],
    incomeVsExpenses: [],
    productUsage: [],
    rentalActivity: [],
  }
  const hasValues = (rows, keys) =>
    Array.isArray(rows) && rows.some((row) => keys.some((key) => Number(row?.[key]) > 0))
  const chartEmptyLabel = error ? 'Chart data could not be loaded.' : undefined

  const productUsage = chartData.productUsage || []
  const productUsageTotal = productUsage.reduce((sum, row) => sum + (Number(row.value) || 0), 0)

  const recentSales = (dashboard?.recentSales || sales.slice(0, 5))
    .map((s) => ({
      ...s,
      invoiceNumber: s.invoice_number || s.invoiceNumber,
      paymentStatus: s.payment_status || s.paymentStatus,
      date: s.sale_date || s.date,
      total: s.total ?? s.total_amount,
    }))
    .slice(0, 5)

  const recentRentals = (dashboard?.recentRentals || rentals.slice(0, 5))
    .map((r) => ({
      ...r,
      rentalId: r.rental_number || r.rentalId || r.rentalNumber,
      rentalStatus: r.rental_status || r.rentalStatus || r.status,
      total: r.total ?? r.total_amount,
    }))
    .slice(0, 5)

  const upcomingReturns = rentals
    .filter((r) => ['Active', 'Confirmed', 'Overdue'].includes(r.rentalStatus))
    .slice(0, 5)

  const alertWidgets = getDashboardAlertWidgets({
    checks,
    rentals,
    products,
    maintenance,
  })

  const quickActions = [
    can('sales.create') && { to: '/sales/new', label: 'New Sale', icon: Plus, primary: true },
    can('rentals.create') && { to: '/rentals/new', label: 'New Rental', icon: KeyRound },
    can('reports.view') && { to: '/reports', label: 'Reports', icon: BarChart3 },
  ].filter(Boolean)

  if (loading && !dashboard) {
    return <LoadingState label="Loading dashboard..." />
  }

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const heroPills = [
    { label: 'Active rentals', value: stats.activeRentals ?? 0, dot: 'bg-brand-400' },
    { label: 'Pending bookings', value: stats.pendingBookings ?? 0, dot: 'bg-gold-400' },
    { label: 'Low stock', value: stats.lowStock?.length || 0, dot: (stats.lowStock?.length || 0) > 0 ? 'bg-red-400 animate-pulse' : 'bg-emerald-400' },
  ]

  return (
    <div className="page-shell space-y-8">
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: 'Dashboard' }]} />

        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-950 via-neutral-900 to-brand-900 px-5 py-6 text-white shadow-lg sm:px-8 sm:py-8">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '18px 18px' }}
            aria-hidden
          />
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-56 w-56 rounded-full bg-gold-400/10 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-28 right-24 h-64 w-64 rounded-full border-[14px] border-gold-400/15" aria-hidden />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-brand-500 via-gold-400 to-brand-500" aria-hidden />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-300 ring-1 ring-inset ring-white/15">
                <CalendarClock size={12} aria-hidden />
                {today}
              </span>
              <h1 className="mt-3 font-display text-2xl font-bold leading-tight sm:text-3xl">
                {greeting()}
                {user?.name ? (
                  <>
                    ,{' '}
                    <span className="bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-transparent">
                      {user.name.split(' ')[0]}
                    </span>
                  </>
                ) : null}
              </h1>
              <p className="mt-1.5 text-sm text-neutral-300">Overview of inventory, sales, rentals, and operations</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {heroPills.map(({ label, value, dot }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-neutral-300 ring-1 ring-inset ring-white/10 backdrop-blur-sm"
                  >
                    <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
                    <span className="font-display text-sm font-bold tabular-nums text-white">{value}</span>
                    {label}
                  </span>
                ))}
              </div>
            </div>
            {quickActions.length ? (
              <div className="flex flex-wrap gap-2">
                {quickActions.map(({ to, label, icon: Icon, primary }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 ${
                      primary
                        ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-900/40 hover:from-brand-400 hover:to-brand-600'
                        : 'bg-white/10 text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm hover:bg-white/20'
                    }`}
                  >
                    <Icon size={16} aria-hidden />
                    {label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <span>{error} Showing available cached data where possible.</span>
          <button type="button" className="btn-secondary text-xs" onClick={() => reload().catch(() => {})}>
            Retry
          </button>
        </div>
      ) : null}

      <section className="space-y-4">
        <SectionHeading eyebrow="Performance" title="Business Overview" description="Key figures for the current year." />
        <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard accent title="Total Sales" value={formatCurrency(stats.totalSales)} icon={ShoppingCart} tone="brand" trend="Recorded invoices" />
          <StatCard accent title="Rental Income" value={formatCurrency(stats.rentalIncome)} icon={KeyRound} tone="gold" trend="Excludes cancelled rentals" />
          <StatCard accent title="Inventory Value" value={formatCurrency(stats.inventoryValue)} icon={Boxes} tone="dark" trend="Purchase cost basis" />
          <StatCard accent title="Total Expenses" value={restrictedMoney(stats.totalExpenses, canExpenses)} icon={Wallet} tone="red" trend="Operating costs" />
          <StatCard accent title="Net Income" value={restrictedMoney(stats.netIncome, canIncome && canExpenses)} icon={TrendingUp} tone="green" trend="Income minus expenses" />
        </div>
        <div className="grid grid-cols-2 items-stretch gap-4 md:grid-cols-3 xl:grid-cols-5">
          <StatCard accent title="Total Products" value={stats.totalProducts} icon={Package} tone="dark" trend="Active catalog items" />
          <StatCard accent title="Active Rentals" value={stats.activeRentals} icon={KeyRound} tone="brand" trend="Currently out" />
          <StatCard accent title="Pending Bookings" value={stats.pendingBookings} icon={CalendarClock} tone="gold" trend="Awaiting confirmation" />
          <StatCard accent title="Low Stock Products" value={stats.lowStock?.length || 0} icon={AlertTriangle} tone="red" trend="Below minimum stock" />
          <StatCard
            accent
            title="Upcoming Checks"
            value={stats.upcomingChecks?.length ?? dashboard?.summary?.upcomingChecksCount ?? 0}
            icon={ClipboardCheck}
            tone="slate"
            trend="Scheduled inspections"
          />
        </div>
      </section>

      {(canIncome || canExpenses) && (
        <FinancialOverviewSection
          income={income}
          expenses={expenses}
          incomePayments={incomePayments}
          expensePayments={expensePayments}
        />
      )}

      <section className="space-y-4">
        <SectionHeading eyebrow="Analytics" title="Sales & Rental Insights" description="Trends across sales, rentals and equipment usage this year." />
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard
            accent
            title="Sales vs Rental Income"
            subtitle="This year"
            icon={BarChart3}
            empty={!hasValues(chartData.salesVsRental, ['sales', 'rental'])}
            emptyLabel={chartEmptyLabel}
            bodyClassName="h-64 sm:h-72"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.salesVsRental || []} barGap={4} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <GradientDefs
                  items={[
                    { id: 'dash-sales', color: BRAND.red },
                    { id: 'dash-rental', color: BRAND.gold },
                  ]}
                />
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="month" {...AXIS_PROPS} />
                <YAxis {...AXIS_PROPS} tickFormatter={compactNumber} width={48} />
                <Tooltip content={<ChartTooltip />} cursor={CURSOR} />
                <Legend {...LEGEND_PROPS} />
                <Bar dataKey="sales" name="Sales" fill="url(#dash-sales)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="rental" name="Rental" fill="url(#dash-rental)" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            accent
            title="Monthly Revenue"
            subtitle="Combined sales & rentals"
            icon={TrendingUp}
            empty={!hasValues(chartData.monthlyRevenue, ['revenue'])}
            emptyLabel={chartEmptyLabel}
            bodyClassName="h-64 sm:h-72"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.monthlyRevenue || []} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <GradientDefs items={[{ id: 'dash-rev', color: BRAND.red, from: 0.35, to: 0 }]} />
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="month" {...AXIS_PROPS} />
                <YAxis {...AXIS_PROPS} tickFormatter={compactNumber} width={48} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: BRAND.red, strokeOpacity: 0.25 }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke={BRAND.red}
                  fill="url(#dash-rev)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: BRAND.red, stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            accent
            title="Income vs Expenses"
            subtitle="Cashflow trend"
            icon={Activity}
            empty={!(canIncome && canExpenses) || !hasValues(chartData.incomeVsExpenses, ['income', 'expenses'])}
            emptyLabel={canIncome && canExpenses ? chartEmptyLabel : 'Requires income and expense permissions.'}
            bodyClassName="h-64 sm:h-72"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.incomeVsExpenses || []} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <GradientDefs
                  items={[
                    { id: 'dash-ie-income', color: BRAND.gold, from: 0.3, to: 0 },
                    { id: 'dash-ie-expenses', color: BRAND.red, from: 0.22, to: 0 },
                  ]}
                />
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="month" {...AXIS_PROPS} />
                <YAxis {...AXIS_PROPS} tickFormatter={compactNumber} width={48} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: BRAND.slate, strokeOpacity: 0.4, strokeDasharray: '4 4' }} />
                <Legend {...LEGEND_PROPS} />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="Income"
                  stroke={BRAND.gold}
                  fill="url(#dash-ie-income)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: BRAND.gold, stroke: '#fff', strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke={BRAND.red}
                  fill="url(#dash-ie-expenses)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: BRAND.red, stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            accent
            title="Product Usage"
            subtitle="Rental frequency"
            icon={PieChartIcon}
            empty={!hasValues(productUsage, ['value'])}
            emptyLabel={chartEmptyLabel}
            bodyClassName="h-auto sm:h-72"
          >
            <div className="flex h-full flex-col items-center gap-4 sm:flex-row">
              <div className="relative h-52 w-full sm:h-full sm:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={productUsage}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="62%"
                      outerRadius="92%"
                      paddingAngle={2}
                      stroke="none"
                    >
                      {productUsage.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip currency={false} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{productUsageTotal}</span>
                  <span className="text-xs text-slate-500">Rentals</span>
                </div>
              </div>
              <div className="w-full overflow-y-auto sm:max-h-full sm:w-1/2">
                <DonutLegend data={productUsage} />
              </div>
            </div>
          </ChartCard>
        </div>

        <ChartCard
          accent
          title="Rental Activity"
          subtitle="Active rentals vs returns this week"
          icon={RotateCcw}
          empty={!hasValues(chartData.rentalActivity, ['active', 'returns'])}
          emptyLabel={chartEmptyLabel}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData.rentalActivity || []} barGap={4} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <GradientDefs
                items={[
                  { id: 'dash-active', color: BRAND.charcoal },
                  { id: 'dash-returns', color: BRAND.gold },
                ]}
              />
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="day" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} allowDecimals={false} width={40} />
              <Tooltip content={<ChartTooltip currency={false} />} cursor={CURSOR} />
              <Legend {...LEGEND_PROPS} />
              <Bar dataKey="active" name="Active" fill="url(#dash-active)" radius={[6, 6, 0, 0]} maxBarSize={32} />
              <Bar dataKey="returns" name="Returns" fill="url(#dash-returns)" radius={[6, 6, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="space-y-4">
        <SectionHeading eyebrow="Activity" title="Recent Activity" description="Latest transactions, returns and stock levels." />
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          <Panel title="Recent Sales" icon={Receipt} to="/sales">
            <DataTable
              compact
              columns={[
                { key: 'invoiceNumber', label: 'Invoice' },
                { key: 'customer', label: 'Customer', cellClassName: SHRINK_CELL, render: (r) => truncatedCell(r.customer) },
                { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
                { key: 'total', label: 'Total', className: MONEY_COLUMN, render: (r) => formatCurrency(r.total) },
                {
                  key: 'paymentStatus',
                  label: 'Status',
                  render: (r) => compactBadge(r.paymentStatus),
                },
              ]}
              data={recentSales}
            />
          </Panel>

          <Panel title="Recent Rentals" icon={KeyRound} to="/rentals">
            <DataTable
              compact
              columns={[
                { key: 'rentalId', label: 'Rental', cellClassName: SHRINK_CELL, render: (r) => truncatedCell(r.rentalId) },
                { key: 'customer', label: 'Customer', cellClassName: SHRINK_CELL, render: (r) => truncatedCell(r.customer) },
                { key: 'product', label: 'Product', cellClassName: SHRINK_CELL, render: (r) => truncatedCell(r.product) },
                { key: 'total', label: 'Total', className: MONEY_COLUMN, render: (r) => formatCurrency(r.total) },
                {
                  key: 'rentalStatus',
                  label: 'Status',
                  render: (r) => compactBadge(r.rentalStatus),
                },
              ]}
              data={recentRentals}
            />
          </Panel>

          <Panel title="Upcoming Returns" icon={Undo2} to="/returns" linkLabel="Manage" count={upcomingReturns.length}>
            <DataTable
              compact
              columns={[
                { key: 'rentalId', label: 'Rental', cellClassName: SHRINK_CELL, render: (r) => truncatedCell(r.rentalId) },
                { key: 'product', label: 'Product', cellClassName: SHRINK_CELL, render: (r) => truncatedCell(r.product) },
                { key: 'expectedReturn', label: 'Due', render: (r) => formatDate(r.expectedReturn) },
                {
                  key: 'rentalStatus',
                  label: 'Status',
                  render: (r) => compactBadge(r.rentalStatus),
                },
              ]}
              data={upcomingReturns}
            />
          </Panel>

          <Panel title="Low Stock Alerts" icon={AlertTriangle} to="/products" linkLabel="Inventory" count={stats.lowStock?.length || 0}>
            <DataTable
              compact
              columns={[
                { key: 'name', label: 'Product', cellClassName: SHRINK_CELL, render: (r) => truncatedCell(r.name) },
                { key: 'available', label: 'Available' },
                { key: 'minStock', label: 'Min' },
                { key: 'status', label: 'Status', render: () => compactBadge('Urgent') },
              ]}
              data={stats.lowStock || []}
              emptyTitle="Stock levels look healthy"
              emptyDescription="No products are below minimum stock."
            />
          </Panel>
        </div>

        <Panel title="Recent Notifications" icon={Bell} to="/notifications" linkLabel="Open center">
          <div className="grid gap-3 p-5 md:grid-cols-2">
            {notifications.slice(0, 4).map((n) => (
              <NotificationCard
                key={n.id}
                notification={n}
                compact
                showActions={false}
                onMarkRead={() => markNotificationRead(n.id)}
              />
            ))}
            {notifications.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-center md:col-span-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-50 text-gold-600 ring-4 ring-gold-50/60 dark:bg-gold-900/30 dark:text-gold-300 dark:ring-gold-900/20">
                  <Bell size={18} aria-hidden />
                </span>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">You&apos;re all caught up</p>
                <p className="text-xs text-slate-500">No notifications right now.</p>
              </div>
            )}
          </div>
        </Panel>
      </section>

      <DashboardAlertWidgets
        widgets={alertWidgets}
        notifications={notifications}
        onMarkRead={(n) => markNotificationRead(n.id)}
      />
    </div>
  )
}
