import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileBarChart2 } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import LoadingState from '../../components/ui/LoadingState'
import {
  ReportDateFilter,
  ReportSummaryCards,
  ReportCategoryCard,
  QuickReportPreview,
} from '../../components/reports'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import useReportQuery from '../../hooks/useReportQuery'
import reportService from '../../services/reportService'
import {
  REPORT_CATEGORIES,
  resolveReportDateRange,
} from '../../utils/reportHelpers'

export default function Reports() {
  const navigate = useNavigate()
  const { success } = useToast()
  const { can } = useApp()
  const canViewFinancials = can('income.view') || can('expenses.view')
  const categories = REPORT_CATEGORIES.filter(
    (c) => (c.id !== 'financial' || canViewFinancials) && (c.id !== 'cheques' || can('cheques.view'))
  )

  const initialRange = resolveReportDateRange('this_month')
  const [preset, setPreset] = useState('this_month')
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)
  const [activeCategory, setActiveCategory] = useState(null)

  const fetchSummary = useCallback((params) => reportService.getReportSummary(params), [])
  const { data: apiOverview, loading, error, reload } = useReportQuery(fetchSummary, { from, to })

  const overview = useMemo(() => {
    const canIncome = can('income.view')
    const canExpenses = can('expenses.view')
    const summary = {
      totalSales: apiOverview?.totalSales || 0,
      totalRentalIncome: apiOverview?.rentalIncome || 0,
      rentalIncome: apiOverview?.rentalIncome || 0,
      totalIncome: canIncome ? apiOverview?.totalIncome || 0 : null,
      totalExpenses: canExpenses ? apiOverview?.totalExpenses || 0 : null,
      netCashFlow: canIncome && canExpenses ? apiOverview?.netCashFlow || 0 : null,
      totalTransactions: apiOverview?.totalTransactions || 0,
      outstandingPayments: canIncome && canExpenses ? apiOverview?.outstandingPayments || 0 : null,
      outstandingIncome: canIncome ? Number(apiOverview?.summary?.outstanding_income || 0) : null,
      outstandingExpenses: canExpenses ? Number(apiOverview?.summary?.outstanding_expenses || 0) : null,
    }
    return {
      summary,
      preview: {
        sales: {
          count: Number(apiOverview?.preview?.sales_count || 0),
          amount: summary.totalSales,
        },
        rentals: {
          count: Number(apiOverview?.preview?.rentals_count || 0),
          income: summary.totalRentalIncome,
        },
        inventory: {
          totalProducts: Number(apiOverview?.summary?.total_products || 0),
          availableProducts: Number(apiOverview?.preview?.available_quantity || 0),
          rentedProducts: Number(apiOverview?.preview?.rented_quantity || 0),
          lowStockProducts: Number(apiOverview?.summary?.low_stock_count || 0),
        },
        financial: {
          totalIncome: summary.totalIncome,
          totalExpenses: summary.totalExpenses,
          netCashFlow: summary.netCashFlow,
          outstandingIncome: summary.outstandingIncome,
          outstandingExpenses: summary.outstandingExpenses,
        },
        recentActivity: apiOverview?.recentActivity || [],
        outstanding: apiOverview?.outstanding || [],
      },
    }
  }, [apiOverview, can])

  const handleViewCategory = (category) => {
    const routes = {
      sales: '/reports/sales',
      rentals: '/reports/rentals',
      inventory: '/reports/inventory',
      equipment: '/reports/equipment',
      financial: '/reports/financial',
      customers: '/reports/customers',
      cheques: '/reports/cheques',
    }
    if (routes[category.id]) {
      navigate(routes[category.id])
      return
    }
    setActiveCategory(category.id)
    document.getElementById(`report-category-${category.id}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
    success(`${category.title} — ${category.reports.length} reports ready for preview.`)
  }

  if (loading && !apiOverview) {
    return <LoadingState label="Loading reports..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumbs items={[{ label: 'Reports' }]} />
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            View, analyze and monitor construction business activities and financial performance.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
          <FileBarChart2 size={16} className="text-brand-600" />
          {categories.length} report categories
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" className="btn-secondary text-xs" onClick={() => reload().catch(() => {})}>
            Retry
          </button>
        </div>
      )}

      <ReportDateFilter
        preset={preset}
        onPresetChange={setPreset}
        from={from}
        to={to}
        onRangeChange={(nextFrom, nextTo) => {
          setFrom(nextFrom)
          setTo(nextTo)
        }}
      />

      <ReportSummaryCards summary={overview.summary} />

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            Report Categories
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Select a category to review available business and financial reports.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <ReportCategoryCard
              key={category.id}
              category={category}
              active={activeCategory === category.id}
              onView={handleViewCategory}
            />
          ))}
        </div>
      </section>

      <QuickReportPreview preview={overview.preview} />

      {activeCategory && (
        <section className="card p-5">
          <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-2">
            {REPORT_CATEGORIES.find((c) => c.id === activeCategory)?.title}
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Open the full report page for this category to view tables and charts from live MySQL data.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {REPORT_CATEGORIES.find((c) => c.id === activeCategory)?.reports.map((name) => (
              <li
                key={name}
                className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
              >
                {name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
