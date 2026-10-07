import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  Eye,
  Printer,
  Scale,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import LoadingState from '../../components/ui/LoadingState'
import SearchBar from '../../components/ui/SearchBar'
import FilterDropdown from '../../components/ui/FilterDropdown'
import Pagination from '../../components/ui/Pagination'
import StatCard from '../../components/ui/StatCard'
import ChartCard from '../../components/ui/ChartCard'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import { ReportDateFilter, ReportExportButtons } from '../../components/reports'
import useReportQuery from '../../hooks/useReportQuery'
import reportService from '../../services/reportService'
import { formatCurrency, formatDateDMY, paginate } from '../../utils/helpers'
import BrandLogo from '../../components/ui/BrandLogo'
import { resolveReportDateRange } from '../../utils/reportHelpers'
import {
  calculateExpensesByCategory,
  calculateIncomeBySource,
  calculateMonthlyCashFlow,
  calculateOutstandingExpenseReport,
  calculateOutstandingIncomeReport,
  calculatePaymentStatusSummary,
} from '../../utils/reportCalculations'
import { INCOME_SOURCES, INCOME_CATEGORIES } from '../../utils/incomeHelpers'
import { EXPENSE_CATEGORIES } from '../../utils/expenseHelpers'

const PAGE_SIZE = 8
const PIE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#64748b', '#06b6d4']

export default function FinancialReports() {
  const initialRange = resolveReportDateRange('this_month')
  const [preset, setPreset] = useState('this_month')
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)

  const [incomeSearch, setIncomeSearch] = useState('')
  const [incomeSource, setIncomeSource] = useState('')
  const [incomeCategory, setIncomeCategory] = useState('')
  const [incomeStatus, setIncomeStatus] = useState('')
  const [incomeSort, setIncomeSort] = useState('date')
  const [incomeDir, setIncomeDir] = useState('desc')
  const [incomePage, setIncomePage] = useState(1)

  const [expenseSearch, setExpenseSearch] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('')
  const [expenseStatus, setExpenseStatus] = useState('')
  const [expenseSort, setExpenseSort] = useState('date')
  const [expenseDir, setExpenseDir] = useState('desc')
  const [expensePage, setExpensePage] = useState(1)

  const fetchFinancial = useCallback((params) => reportService.getFinancialReport(params), [])
  const { data: apiReport, loading, error, reload } = useReportQuery(fetchFinancial, { from, to })

  const report = useMemo(() => {
    if (!apiReport) {
      return {
        totalIncome: 0,
        totalExpenses: 0,
        netCashFlow: 0,
        paidIncome: 0,
        outstandingIncome: 0,
        paidExpenses: 0,
        outstandingExpenses: 0,
        rangedIncome: [],
        rangedExpenses: [],
      }
    }
    return {
      totalIncome: apiReport.summary.totalIncome,
      totalExpenses: apiReport.summary.totalExpenses,
      netCashFlow: apiReport.summary.netCashFlow,
      paidIncome: apiReport.summary.paidIncome,
      outstandingIncome: apiReport.summary.outstandingIncome,
      paidExpenses: apiReport.summary.paidExpenses,
      outstandingExpenses: apiReport.summary.outstandingExpenses,
      rangedIncome: apiReport.incomeTransactions.map((row) => ({
        ...row,
        incomeId: row.income_number || row.reference,
        paymentStatus: row.payment_status || row.status,
        paidAmount: row.paid_amount,
        remainingAmount: row.balance,
      })),
      rangedExpenses: apiReport.expenseTransactions.map((row) => ({
        ...row,
        expenseId: row.expense_number || row.reference,
        paymentStatus: row.payment_status || row.status,
        paidAmount: row.paid_amount,
        remainingAmount: row.balance,
      })),
    }
  }, [apiReport])

  const monthly = apiReport?.monthlyCashFlow?.length
    ? apiReport.monthlyCashFlow
    : calculateMonthlyCashFlow(report.rangedIncome, report.rangedExpenses, { from, to })

  const incomeBySource = apiReport?.incomeBySource?.length
    ? apiReport.incomeBySource
    : calculateIncomeBySource(report.rangedIncome)
  const expensesByCategory = apiReport?.expensesByCategory?.length
    ? apiReport.expensesByCategory
    : calculateExpensesByCategory(report.rangedExpenses)
  const incomePaymentStatus = useMemo(
    () => calculatePaymentStatusSummary(report.rangedIncome),
    [report.rangedIncome]
  )
  const expensePaymentStatus = useMemo(
    () => calculatePaymentStatusSummary(report.rangedExpenses),
    [report.rangedExpenses]
  )
  const outstandingIncome = useMemo(
    () => calculateOutstandingIncomeReport(report.rangedIncome),
    [report.rangedIncome]
  )
  const outstandingExpenses = useMemo(
    () => calculateOutstandingExpenseReport(report.rangedExpenses),
    [report.rangedExpenses]
  )

  const filteredIncome = useMemo(() => {
    const q = incomeSearch.trim().toLowerCase()
    let rows = report.rangedIncome.filter((r) => {
      if (incomeSource && r.source !== incomeSource) return false
      if (incomeCategory && r.category !== incomeCategory) return false
      if (incomeStatus && r.paymentStatus !== incomeStatus) return false
      if (q) {
        const hay = `${r.incomeId} ${r.customer} ${r.reference} ${r.source} ${r.category}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    const dir = incomeDir === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      const av =
        incomeSort === 'amount'
          ? Number(a.amount) || 0
          : incomeSort === 'customer'
            ? a.customer || ''
            : a.date || ''
      const bv =
        incomeSort === 'amount'
          ? Number(b.amount) || 0
          : incomeSort === 'customer'
            ? b.customer || ''
            : b.date || ''
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    return rows
  }, [
    report.rangedIncome,
    incomeSearch,
    incomeSource,
    incomeCategory,
    incomeStatus,
    incomeSort,
    incomeDir,
  ])

  const filteredExpenses = useMemo(() => {
    const q = expenseSearch.trim().toLowerCase()
    let rows = report.rangedExpenses.filter((r) => {
      if (expenseCategory && r.category !== expenseCategory) return false
      if (expenseStatus && r.paymentStatus !== expenseStatus) return false
      if (q) {
        const hay = `${r.expenseId} ${r.supplier} ${r.reference} ${r.category}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    const dir = expenseDir === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      const av =
        expenseSort === 'amount'
          ? Number(a.amount) || 0
          : expenseSort === 'supplier'
            ? a.supplier || ''
            : a.date || ''
      const bv =
        expenseSort === 'amount'
          ? Number(b.amount) || 0
          : expenseSort === 'supplier'
            ? b.supplier || ''
            : b.date || ''
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    return rows
  }, [
    report.rangedExpenses,
    expenseSearch,
    expenseCategory,
    expenseStatus,
    expenseSort,
    expenseDir,
  ])

  const incomePaged = paginate(filteredIncome, incomePage, PAGE_SIZE)
  const expensePaged = paginate(filteredExpenses, expensePage, PAGE_SIZE)

  useEffect(() => {
    setIncomePage(1)
  }, [incomeSearch, incomeSource, incomeCategory, incomeStatus, incomeSort, incomeDir, from, to])

  useEffect(() => {
    setExpensePage(1)
  }, [expenseSearch, expenseCategory, expenseStatus, expenseSort, expenseDir, from, to])

  return (
    <div className="space-y-6">
      {loading && !apiReport ? (
        <LoadingState label="Loading financial report..." />
      ) : (
      <>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex flex-wrap items-center justify-between gap-3 no-print">
          <span>{error}</span>
          <button type="button" className="btn-secondary text-xs" onClick={() => reload().catch(() => {})}>
            Retry
          </button>
        </div>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between no-print">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Reports', to: '/reports' },
              { label: 'Financial Reports' },
            ]}
          />
          <h1 className="page-title">Financial Reports</h1>
          <p className="page-subtitle">
            Monitor income, expenses, payments and net cash flow.
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Report Period: {formatDateDMY(from)} – {formatDateDMY(to)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/reports" className="btn-secondary">
            <ArrowLeft size={16} />
            Reports
          </Link>
          <Link to="/income" className="btn-secondary">
            Income
          </Link>
          <Link to="/expenses" className="btn-secondary">
            Expenses
          </Link>
          <ReportExportButtons
            filename={`financial-report-${from}-to-${to}`}
            getSheets={() => [
              {
                name: 'Monthly Cash Flow',
                columns: [
                  { key: 'monthFull', label: 'Month', value: (r) => r.monthFull || r.month },
                  { key: 'income', label: 'Income', value: (r) => Number(r.income || 0) },
                  { key: 'expenses', label: 'Expenses', value: (r) => Number(r.expenses || 0) },
                  { key: 'netCashFlow', label: 'Net Cash Flow', value: (r) => Number(r.netCashFlow ?? r.net_cash_flow ?? 0) },
                ],
                rows: monthly,
              },
              {
                name: 'Income',
                columns: [
                  { key: 'incomeId', label: 'Reference' },
                  { key: 'date', label: 'Date' },
                  { key: 'source', label: 'Source' },
                  { key: 'category', label: 'Category' },
                  { key: 'customer', label: 'Customer' },
                  { key: 'amount', label: 'Amount', value: (r) => Number(r.amount || 0) },
                  { key: 'paidAmount', label: 'Paid', value: (r) => Number(r.paidAmount || 0) },
                  { key: 'remainingAmount', label: 'Balance', value: (r) => Number(r.remainingAmount || 0) },
                  { key: 'paymentStatus', label: 'Status' },
                  { key: 'payment_method', label: 'Payment Method' },
                ],
                rows: filteredIncome,
              },
              {
                name: 'Expenses',
                columns: [
                  { key: 'expenseId', label: 'Reference' },
                  { key: 'date', label: 'Date' },
                  { key: 'category', label: 'Category' },
                  { key: 'supplier', label: 'Supplier' },
                  { key: 'amount', label: 'Amount', value: (r) => Number(r.amount || 0) },
                  { key: 'paidAmount', label: 'Paid', value: (r) => Number(r.paidAmount || 0) },
                  { key: 'remainingAmount', label: 'Balance', value: (r) => Number(r.remainingAmount || 0) },
                  { key: 'paymentStatus', label: 'Status' },
                  { key: 'payment_method', label: 'Payment Method' },
                ],
                rows: filteredExpenses,
              },
            ]}
          />
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            <Printer size={16} />
            Print Report
          </button>
        </div>
      </div>

      <div className="print-only hidden mb-4">
        <BrandLogo className="mb-2 block h-16 w-16" />
        <h1 className="text-2xl font-bold">RN TRADING LANKA PVT. LTD</h1>
        <p className="text-sm">Construction Management System — Financial Reports</p>
        <p className="text-sm mt-1">
          Report Period: {formatDateDMY(from)} – {formatDateDMY(to)}
        </p>
        <p className="text-sm">Generated: {formatDateDMY(new Date().toISOString().slice(0, 10))}</p>
      </div>

      <div className="no-print">
        <ReportDateFilter
          preset={preset}
          onPresetChange={setPreset}
          from={from}
          to={to}
          onRangeChange={(a, b) => {
            setFrom(a)
            setTo(b)
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard title="Total Income" value={formatCurrency(report.totalIncome)} icon={ArrowUpRight} tone="green" />
        <StatCard title="Total Expenses" value={formatCurrency(report.totalExpenses)} icon={ArrowDownRight} tone="red" />
        <StatCard
          title="Net Cash Flow"
          value={formatCurrency(report.recordedNetCashFlow)}
          icon={Scale}
          tone={report.recordedNetCashFlow >= 0 ? 'blue' : 'red'}
          trend="Total income − total expenses"
        />
        <StatCard title="Paid Income" value={formatCurrency(report.paidIncome)} icon={Wallet} tone="green" />
        <StatCard title="Paid Expenses" value={formatCurrency(report.paidExpenses)} icon={Wallet} tone="violet" />
        <StatCard
          title="Outstanding Amount"
          value={formatCurrency(report.outstandingTotal)}
          icon={Wallet}
          tone="slate"
          trend={`Income ${formatCurrency(report.outstandingIncome)} · Expenses ${formatCurrency(report.outstandingExpenses)}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Income vs Expenses" subtitle="Monthly recorded totals">
          {monthly.every((m) => m.income === 0 && m.expenses === 0) ? (
            <EmptyState title="No financial records found for the selected period." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="netCashFlow" name="Net Cash Flow" stroke="#0ea5e9" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-display font-semibold">Monthly Cash Flow</h3>
          </div>
          {monthly.length === 0 ? (
            <EmptyState title="No financial records found for the selected period." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3">Income</th>
                    <th className="px-4 py-3">Expenses</th>
                    <th className="px-4 py-3">Net Cash Flow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {monthly.map((row) => (
                    <tr key={row.monthKey}>
                      <td className="px-4 py-3 font-medium">{row.monthFull}</td>
                      <td className="px-4 py-3">{formatCurrency(row.income)}</td>
                      <td className="px-4 py-3">{formatCurrency(row.expenses)}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(row.netCashFlow)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Income by Source</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card overflow-hidden md:col-span-1">
              {incomeBySource.length === 0 ? (
                <EmptyState title="No financial records found for the selected period." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                        <th className="px-3 py-2">Source</th>
                        <th className="px-3 py-2">Txns</th>
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2">Paid</th>
                        <th className="px-3 py-2">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {incomeBySource.map((row) => (
                        <tr key={row.source}>
                          <td className="px-3 py-2 font-medium">{row.source}</td>
                          <td className="px-3 py-2">{row.transactionCount}</td>
                          <td className="px-3 py-2">{formatCurrency(row.totalAmount)}</td>
                          <td className="px-3 py-2">{formatCurrency(row.paidAmount)}</td>
                          <td className="px-3 py-2">{formatCurrency(row.outstandingAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <ChartCard title="Income by Source" subtitle="Share of income">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={incomeBySource} dataKey="value" nameKey="name" outerRadius={80} label={(e) => e.name}>
                    {incomeBySource.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Expenses by Category</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card overflow-hidden">
              {expensesByCategory.length === 0 ? (
                <EmptyState title="No financial records found for the selected period." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Txns</th>
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2">Paid</th>
                        <th className="px-3 py-2">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {expensesByCategory.map((row) => (
                        <tr key={row.category}>
                          <td className="px-3 py-2 font-medium">{row.category}</td>
                          <td className="px-3 py-2">{row.transactionCount}</td>
                          <td className="px-3 py-2">{formatCurrency(row.totalAmount)}</td>
                          <td className="px-3 py-2">{formatCurrency(row.paidAmount)}</td>
                          <td className="px-3 py-2">{formatCurrency(row.outstandingAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <ChartCard title="Expenses by Category" subtitle="Share of expenses">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expensesByCategory} dataKey="value" nameKey="name" outerRadius={80} label={(e) => e.name}>
                    {expensesByCategory.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Payment Status Overview</h2>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card p-4">
            <h3 className="font-medium mb-3">Income</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {incomePaymentStatus.map((row) => (
                <div key={row.status} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <div className="flex justify-between gap-2 mb-1">
                    <StatusBadge status={row.status} />
                    <span className="text-xs text-slate-500">{row.transactionCount} txns</span>
                  </div>
                  <p className="text-sm">Total {formatCurrency(row.totalAmount)}</p>
                  <p className="text-sm text-emerald-600">Paid {formatCurrency(row.paidAmount)}</p>
                  <p className="text-sm text-amber-600">Outstanding {formatCurrency(row.outstandingAmount)}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4">
            <h3 className="font-medium mb-3">Expenses</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {expensePaymentStatus.map((row) => (
                <div key={row.status} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <div className="flex justify-between gap-2 mb-1">
                    <StatusBadge status={row.status} />
                    <span className="text-xs text-slate-500">{row.transactionCount} txns</span>
                  </div>
                  <p className="text-sm">Total {formatCurrency(row.totalAmount)}</p>
                  <p className="text-sm text-emerald-600">Paid {formatCurrency(row.paidAmount)}</p>
                  <p className="text-sm text-amber-600">Outstanding {formatCurrency(row.outstandingAmount)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 no-print">
        <h2 className="font-display text-lg font-semibold">Income Transactions</h2>
        <div className="card p-4 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row">
            <SearchBar value={incomeSearch} onChange={setIncomeSearch} placeholder="Search income..." className="flex-1" />
            <FilterDropdown label="Source" value={incomeSource} onChange={setIncomeSource} options={[{ value: '', label: 'All sources' }, ...INCOME_SOURCES.map((s) => ({ value: s, label: s }))]} />
            <FilterDropdown label="Category" value={incomeCategory} onChange={setIncomeCategory} options={[{ value: '', label: 'All categories' }, ...INCOME_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
            <FilterDropdown label="Status" value={incomeStatus} onChange={setIncomeStatus} options={[{ value: '', label: 'All statuses' }, { value: 'Paid', label: 'Paid' }, { value: 'Partial', label: 'Partial' }, { value: 'Pending', label: 'Pending' }, { value: 'Overdue', label: 'Overdue' }]} />
          </div>
          <div className="flex gap-2 items-center">
            <select className="input-field !w-auto" value={incomeSort} onChange={(e) => setIncomeSort(e.target.value)}>
              <option value="date">Date</option>
              <option value="amount">Amount</option>
              <option value="customer">Customer</option>
            </select>
            <button type="button" className="btn-secondary text-xs" onClick={() => setIncomeDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
              {incomeDir === 'asc' ? 'Asc' : 'Desc'}
            </button>
          </div>
        </div>
        <div className="card overflow-hidden">
          {incomePaged.data.length === 0 ? (
            <EmptyState title="No financial records found for the selected period." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                      <th className="px-4 py-3">Income ID</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Customer / Ref</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Paid</th>
                      <th className="px-4 py-3">Balance</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {incomePaged.data.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-medium">{row.incomeId}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(row.date)}</td>
                        <td className="px-4 py-3">{row.source}</td>
                        <td className="px-4 py-3">{row.category}</td>
                        <td className="px-4 py-3">{row.customer || row.reference || '—'}</td>
                        <td className="px-4 py-3">{formatCurrency(row.amount)}</td>
                        <td className="px-4 py-3">{formatCurrency(row.paidAmount)}</td>
                        <td className="px-4 py-3">{formatCurrency(row.remainingAmount)}</td>
                        <td className="px-4 py-3">{row.paymentMethod}</td>
                        <td className="px-4 py-3"><StatusBadge status={row.paymentStatus} /></td>
                        <td className="px-4 py-3 text-right">
                          <Link to={`/income/${row.id}`} className="btn-secondary text-xs">
                            <Eye size={14} />
                            View Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 border-t border-slate-200 dark:border-slate-800">
                <Pagination page={incomePaged.page} totalPages={incomePaged.totalPages} total={incomePaged.total} onChange={setIncomePage} />
              </div>
            </>
          )}
        </div>
      </section>

      <section className="space-y-4 no-print">
        <h2 className="font-display text-lg font-semibold">Expense Transactions</h2>
        <div className="card p-4 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row">
            <SearchBar value={expenseSearch} onChange={setExpenseSearch} placeholder="Search expenses..." className="flex-1" />
            <FilterDropdown label="Category" value={expenseCategory} onChange={setExpenseCategory} options={[{ value: '', label: 'All categories' }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
            <FilterDropdown label="Status" value={expenseStatus} onChange={setExpenseStatus} options={[{ value: '', label: 'All statuses' }, { value: 'Paid', label: 'Paid' }, { value: 'Partial', label: 'Partial' }, { value: 'Pending', label: 'Pending' }, { value: 'Overdue', label: 'Overdue' }]} />
          </div>
          <div className="flex gap-2 items-center">
            <select className="input-field !w-auto" value={expenseSort} onChange={(e) => setExpenseSort(e.target.value)}>
              <option value="date">Date</option>
              <option value="amount">Amount</option>
              <option value="supplier">Supplier</option>
            </select>
            <button type="button" className="btn-secondary text-xs" onClick={() => setExpenseDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
              {expenseDir === 'asc' ? 'Asc' : 'Desc'}
            </button>
          </div>
        </div>
        <div className="card overflow-hidden">
          {expensePaged.data.length === 0 ? (
            <EmptyState title="No financial records found for the selected period." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                      <th className="px-4 py-3">Expense ID</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Supplier / Ref</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Paid</th>
                      <th className="px-4 py-3">Balance</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {expensePaged.data.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-medium">{row.expenseId}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(row.date)}</td>
                        <td className="px-4 py-3">{row.category}</td>
                        <td className="px-4 py-3">{row.supplier || row.reference || '—'}</td>
                        <td className="px-4 py-3">{formatCurrency(row.amount)}</td>
                        <td className="px-4 py-3">{formatCurrency(row.paidAmount)}</td>
                        <td className="px-4 py-3">{formatCurrency(row.remainingAmount)}</td>
                        <td className="px-4 py-3">{row.paymentMethod}</td>
                        <td className="px-4 py-3"><StatusBadge status={row.paymentStatus} /></td>
                        <td className="px-4 py-3 text-right">
                          <Link to={`/expenses/${row.id}`} className="btn-secondary text-xs">
                            <Eye size={14} />
                            View Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 border-t border-slate-200 dark:border-slate-800">
                <Pagination page={expensePaged.page} totalPages={expensePaged.totalPages} total={expensePaged.total} onChange={setExpensePage} />
              </div>
            </>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Outstanding Income</h2>
        <div className="card overflow-hidden">
          {outstandingIncome.length === 0 ? (
            <EmptyState title="No outstanding income found." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Income ID</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Customer / Ref</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Outstanding</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {outstandingIncome.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-medium">{row.incomeId}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(row.date)}</td>
                      <td className="px-4 py-3">{row.source}</td>
                      <td className="px-4 py-3">{row.customer}</td>
                      <td className="px-4 py-3">{formatCurrency(row.totalAmount)}</td>
                      <td className="px-4 py-3">{formatCurrency(row.paid)}</td>
                      <td className="px-4 py-3 font-semibold text-amber-600">{formatCurrency(row.outstanding)}</td>
                      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/income/${row.id}`} className="btn-secondary text-xs">View Details</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Outstanding Expenses</h2>
        <div className="card overflow-hidden">
          {outstandingExpenses.length === 0 ? (
            <EmptyState title="No outstanding expenses found." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Expense ID</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Supplier / Ref</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Outstanding</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {outstandingExpenses.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-medium">{row.expenseId}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(row.date)}</td>
                      <td className="px-4 py-3">{row.category}</td>
                      <td className="px-4 py-3">{row.supplier}</td>
                      <td className="px-4 py-3">{formatCurrency(row.totalAmount)}</td>
                      <td className="px-4 py-3">{formatCurrency(row.paid)}</td>
                      <td className="px-4 py-3 font-semibold text-amber-600">{formatCurrency(row.outstanding)}</td>
                      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/expenses/${row.id}`} className="btn-secondary text-xs">View Details</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      </>
      )}
    </div>
  )
}
