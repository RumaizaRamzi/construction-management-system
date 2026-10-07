import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Eye,
  KeyRound,
  Package,
  Printer,
  User,
} from 'lucide-react'
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
import Pagination from '../../components/ui/Pagination'
import StatCard from '../../components/ui/StatCard'
import ChartCard from '../../components/ui/ChartCard'
import StatusBadge from '../../components/ui/StatusBadge'
import { ReportDateFilter, ReportExportButtons } from '../../components/reports'
import { useApp } from '../../contexts/AppContext'
import useReportQuery from '../../hooks/useReportQuery'
import reportService from '../../services/reportService'
import { formatCurrency, formatDateDMY, paginate } from '../../utils/helpers'
import BrandLogo from '../../components/ui/BrandLogo'
import { resolveReportDateRange } from '../../utils/reportHelpers'
import {
  RENTAL_PAYMENT_STATUSES,
  RENTAL_STATUSES,
  filterRentalTransactions,
  getEquipmentRentalUsage,
  getMonthlyRentalIncome,
  getOverdueRentals,
  getRentalActivityByCustomer,
  getRentalPaymentStatusSummary,
  getRentalReportSummary,
  getRentalStatusSummary,
  rangedRentals,
  sortRentalTransactions,
} from '../../utils/rentalReportHelpers'

const PAGE_SIZE = 8

function mapRentalRow(r = {}) {
  return {
    ...r,
    rentalId: r.rental_number || r.rentalId || r.rentalNumber,
    customerId: r.customer_id ?? r.customerId,
    productId: r.product_id ?? r.productId,
    product: r.product || r.equipment || '—',
    startDate: r.start_date || r.startDate || r.rental_date,
    expectedReturn: r.expected_return_date || r.expected_return || r.expectedReturn,
    actualReturnDate: r.actual_return_date || r.actualReturnDate,
    duration: r.duration ?? r.rental_days ?? r.rentalDays ?? '—',
    quantity: r.quantity ?? r.total_rented_quantity ?? 1,
    total: r.total ?? r.total_amount,
    amountPaid: r.paid_amount ?? r.paid ?? r.amountPaid,
    balance: r.balance,
    rentalStatus: r.rental_status || r.status || r.rentalStatus,
    paymentStatus: r.payment_status || r.paymentStatus,
  }
}

export default function RentalReports() {
  const { rentals, products, customers } = useApp()

  const initialRange = resolveReportDateRange('this_month')
  const [preset, setPreset] = useState('this_month')
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)

  const [search, setSearch] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [rentalStatusFilter, setRentalStatusFilter] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('startDate')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)

  const [customerSearch, setCustomerSearch] = useState('')
  const [customerSort, setCustomerSort] = useState('rentalIncome')

  const fetchRentals = useCallback((params) => reportService.getRentalReport(params), [])
  const { data: apiReport, loading, error, reload } = useReportQuery(fetchRentals, { from, to })

  const localRanged = useMemo(() => rangedRentals(rentals, from, to), [rentals, from, to])

  const ranged = useMemo(() => {
    if (apiReport?.transactions) {
      return apiReport.transactions.map(mapRentalRow)
    }
    return localRanged
  }, [apiReport, localRanged])

  const localSummary = useMemo(() => getRentalReportSummary(ranged), [ranged])
  const summary = apiReport?.summary
    ? {
        totalRentals: apiReport.summary.totalRentals ?? localSummary.totalRentals,
        rentalIncome: apiReport.summary.totalRentalIncome ?? localSummary.rentalIncome,
        paidAmount: apiReport.summary.paidRentalIncome ?? localSummary.paidAmount,
        outstandingAmount:
          apiReport.summary.outstandingRentalIncome ?? localSummary.outstandingAmount,
        equipmentRented: localSummary.equipmentRented,
        averageRentalValue:
          apiReport.summary.totalRentals > 0
            ? Math.round(
                (apiReport.summary.totalRentalIncome || 0) / apiReport.summary.totalRentals
              )
            : localSummary.averageRentalValue,
      }
    : localSummary

  const statusSummary = apiReport?.statusSummary
    ? apiReport.statusSummary.map((row) => ({
        status: row.status || row.name,
        count: row.count ?? row.value ?? 0,
        amount: row.amount ?? 0,
      }))
    : getRentalStatusSummary(ranged)

  const monthlyChart = apiReport?.monthly
    ? apiReport.monthly.map((row) => ({
        ...row,
        month: row.month,
        income: row.income ?? row.revenue ?? 0,
      }))
    : getMonthlyRentalIncome(ranged, from, to)

  const equipmentUsage = apiReport?.usage
    ? apiReport.usage.map((row) => {
        const product = products.find((p) => Number(p.id) === Number(row.productId))
        return {
          productId: row.productId,
          equipment: row.product || product?.name || 'Unknown',
          serial_number: product?.serial_number || '—',
          category: product?.category || '—',
          timesRented: row.rentalCount ?? 0,
          totalRentalDays: row.rentalDays ?? 0,
          rentalIncome: row.rentalIncome ?? 0,
          currentStatus: product?.status || '—',
          lastRentedDate: row.lastRentedDate || null,
        }
      })
    : getEquipmentRentalUsage(ranged, products)

  const paymentSummary = apiReport?.paymentStatus
    ? apiReport.paymentStatus.map((row) => ({
        status: row.status || row.name,
        count: row.count ?? row.value ?? 0,
        amount: row.amount ?? 0,
      }))
    : getRentalPaymentStatusSummary(ranged)

  const overdueRentals = apiReport?.overdue
    ? apiReport.overdue.map((row) => ({
        ...mapRentalRow(row),
        rentalId: row.rental_number || row.rentalId,
        expectedReturn: row.expected_return || row.expected_return_date || row.expectedReturn,
        daysOverdue: row.overdue_days ?? row.daysOverdue ?? 0,
        currentAmount: row.amount ?? row.total ?? row.currentAmount ?? 0,
        lateFee: row.late_fee ?? row.lateFee ?? 0,
        paymentStatus: row.payment_status || row.paymentStatus || row.status,
      }))
    : getOverdueRentals(rentals)

  const byCustomer = useMemo(() => {
    let rows = getRentalActivityByCustomer(ranged)
    const q = customerSearch.trim().toLowerCase()
    if (q) rows = rows.filter((r) => String(r.customer || '').toLowerCase().includes(q))
    rows = [...rows].sort((a, b) => {
      if (customerSort === 'customer') return String(a.customer).localeCompare(String(b.customer))
      if (customerSort === 'numberOfRentals') return b.numberOfRentals - a.numberOfRentals
      return b.rentalIncome - a.rentalIncome
    })
    return rows
  }, [ranged, customerSearch, customerSort])

  const filteredTx = useMemo(() => {
    const list = filterRentalTransactions(ranged, {
      search,
      customer: customerFilter,
      rentalStatus: rentalStatusFilter,
      paymentStatus: paymentStatusFilter,
    })
    return sortRentalTransactions(list, sortBy, sortDir)
  }, [
    ranged,
    search,
    customerFilter,
    rentalStatusFilter,
    paymentStatusFilter,
    sortBy,
    sortDir,
  ])

  const paged = paginate(filteredTx, page, PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [
    search,
    customerFilter,
    rentalStatusFilter,
    paymentStatusFilter,
    sortBy,
    sortDir,
    from,
    to,
  ])

  const customerOptions = useMemo(() => {
    const names = [...new Set(ranged.map((r) => r.customer).filter(Boolean))]
    return [{ value: '', label: 'All customers' }, ...names.map((n) => ({ value: n, label: n }))]
  }, [ranged])

  if (loading && !apiReport) {
    return <LoadingState label="Loading rental report..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between no-print">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Reports', to: '/reports' },
              { label: 'Rental Reports' },
            ]}
          />
          <h1 className="page-title">Rental Reports</h1>
          <p className="page-subtitle">
            Analyze equipment rentals, rental income, customer activity and equipment usage.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/reports" className="btn-secondary">
            <ArrowLeft size={16} />
            Reports
          </Link>
          <Link to="/rentals" className="btn-secondary">
            <KeyRound size={16} />
            View Rentals
          </Link>
          <ReportExportButtons
            filename={`rental-report-${from}-to-${to}`}
            getSheets={() => [
              {
                name: 'Transactions',
                columns: [
                  { key: 'rentalId', label: 'Rental ID' },
                  { key: 'customer', label: 'Customer' },
                  { key: 'product', label: 'Equipment' },
                  { key: 'startDate', label: 'Start Date' },
                  { key: 'expectedReturn', label: 'Expected Return' },
                  { key: 'actualReturnDate', label: 'Actual Return' },
                  { key: 'duration', label: 'Days' },
                  { key: 'total', label: 'Amount', value: (r) => Number(r.total || 0) },
                  { key: 'amountPaid', label: 'Paid', value: (r) => Number(r.amountPaid || 0) },
                  { key: 'balance', label: 'Balance', value: (r) => Number(r.balance || 0) },
                  { key: 'rentalStatus', label: 'Rental Status' },
                  { key: 'paymentStatus', label: 'Payment Status' },
                ],
                rows: filteredTx,
              },
              {
                name: 'Equipment Usage',
                columns: [
                  { key: 'equipment', label: 'Equipment' },
                  { key: 'serial_number', label: 'Serial Number' },
                  { key: 'category', label: 'Category' },
                  { key: 'timesRented', label: 'Times Rented', value: (r) => Number(r.timesRented || 0) },
                  { key: 'totalRentalDays', label: 'Total Rental Days', value: (r) => Number(r.totalRentalDays || 0) },
                  { key: 'rentalIncome', label: 'Rental Income', value: (r) => Number(r.rentalIncome || 0) },
                  { key: 'currentStatus', label: 'Current Status' },
                  { key: 'lastRentedDate', label: 'Last Rented' },
                ],
                rows: equipmentUsage,
              },
              {
                name: 'By Customer',
                columns: [
                  { key: 'customer', label: 'Customer' },
                  { key: 'numberOfRentals', label: '# Rentals', value: (r) => Number(r.numberOfRentals || 0) },
                  { key: 'equipmentItems', label: 'Equipment Items', value: (r) => Number(r.equipmentItems || 0) },
                  { key: 'rentalIncome', label: 'Rental Income', value: (r) => Number(r.rentalIncome || 0) },
                  { key: 'paid', label: 'Paid', value: (r) => Number(r.paid || 0) },
                  { key: 'outstanding', label: 'Outstanding', value: (r) => Number(r.outstanding || 0) },
                  { key: 'lastRentalDate', label: 'Last Rental' },
                ],
                rows: byCustomer,
              },
              {
                name: 'Overdue',
                columns: [
                  { key: 'rentalId', label: 'Rental ID' },
                  { key: 'customer', label: 'Customer' },
                  { key: 'product', label: 'Equipment' },
                  { key: 'expectedReturn', label: 'Expected Return' },
                  { key: 'daysOverdue', label: 'Days Overdue', value: (r) => Number(r.daysOverdue || 0) },
                  { key: 'currentAmount', label: 'Current Amount', value: (r) => Number(r.currentAmount || 0) },
                  { key: 'lateFee', label: 'Late Fee', value: (r) => Number(r.lateFee || 0) },
                  { key: 'paymentStatus', label: 'Payment Status' },
                ],
                rows: overdueRentals,
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
        <p className="text-sm">Construction Management System — Rental Reports</p>
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
          onRangeChange={(nextFrom, nextTo) => {
            setFrom(nextFrom)
            setTo(nextTo)
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
        <StatCard title="Total Rentals" value={summary.totalRentals} icon={KeyRound} tone="brand" />
        <StatCard title="Rental Income" value={formatCurrency(summary.rentalIncome)} icon={KeyRound} tone="green" />
        <StatCard title="Paid Amount" value={formatCurrency(summary.paidAmount)} icon={KeyRound} tone="blue" />
        <StatCard title="Outstanding Amount" value={formatCurrency(summary.outstandingAmount)} icon={KeyRound} tone="red" />
        <StatCard title="Equipment Rented" value={summary.equipmentRented} icon={Package} tone="violet" />
        <StatCard title="Average Rental Value" value={formatCurrency(summary.averageRentalValue)} icon={KeyRound} tone="slate" />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Rental Status Summary
          </h2>
          <p className="text-sm text-slate-500">Count and amount by rental status</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {statusSummary.map((row) => (
            <div key={row.status} className="card p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <StatusBadge status={row.status} />
                <span className="text-sm text-slate-500">{row.count}</span>
              </div>
              <p className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {formatCurrency(row.amount)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <ChartCard title="Monthly Rental Income" subtitle="Rental income by month in selected period">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlyChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Bar dataKey="income" name="Rental Income" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <section className="space-y-4 no-print">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Rental Transaction Report
          </h2>
          <p className="text-sm text-slate-500">Detailed rentals for the selected period</p>
        </div>

        <div className="card p-4 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search rental ID, customer, equipment..."
              className="flex-1"
            />
            <FilterDropdown
              label="Customer"
              value={customerFilter}
              onChange={setCustomerFilter}
              options={customerOptions}
            />
            <FilterDropdown
              label="Rental Status"
              value={rentalStatusFilter}
              onChange={setRentalStatusFilter}
              options={[
                { value: '', label: 'All rental statuses' },
                ...RENTAL_STATUSES.map((s) => ({ value: s, label: s })),
              ]}
            />
            <FilterDropdown
              label="Payment Status"
              value={paymentStatusFilter}
              onChange={setPaymentStatusFilter}
              options={[
                { value: '', label: 'All payment statuses' },
                ...RENTAL_PAYMENT_STATUSES.map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <label className="text-sm text-slate-500">Sort</label>
            <select
              className="input-field !w-auto"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="startDate">Start Date</option>
              <option value="total">Amount</option>
              <option value="customer">Customer</option>
              <option value="status">Status</option>
            </select>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            >
              {sortDir === 'asc' ? 'Asc' : 'Desc'}
            </button>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Rental ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">Expected Return</th>
                  <th className="px-4 py-3">Actual Return</th>
                  <th className="px-4 py-3">Days</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paged.data.map((rental) => (
                  <tr key={rental.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{rental.rentalId}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{rental.customer}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{rental.product}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(rental.startDate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(rental.expectedReturn)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDateDMY(rental.actualReturnDate)}
                    </td>
                    <td className="px-4 py-3">{rental.duration}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(rental.total)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(rental.amountPaid)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(rental.balance)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={rental.rentalStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`/rentals/${rental.id}`}
                          className="btn-secondary !px-2 !py-1"
                          title="View Rental"
                        >
                          <Eye size={14} />
                        </Link>
                        {rental.customerId && (
                          <Link
                            to={`/customers/${rental.customerId}`}
                            className="btn-secondary !px-2 !py-1"
                            title="View Customer"
                          >
                            <User size={14} />
                          </Link>
                        )}
                        {rental.productId && (
                          <Link
                            to={`/products/${rental.productId}`}
                            className="btn-secondary !px-2 !py-1"
                            title="View Equipment"
                          >
                            <Package size={14} />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {paged.data.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                      No rentals in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 border-t border-slate-200 dark:border-slate-800">
            <Pagination
              page={paged.page}
              totalPages={paged.totalPages}
              total={paged.total}
              onChange={setPage}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Equipment Rental Usage
          </h2>
          <p className="text-sm text-slate-500">
            Usage derived from rental records in the selected period
          </p>
        </div>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3">Serial Number</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Times Rented</th>
                  <th className="px-4 py-3">Total Rental Days</th>
                  <th className="px-4 py-3">Rental Income</th>
                  <th className="px-4 py-3">Current Status</th>
                  <th className="px-4 py-3">Last Rented</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {equipmentUsage.map((row) => (
                  <tr key={row.productId || row.equipment}>
                    <td className="px-4 py-3 font-medium">
                      {row.productId ? (
                        <Link
                          to={`/products/${row.productId}`}
                          className="text-brand-600 hover:underline dark:text-brand-400"
                        >
                          {row.equipment}
                        </Link>
                      ) : (
                        row.equipment
                      )}
                    </td>
                    <td className="px-4 py-3">{row.serial_number}</td>
                    <td className="px-4 py-3">{row.category}</td>
                    <td className="px-4 py-3">{row.timesRented}</td>
                    <td className="px-4 py-3">{row.totalRentalDays}</td>
                    <td className="px-4 py-3">{formatCurrency(row.rentalIncome)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.currentStatus} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDateDMY(row.lastRentedDate)}
                    </td>
                  </tr>
                ))}
                {equipmentUsage.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                      No equipment usage in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-4 no-print">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Rental Activity by Customer
            </h2>
            <p className="text-sm text-slate-500">Customer rental history for the selected period</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SearchBar
              value={customerSearch}
              onChange={setCustomerSearch}
              placeholder="Search customer..."
              className="w-full sm:w-56"
            />
            <select
              className="input-field !w-auto"
              value={customerSort}
              onChange={(e) => setCustomerSort(e.target.value)}
            >
              <option value="rentalIncome">Sort by Income</option>
              <option value="numberOfRentals">Sort by # Rentals</option>
              <option value="customer">Sort by Name</option>
            </select>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3"># Rentals</th>
                  <th className="px-4 py-3">Equipment Items</th>
                  <th className="px-4 py-3">Rental Income</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Outstanding</th>
                  <th className="px-4 py-3">Last Rental</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {byCustomer.map((row) => (
                  <tr key={row.customerId || row.customer}>
                    <td className="px-4 py-3 font-medium">
                      {row.customerId ? (
                        <Link
                          to={`/customers/${row.customerId}`}
                          className="text-brand-600 hover:underline dark:text-brand-400"
                        >
                          {row.customer}
                        </Link>
                      ) : (
                        row.customer
                      )}
                    </td>
                    <td className="px-4 py-3">{row.numberOfRentals}</td>
                    <td className="px-4 py-3">{row.equipmentItems}</td>
                    <td className="px-4 py-3">{formatCurrency(row.rentalIncome)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.paid)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.outstanding)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDateDMY(row.lastRentalDate)}
                    </td>
                  </tr>
                ))}
                {byCustomer.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                      No customer rentals in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Rental Payment Status
          </h2>
          <p className="text-sm text-slate-500">Count and amount by payment status</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {paymentSummary.map((row) => (
            <div key={row.status} className="card p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <StatusBadge status={row.status} />
                <span className="text-sm text-slate-500">{row.count}</span>
              </div>
              <p className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {formatCurrency(row.amount)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Overdue Rentals
          </h2>
          <p className="text-sm text-slate-500">
            Rentals past expected return that have not been returned (all-time open overdue)
          </p>
        </div>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Rental ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3">Expected Return</th>
                  <th className="px-4 py-3">Days Overdue</th>
                  <th className="px-4 py-3">Current Amount</th>
                  <th className="px-4 py-3">Late Fee</th>
                  <th className="px-4 py-3">Payment Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {overdueRentals.map((rental) => (
                  <tr key={rental.id}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{rental.rentalId}</td>
                    <td className="px-4 py-3">{rental.customer}</td>
                    <td className="px-4 py-3">{rental.product}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDateDMY(rental.expectedReturn)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-red-600">{rental.daysOverdue}</td>
                    <td className="px-4 py-3">{formatCurrency(rental.currentAmount)}</td>
                    <td className="px-4 py-3">{formatCurrency(rental.lateFee)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={rental.paymentStatus} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/rentals/${rental.id}`} className="btn-secondary text-xs">
                        <Eye size={14} />
                        View Rental
                      </Link>
                    </td>
                  </tr>
                ))}
                {overdueRentals.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                      No overdue rentals.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <p className="text-xs text-slate-400 no-print">
        Showing {customers.length} customers in catalog · Report period {formatDateDMY(from)} —{' '}
        {formatDateDMY(to)}
      </p>
    </div>
  )
}
