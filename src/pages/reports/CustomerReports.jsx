import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Eye, Printer, Users } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import LoadingState from '../../components/ui/LoadingState'
import SearchBar from '../../components/ui/SearchBar'
import FilterDropdown from '../../components/ui/FilterDropdown'
import StatCard from '../../components/ui/StatCard'
import ChartCard from '../../components/ui/ChartCard'
import EmptyState from '../../components/ui/EmptyState'
import { ReportDateFilter, ReportExportButtons } from '../../components/reports'
import { useApp } from '../../contexts/AppContext'
import useReportQuery from '../../hooks/useReportQuery'
import reportService from '../../services/reportService'
import { formatCurrency, formatDateDMY } from '../../utils/helpers'
import BrandLogo from '../../components/ui/BrandLogo'
import { resolveReportDateRange } from '../../utils/reportHelpers'
import {
  calculateCustomerActivity,
  calculateCustomerRentals,
  calculateCustomerSales,
  calculateCustomerSummary,
} from '../../utils/reportCalculations'

export default function CustomerReports() {
  const { customers, sales, rentals } = useApp()

  const initialRange = resolveReportDateRange('this_year')
  const [preset, setPreset] = useState('this_year')
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)

  const [search, setSearch] = useState('')
  const [activityFilter, setActivityFilter] = useState('')
  const [sortBy, setSortBy] = useState('totalActivity')

  const fetchCustomers = useCallback((params) => reportService.getCustomerReport(params), [])
  const { data: apiReport, loading, error, reload } = useReportQuery(fetchCustomers, {
    from,
    to,
  })

  const localSummary = useMemo(
    () => calculateCustomerSummary({ customers, sales, rentals, from, to }),
    [customers, sales, rentals, from, to]
  )

  const apiCustomers = apiReport?.customers ? apiReport.customers : null

  const summary = apiReport?.summary
    ? {
        totalCustomers: apiReport.summary.totalCustomers ?? localSummary.totalCustomers,
        activeCustomers: apiReport.summary.activeCustomers ?? localSummary.activeCustomers,
        salesCustomers: apiCustomers
          ? apiCustomers.filter((c) => (c.salesCount || 0) > 0).length
          : localSummary.salesCustomers,
        rentalCustomers: apiCustomers
          ? apiCustomers.filter((c) => (c.rentalCount || 0) > 0).length
          : localSummary.rentalCustomers,
        totalCustomerSales: apiCustomers
          ? apiCustomers.reduce((s, c) => s + (Number(c.salesRevenue) || 0), 0)
          : localSummary.totalCustomerSales,
        totalCustomerRentals: apiCustomers
          ? apiCustomers.reduce((s, c) => s + (Number(c.rentalRevenue) || 0), 0)
          : localSummary.totalCustomerRentals,
        rangedSales: localSummary.rangedSales,
        rangedRentals: localSummary.rangedRentals,
      }
    : localSummary

  const activity = useMemo(() => {
    let rows = apiCustomers
      ? apiCustomers.map((c) => {
          const salesAmount = Number(c.salesRevenue) || 0
          const rentalAmount = Number(c.rentalRevenue) || 0
          return {
            customerId: c.id,
            customer: c.name,
            phone: c.phone || '—',
            email: c.email || '—',
            salesCount: c.salesCount || 0,
            salesAmount,
            rentalCount: c.rentalCount || 0,
            rentalAmount,
            totalActivity: salesAmount + rentalAmount,
            lastActivityDate: c.lastTransactionDate || null,
            hasSales: (c.salesCount || 0) > 0,
            hasRentals: (c.rentalCount || 0) > 0,
          }
        })
      : calculateCustomerActivity(customers, summary.rangedSales, summary.rangedRentals)

    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (r) =>
          String(r.customer || '').toLowerCase().includes(q) ||
          String(r.phone || '').toLowerCase().includes(q) ||
          String(r.email || '').toLowerCase().includes(q)
      )
    }
    if (activityFilter === 'sales') rows = rows.filter((r) => r.hasSales)
    if (activityFilter === 'rentals') rows = rows.filter((r) => r.hasRentals)
    if (activityFilter === 'both') rows = rows.filter((r) => r.hasSales && r.hasRentals)
    if (activityFilter === 'none') rows = rows.filter((r) => !r.hasSales && !r.hasRentals)

    rows = [...rows].sort((a, b) => {
      if (sortBy === 'customer') return String(a.customer).localeCompare(String(b.customer))
      if (sortBy === 'salesAmount') return b.salesAmount - a.salesAmount
      if (sortBy === 'rentalAmount') return b.rentalAmount - a.rentalAmount
      return b.totalActivity - a.totalActivity
    })
    return rows
  }, [
    apiCustomers,
    customers,
    summary.rangedSales,
    summary.rangedRentals,
    search,
    activityFilter,
    sortBy,
  ])

  const salesByCustomer = useMemo(() => {
    if (apiCustomers) {
      return apiCustomers
        .filter((c) => (c.salesCount || 0) > 0)
        .map((c) => ({
          customerId: c.id,
          customer: c.name,
          numberOfSales: c.salesCount || 0,
          itemsPurchased: c.salesCount || 0,
          salesAmount: Number(c.salesRevenue) || 0,
          paidAmount: Math.max(
            0,
            (Number(c.salesRevenue) || 0) - (Number(c.outstandingBalance) || 0)
          ),
          outstandingAmount: Number(c.outstandingBalance) || 0,
          lastSaleDate: c.lastTransactionDate || null,
        }))
        .sort((a, b) => b.salesAmount - a.salesAmount)
    }
    return calculateCustomerSales(customers, summary.rangedSales)
  }, [apiCustomers, customers, summary.rangedSales])

  const rentalsByCustomer = useMemo(() => {
    if (apiCustomers) {
      return apiCustomers
        .filter((c) => (c.rentalCount || 0) > 0)
        .map((c) => ({
          customerId: c.id,
          customer: c.name,
          numberOfRentals: c.rentalCount || 0,
          equipmentItems: c.rentalCount || 0,
          rentalDays: 0,
          rentalAmount: Number(c.rentalRevenue) || 0,
          paidAmount: 0,
          outstandingAmount: Number(c.outstandingBalance) || 0,
          lastRentalDate: c.lastTransactionDate || null,
        }))
        .sort((a, b) => b.rentalAmount - a.rentalAmount)
    }
    return calculateCustomerRentals(customers, summary.rangedRentals)
  }, [apiCustomers, customers, summary.rangedRentals])

  if (loading && !apiReport) {
    return <LoadingState label="Loading customer report..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between no-print">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Reports', to: '/reports' },
              { label: 'Customer Reports' },
            ]}
          />
          <h1 className="page-title">Customer Reports</h1>
          <p className="page-subtitle">
            View customer activity, sales, rentals and payment history.
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
          <Link to="/customers" className="btn-secondary">
            Customers
          </Link>
          <ReportExportButtons
            filename={`customer-report-${from}-to-${to}`}
            getSheets={() => [
              {
                name: 'Customer Activity',
                columns: [
                  { key: 'customer', label: 'Customer' },
                  { key: 'phone', label: 'Phone' },
                  { key: 'email', label: 'Email' },
                  { key: 'salesCount', label: '# Sales', value: (r) => Number(r.salesCount || 0) },
                  { key: 'salesAmount', label: 'Sales Amount', value: (r) => Number(r.salesAmount || 0) },
                  { key: 'rentalCount', label: '# Rentals', value: (r) => Number(r.rentalCount || 0) },
                  { key: 'rentalAmount', label: 'Rental Amount', value: (r) => Number(r.rentalAmount || 0) },
                  { key: 'totalActivity', label: 'Total', value: (r) => Number(r.totalActivity || 0) },
                  { key: 'lastActivityDate', label: 'Last Activity' },
                ],
                rows: activity,
              },
              {
                name: 'Sales by Customer',
                columns: [
                  { key: 'customer', label: 'Customer' },
                  { key: 'numberOfSales', label: '# Sales', value: (r) => Number(r.numberOfSales || 0) },
                  { key: 'salesAmount', label: 'Sales Amount', value: (r) => Number(r.salesAmount || 0) },
                  { key: 'lastSaleDate', label: 'Last Sale' },
                ],
                rows: salesByCustomer,
              },
              {
                name: 'Rentals by Customer',
                columns: [
                  { key: 'customer', label: 'Customer' },
                  { key: 'numberOfRentals', label: '# Rentals', value: (r) => Number(r.numberOfRentals || 0) },
                  { key: 'rentalAmount', label: 'Rental Amount', value: (r) => Number(r.rentalAmount || 0) },
                  { key: 'lastRentalDate', label: 'Last Rental' },
                ],
                rows: rentalsByCustomer,
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
        <p className="text-sm">Construction Management System — Customer Reports</p>
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

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex flex-wrap items-center justify-between gap-3 no-print">
          <span>{error}</span>
          <button type="button" className="btn-secondary text-xs" onClick={() => reload().catch(() => {})}>
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard title="Total Customers" value={summary.totalCustomers} icon={Users} tone="brand" />
        <StatCard title="Active Customers" value={summary.activeCustomers} icon={Users} tone="green" />
        <StatCard title="Sales Customers" value={summary.salesCustomers} icon={Users} tone="blue" />
        <StatCard title="Rental Customers" value={summary.rentalCustomers} icon={Users} tone="violet" />
        <StatCard title="Total Customer Sales" value={formatCurrency(summary.totalCustomerSales)} icon={Users} tone="green" />
        <StatCard title="Total Customer Rentals" value={formatCurrency(summary.totalCustomerRentals)} icon={Users} tone="blue" />
      </div>

      <section className="space-y-4 no-print">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Customer Activity</h2>
            <p className="text-sm text-slate-500">Activity within the selected period</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SearchBar value={search} onChange={setSearch} placeholder="Search customers..." className="w-full sm:w-56" />
            <FilterDropdown
              label="Activity"
              value={activityFilter}
              onChange={setActivityFilter}
              options={[
                { value: '', label: 'All customers' },
                { value: 'sales', label: 'With sales' },
                { value: 'rentals', label: 'With rentals' },
                { value: 'both', label: 'Sales & rentals' },
                { value: 'none', label: 'No activity' },
              ]}
            />
            <select className="input-field !w-auto" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="totalActivity">Sort by Total Activity</option>
              <option value="salesAmount">Sort by Sales</option>
              <option value="rentalAmount">Sort by Rentals</option>
              <option value="customer">Sort by Name</option>
            </select>
          </div>
        </div>
        <div className="card overflow-hidden">
          {activity.length === 0 ? (
            <EmptyState title="No customer activity found for the selected period." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Sales Count</th>
                    <th className="px-4 py-3">Sales Amount</th>
                    <th className="px-4 py-3">Rental Count</th>
                    <th className="px-4 py-3">Rental Amount</th>
                    <th className="px-4 py-3">Total Activity</th>
                    <th className="px-4 py-3">Last Activity</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activity.map((row) => (
                    <tr key={row.customerId}>
                      <td className="px-4 py-3 font-medium">{row.customer}</td>
                      <td className="px-4 py-3">{row.phone}</td>
                      <td className="px-4 py-3">{row.email}</td>
                      <td className="px-4 py-3">{row.salesCount}</td>
                      <td className="px-4 py-3">{formatCurrency(row.salesAmount)}</td>
                      <td className="px-4 py-3">{row.rentalCount}</td>
                      <td className="px-4 py-3">{formatCurrency(row.rentalAmount)}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(row.totalActivity)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(row.lastActivityDate)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/reports/customers/${row.customerId}`} className="btn-secondary text-xs">
                          <Eye size={14} />
                          View Report
                        </Link>
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
        <h2 className="font-display text-lg font-semibold">Sales by Customer</h2>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card overflow-hidden">
            {salesByCustomer.length === 0 ? (
              <EmptyState title="No customer activity found for the selected period." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3"># Sales</th>
                      <th className="px-4 py-3">Items</th>
                      <th className="px-4 py-3">Sales Amount</th>
                      <th className="px-4 py-3">Paid</th>
                      <th className="px-4 py-3">Outstanding</th>
                      <th className="px-4 py-3">Last Sale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {salesByCustomer.map((row) => (
                      <tr key={row.customerId}>
                        <td className="px-4 py-3 font-medium">
                          <Link to={`/customers/${row.customerId}`} className="text-brand-600 hover:underline">
                            {row.customer}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{row.numberOfSales}</td>
                        <td className="px-4 py-3">{row.itemsPurchased}</td>
                        <td className="px-4 py-3">{formatCurrency(row.salesAmount)}</td>
                        <td className="px-4 py-3">{formatCurrency(row.paidAmount)}</td>
                        <td className="px-4 py-3">{formatCurrency(row.outstandingAmount)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(row.lastSaleDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <ChartCard title="Sales Amount by Customer" subtitle="Top customers in selected period">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesByCustomer.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="customer" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="salesAmount" name="Sales Amount" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Rentals by Customer</h2>
        <div className="card overflow-hidden">
          {rentalsByCustomer.length === 0 ? (
            <EmptyState title="No customer activity found for the selected period." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3"># Rentals</th>
                    <th className="px-4 py-3">Equipment Items</th>
                    <th className="px-4 py-3">Rental Days</th>
                    <th className="px-4 py-3">Rental Amount</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Outstanding</th>
                    <th className="px-4 py-3">Last Rental</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rentalsByCustomer.map((row) => (
                    <tr key={row.customerId}>
                      <td className="px-4 py-3 font-medium">{row.customer}</td>
                      <td className="px-4 py-3">{row.numberOfRentals}</td>
                      <td className="px-4 py-3">{row.equipmentItems}</td>
                      <td className="px-4 py-3">{row.rentalDays}</td>
                      <td className="px-4 py-3">{formatCurrency(row.rentalAmount)}</td>
                      <td className="px-4 py-3">{formatCurrency(row.paidAmount)}</td>
                      <td className="px-4 py-3">{formatCurrency(row.outstandingAmount)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(row.lastRentalDate)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/customers/${row.customerId}`} className="btn-secondary text-xs">
                          View Customer
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
