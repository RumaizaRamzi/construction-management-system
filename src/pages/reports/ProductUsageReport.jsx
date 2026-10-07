import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Package, Printer } from 'lucide-react'
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
import StatCard from '../../components/ui/StatCard'
import ChartCard from '../../components/ui/ChartCard'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import { ReportDateFilter, ReportExportButtons } from '../../components/reports'
import { useApp } from '../../contexts/AppContext'
import useReportQuery from '../../hooks/useReportQuery'
import reportService from '../../services/reportService'
import { formatCurrency, formatDateDMY } from '../../utils/helpers'
import BrandLogo from '../../components/ui/BrandLogo'
import { resolveReportDateRange, filterByDateRange } from '../../utils/reportHelpers'
import {
  calculateProductLifecycle,
  calculateProductUsage,
  calculateRentalFrequencyByProduct,
  calculateRentalIncomeByProduct,
} from '../../utils/reportCalculations'

export default function ProductUsageReport() {
  const { products, rentals, sales, maintenance } = useApp()

  const initialRange = resolveReportDateRange('this_year')
  const [preset, setPreset] = useState('this_year')
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)
  const [search, setSearch] = useState('')
  const [showAllFrequency, setShowAllFrequency] = useState(false)

  const fetchUsage = useCallback((params) => reportService.getInventoryUsageReport(params), [])
  const { data: apiReport, loading, error, reload } = useReportQuery(fetchUsage, { from, to })

  const rangedRentals = useMemo(
    () => filterByDateRange(rentals, 'startDate', from, to),
    [rentals, from, to]
  )
  const rangedSales = useMemo(
    () => filterByDateRange(sales, 'date', from, to),
    [sales, from, to]
  )
  const rangedMaintenance = useMemo(
    () => filterByDateRange(maintenance, 'startDate', from, to),
    [maintenance, from, to]
  )

  const apiUsage = apiReport?.usage ? apiReport.usage : null

  const localUsageSummary = useMemo(
    () => calculateProductUsage(products, rangedRentals, rangedSales, rangedMaintenance),
    [products, rangedRentals, rangedSales, rangedMaintenance]
  )

  const usageSummary = apiUsage
    ? {
        totalProducts: products.length || apiUsage.length,
        productsRented: apiUsage.filter((r) => (r.rentalCount || 0) > 0).length,
        totalRentalTransactions: apiUsage.reduce((s, r) => s + (Number(r.rentalCount) || 0), 0),
        totalRentalDays: apiUsage.reduce((s, r) => s + (Number(r.rentalDays) || 0), 0),
        totalRentalIncome: apiUsage.reduce((s, r) => s + (Number(r.totalRevenue) || 0), 0),
        productsWithNoRentalActivity: Math.max(
          0,
          (products.length || apiUsage.length) -
            apiUsage.filter((r) => (r.rentalCount || 0) > 0).length
        ),
      }
    : localUsageSummary

  const frequency = useMemo(() => {
    let rows = apiUsage
      ? apiUsage.map((row) => {
          const product = products.find((p) => Number(p.id) === Number(row.productId))
          return {
            productId: row.productId,
            equipment: row.product || product?.name || 'Unknown',
            serial_number: row.serial_number || product?.serial_number || '—',
            category: product?.category || '—',
            timesRented: row.rentalCount || 0,
            totalRentalDays: row.rentalDays || 0,
            rentalIncome: row.totalRevenue || 0,
            lastRentedDate: row.lastUsageDate || null,
            currentStatus: product?.status || '—',
          }
        })
      : calculateRentalFrequencyByProduct(products, rangedRentals)

    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (r) =>
          String(r.equipment || '').toLowerCase().includes(q) ||
          String(r.serial_number || '').toLowerCase().includes(q) ||
          String(r.category || '').toLowerCase().includes(q)
      )
    }
    return [...rows].sort((a, b) => b.timesRented - a.timesRented)
  }, [apiUsage, products, rangedRentals, search])

  const incomeByProduct = useMemo(() => {
    if (apiUsage) {
      return apiUsage
        .filter((r) => (r.rentalCount || 0) > 0 || (r.rentalQuantity || 0) > 0)
        .map((row) => ({
          productId: row.productId,
          equipment: row.product || 'Unknown',
          rentalCount: row.rentalCount || 0,
          rentalDays: row.rentalDays || 0,
          rentalIncome: row.totalRevenue || 0,
          paidAmount: 0,
          outstandingAmount: 0,
        }))
        .sort((a, b) => b.rentalIncome - a.rentalIncome)
    }
    return calculateRentalIncomeByProduct(products, rangedRentals)
  }, [apiUsage, products, rangedRentals])

  const lifecycle = useMemo(
    () => calculateProductLifecycle(products, rentals, maintenance),
    [products, rentals, maintenance]
  )

  const chartFrequency = showAllFrequency ? frequency : frequency.slice(0, 8)
  const chartIncome = incomeByProduct.slice(0, 8)

  if (loading && !apiReport) {
    return <LoadingState label="Loading product usage report..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between no-print">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Reports', to: '/reports' },
              { label: 'Inventory', to: '/reports/inventory' },
              { label: 'Product Usage' },
            ]}
          />
          <h1 className="page-title">Product Usage Report</h1>
          <p className="page-subtitle">
            Track how frequently equipment is sold, rented, returned and maintained.
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Report Period: {formatDateDMY(from)} – {formatDateDMY(to)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/reports/inventory" className="btn-secondary">
            <ArrowLeft size={16} />
            Inventory Reports
          </Link>
          <ReportExportButtons
            filename={`product-usage-report-${from}-to-${to}`}
            getSheets={() => [
              {
                name: 'Rental Frequency',
                columns: [
                  { key: 'equipment', label: 'Equipment' },
                  { key: 'serial_number', label: 'Serial Number' },
                  { key: 'category', label: 'Category' },
                  { key: 'timesRented', label: 'Times Rented', value: (r) => Number(r.timesRented || 0) },
                  { key: 'totalRentalDays', label: 'Rental Days', value: (r) => Number(r.totalRentalDays || 0) },
                  { key: 'rentalIncome', label: 'Rental Income', value: (r) => Number(r.rentalIncome || 0) },
                  { key: 'lastRentedDate', label: 'Last Rented' },
                  { key: 'currentStatus', label: 'Current Status' },
                ],
                rows: frequency,
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
        <p className="text-sm">Construction Management System — Product Usage Report</p>
        <p className="text-sm mt-1">
          Report Period: {formatDateDMY(from)} – {formatDateDMY(to)}
        </p>
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
        <StatCard title="Total Products" value={usageSummary.totalProducts} icon={Package} tone="brand" />
        <StatCard title="Products Rented" value={usageSummary.productsRented} icon={Package} tone="blue" />
        <StatCard title="Total Rental Transactions" value={usageSummary.totalRentalTransactions} icon={Package} tone="green" />
        <StatCard title="Total Rental Days" value={usageSummary.totalRentalDays} icon={Package} tone="violet" />
        <StatCard title="Total Rental Income" value={formatCurrency(usageSummary.totalRentalIncome)} icon={Package} tone="green" />
        <StatCard title="Products With No Rental Activity" value={usageSummary.productsWithNoRentalActivity} icon={Package} tone="slate" />
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Equipment Rental Frequency
            </h2>
            <p className="text-sm text-slate-500">Derived from rental records in the selected period</p>
          </div>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search equipment..."
            className="w-full sm:w-64 no-print"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card overflow-hidden">
            {frequency.length === 0 ? (
              <EmptyState title="No equipment usage records found." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                      <th className="px-4 py-3">Equipment</th>
                      <th className="px-4 py-3">Serial Number</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Times Rented</th>
                      <th className="px-4 py-3">Rental Days</th>
                      <th className="px-4 py-3">Rental Income</th>
                      <th className="px-4 py-3">Last Rented</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {frequency.map((row) => (
                      <tr key={row.productId}>
                        <td className="px-4 py-3 font-medium">
                          <Link
                            to={`/products/${row.productId}/usage`}
                            className="text-brand-600 hover:underline dark:text-brand-400"
                          >
                            {row.equipment}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{row.serial_number}</td>
                        <td className="px-4 py-3">{row.category}</td>
                        <td className="px-4 py-3">{row.timesRented}</td>
                        <td className="px-4 py-3">{row.totalRentalDays}</td>
                        <td className="px-4 py-3">{formatCurrency(row.rentalIncome)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatDateDMY(row.lastRentedDate)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.currentStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <ChartCard title="Rental Frequency by Equipment" subtitle="Rental count by equipment">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartFrequency} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="equipment" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="timesRented" name="Rental Count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            {frequency.length > 8 && (
              <button
                type="button"
                className="btn-secondary text-xs no-print"
                onClick={() => setShowAllFrequency((v) => !v)}
              >
                {showAllFrequency ? 'Show top 8 in chart' : 'Show all equipment in chart'}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Rental Income by Equipment
          </h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card overflow-hidden">
            {incomeByProduct.length === 0 ? (
              <EmptyState title="No rental income records found for the selected period." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                      <th className="px-4 py-3">Equipment</th>
                      <th className="px-4 py-3">Rental Count</th>
                      <th className="px-4 py-3">Rental Days</th>
                      <th className="px-4 py-3">Rental Income</th>
                      <th className="px-4 py-3">Paid</th>
                      <th className="px-4 py-3">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {incomeByProduct.map((row) => (
                      <tr key={row.productId}>
                        <td className="px-4 py-3 font-medium">{row.equipment}</td>
                        <td className="px-4 py-3">{row.rentalCount}</td>
                        <td className="px-4 py-3">{row.rentalDays}</td>
                        <td className="px-4 py-3">{formatCurrency(row.rentalIncome)}</td>
                        <td className="px-4 py-3">{formatCurrency(row.paidAmount)}</td>
                        <td className="px-4 py-3">{formatCurrency(row.outstandingAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <ChartCard title="Rental Income by Equipment" subtitle="Income totals for the period">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartIncome}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="equipment" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="rentalIncome" name="Rental Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Equipment Lifecycle
          </h2>
          <p className="text-sm text-slate-500">
            Based on existing product usage history and related activity
          </p>
        </div>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Current Stage</th>
                  <th className="px-4 py-3">Last Activity</th>
                  <th className="px-4 py-3">Last Rental</th>
                  <th className="px-4 py-3">Last Maintenance</th>
                  <th className="px-4 py-3">Current Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lifecycle.map((row) => (
                  <tr key={row.productId}>
                    <td className="px-4 py-3 font-medium">
                      <Link
                        to={`/products/${row.productId}`}
                        className="text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {row.product}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{row.currentStage}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(row.lastActivity)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(row.lastRental)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDateDMY(row.lastMaintenance)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.currentStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
