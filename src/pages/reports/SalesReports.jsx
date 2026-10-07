import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Eye,
  FileText,
  Printer,
  ShoppingCart,
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
  getMonthlySalesRevenue,
  getSalesByCustomer,
  getSalesByProduct,
  getSalesPaymentStatusSummary,
  getSalesReportSummary,
  filterSalesTransactions,
  sortSalesTransactions,
} from '../../utils/salesReportHelpers'

const PAGE_SIZE = 8

export default function SalesReports() {
  const { products, customers } = useApp()

  const initialRange = resolveReportDateRange('this_month')
  const [preset, setPreset] = useState('this_month')
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)

  const [search, setSearch] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('')
  const [saleStatusFilter, setSaleStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)

  const [customerSearch, setCustomerSearch] = useState('')
  const [customerSort, setCustomerSort] = useState('totalSales')

  const fetchSales = useCallback((params) => reportService.getSalesReport(params), [])
  const { data: apiReport, loading, error, reload } = useReportQuery(fetchSales, { from, to })

  const ranged = useMemo(() => {
    const rows = apiReport?.transactions || []
    return rows.map((s) => ({
      ...s,
      invoiceNumber: s.invoice_number || s.invoiceNumber,
      amountPaid: s.paid_amount ?? s.amount_paid ?? s.amountPaid,
      paymentStatus: s.payment_status || s.paymentStatus,
      saleStatus: s.sale_status || s.saleStatus,
      date: s.sale_date || s.date,
      total: s.total ?? s.total_amount,
    }))
  }, [apiReport])

  const summary = apiReport?.summary || getSalesReportSummary(ranged)
  const monthlyChart = apiReport?.monthly?.length
    ? apiReport.monthly
    : getMonthlySalesRevenue(ranged, from, to)
  const byProduct = apiReport?.byProduct?.length
    ? apiReport.byProduct
    : getSalesByProduct(ranged, products)
  const paymentSummary = apiReport?.paymentStatus?.length
    ? apiReport.paymentStatus.map((p) => ({
        status: p.status || p.name,
        count: p.count ?? p.value,
      }))
    : getSalesPaymentStatusSummary(ranged)

  const byCustomer = useMemo(() => {
    let rows = apiReport?.byCustomer?.length
      ? apiReport.byCustomer.map((r) => ({
          ...r,
          totalSales: r.totalSales ?? r.revenue,
          numberOfSales: r.numberOfSales ?? r.transaction_count,
        }))
      : getSalesByCustomer(ranged)
    const q = customerSearch.trim().toLowerCase()
    if (q) rows = rows.filter((r) => String(r.customer || '').toLowerCase().includes(q))
    rows = [...rows].sort((a, b) => {
      if (customerSort === 'customer') return String(a.customer).localeCompare(String(b.customer))
      if (customerSort === 'numberOfSales') return b.numberOfSales - a.numberOfSales
      return b.totalSales - a.totalSales
    })
    return rows
  }, [apiReport, ranged, customerSearch, customerSort])

  const filteredTx = useMemo(() => {
    const list = filterSalesTransactions(ranged, {
      search,
      customer: customerFilter,
      paymentStatus: paymentStatusFilter,
      saleStatus: saleStatusFilter,
    })
    return sortSalesTransactions(list, sortBy, sortDir)
  }, [ranged, search, customerFilter, paymentStatusFilter, saleStatusFilter, sortBy, sortDir])

  const paged = paginate(filteredTx, page, PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [search, customerFilter, paymentStatusFilter, saleStatusFilter, sortBy, sortDir, from, to])

  const customerOptions = useMemo(() => {
    const names = [...new Set(ranged.map((s) => s.customer).filter(Boolean))]
    return [{ value: '', label: 'All customers' }, ...names.map((n) => ({ value: n, label: n }))]
  }, [ranged])

  const saleStatuses = useMemo(() => {
    const statuses = [...new Set(ranged.map((s) => s.saleStatus).filter(Boolean))]
    return [{ value: '', label: 'All sale statuses' }, ...statuses.map((s) => ({ value: s, label: s }))]
  }, [ranged])

  if (loading && !apiReport) {
    return <LoadingState label="Loading sales report..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between no-print">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Reports', to: '/reports' },
              { label: 'Sales Reports' },
            ]}
          />
          <h1 className="page-title">Sales Reports</h1>
          <p className="page-subtitle">
            Analyze sales transactions, products, customers and sales revenue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/reports" className="btn-secondary">
            <ArrowLeft size={16} />
            Reports
          </Link>
          <Link to="/sales" className="btn-secondary">
            <ShoppingCart size={16} />
            View Sales
          </Link>
          <Link to="/invoices" className="btn-secondary">
            <FileText size={16} />
            View Invoices
          </Link>
          <ReportExportButtons
            filename={`sales-report-${from}-to-${to}`}
            getSheets={() => [
              {
                name: 'Transactions',
                columns: [
                  { key: 'invoiceNumber', label: 'Invoice' },
                  { key: 'date', label: 'Date' },
                  { key: 'customer', label: 'Customer' },
                  { key: 'products', label: 'Items' },
                  { key: 'total', label: 'Total', value: (r) => Number(r.total || 0) },
                  { key: 'amountPaid', label: 'Paid', value: (r) => Number(r.amountPaid || 0) },
                  { key: 'balance', label: 'Balance', value: (r) => Number(r.balance || 0) },
                  { key: 'paymentStatus', label: 'Payment Status' },
                  { key: 'saleStatus', label: 'Sale Status' },
                ],
                rows: filteredTx,
              },
              {
                name: 'By Product',
                columns: [
                  { key: 'product', label: 'Product' },
                  { key: 'serial_number', label: 'Serial Number' },
                  { key: 'category', label: 'Category' },
                  { key: 'quantitySold', label: 'Qty Sold', value: (r) => Number(r.quantitySold || 0) },
                  { key: 'numberOfSales', label: '# Sales', value: (r) => Number(r.numberOfSales || 0) },
                  { key: 'revenue', label: 'Revenue', value: (r) => Number(r.revenue || 0) },
                  { key: 'lastSoldDate', label: 'Last Sold' },
                ],
                rows: byProduct,
              },
              {
                name: 'By Customer',
                columns: [
                  { key: 'customer', label: 'Customer' },
                  { key: 'numberOfSales', label: '# Sales', value: (r) => Number(r.numberOfSales || 0) },
                  { key: 'itemsPurchased', label: 'Items Purchased', value: (r) => Number(r.itemsPurchased || 0) },
                  { key: 'totalSales', label: 'Total Sales', value: (r) => Number(r.totalSales || 0) },
                  { key: 'paid', label: 'Paid', value: (r) => Number(r.paid || 0) },
                  { key: 'outstanding', label: 'Outstanding', value: (r) => Number(r.outstanding || 0) },
                  { key: 'lastPurchase', label: 'Last Purchase' },
                ],
                rows: byCustomer,
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
        <p className="text-sm">Construction Management System — Sales Reports</p>
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
        <StatCard title="Total Sales" value={summary.totalSales} icon={ShoppingCart} tone="brand" />
        <StatCard title="Sales Revenue" value={formatCurrency(summary.salesRevenue)} icon={ShoppingCart} tone="green" />
        <StatCard title="Paid Amount" value={formatCurrency(summary.paidAmount)} icon={ShoppingCart} tone="blue" />
        <StatCard title="Outstanding Amount" value={formatCurrency(summary.outstandingAmount)} icon={ShoppingCart} tone="red" />
        <StatCard title="Items Sold" value={summary.itemsSold} icon={ShoppingCart} tone="violet" />
        <StatCard title="Average Sale Value" value={formatCurrency(summary.averageSaleValue)} icon={ShoppingCart} tone="slate" />
      </div>

      <ChartCard title="Monthly Sales Revenue" subtitle="Sales revenue by month in selected period">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlyChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Bar dataKey="revenue" name="Sales Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <section className="space-y-4 no-print">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Sales Transaction Report
          </h2>
          <p className="text-sm text-slate-500">Detailed sales for the selected period</p>
        </div>

        <div className="card p-4 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search invoice, customer..."
              className="flex-1"
            />
            <FilterDropdown
              label="Customer"
              value={customerFilter}
              onChange={setCustomerFilter}
              options={customerOptions}
            />
            <FilterDropdown
              label="Payment Status"
              value={paymentStatusFilter}
              onChange={setPaymentStatusFilter}
              options={[
                { value: '', label: 'All payment statuses' },
                { value: 'Paid', label: 'Paid' },
                { value: 'Partial', label: 'Partial' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Overdue', label: 'Overdue' },
              ]}
            />
            <FilterDropdown
              label="Sale Status"
              value={saleStatusFilter}
              onChange={setSaleStatusFilter}
              options={saleStatuses}
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <label className="text-sm text-slate-500">Sort</label>
            <select
              className="input-field !w-auto"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="date">Date</option>
              <option value="total">Amount</option>
              <option value="customer">Customer</option>
              <option value="paymentStatus">Payment Status</option>
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
                  <th className="px-4 py-3">Invoice / Sale ID</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Total Amount</th>
                  <th className="px-4 py-3">Paid Amount</th>
                  <th className="px-4 py-3">Balance</th>
                  <th className="px-4 py-3">Payment Status</th>
                  <th className="px-4 py-3">Sale Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paged.data.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{sale.invoiceNumber}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(sale.date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{sale.customer}</td>
                    <td className="px-4 py-3 max-w-[180px] truncate">{sale.products}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(sale.total)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(sale.amountPaid)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(sale.balance)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sale.paymentStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sale.saleStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link to={`/sales/${sale.id}`} className="btn-secondary !px-2 !py-1" title="View">
                          <Eye size={14} />
                        </Link>
                        <Link
                          to={`/sales/${sale.id}/invoice`}
                          className="btn-secondary !px-2 !py-1"
                          title="View Invoice"
                        >
                          <FileText size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {paged.data.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      No sales in this period.
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
            Sales by Product
          </h2>
          <p className="text-sm text-slate-500">Quantity sold and revenue by product</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Serial Number</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Qty Sold</th>
                    <th className="px-4 py-3"># Sales</th>
                    <th className="px-4 py-3">Revenue</th>
                    <th className="px-4 py-3">Last Sold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {byProduct.map((row) => (
                    <tr key={`${row.productId}-${row.serial_number}`}>
                      <td className="px-4 py-3 font-medium">{row.product}</td>
                      <td className="px-4 py-3">{row.serial_number}</td>
                      <td className="px-4 py-3">{row.category}</td>
                      <td className="px-4 py-3">{row.quantitySold}</td>
                      <td className="px-4 py-3">{row.numberOfSales}</td>
                      <td className="px-4 py-3">{formatCurrency(row.revenue)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(row.lastSoldDate)}</td>
                    </tr>
                  ))}
                  {byProduct.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        No product sales in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <ChartCard title="Top-Selling Products by Quantity" subtitle="Quantity sold in selected period">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProduct.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="product" width={110} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="quantitySold" name="Quantity Sold" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>

      <section className="space-y-4 no-print">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Sales by Customer
            </h2>
            <p className="text-sm text-slate-500">Customer purchase activity</p>
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
              <option value="totalSales">Sort by Total Sales</option>
              <option value="numberOfSales">Sort by # Sales</option>
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
                  <th className="px-4 py-3"># Sales</th>
                  <th className="px-4 py-3">Items Purchased</th>
                  <th className="px-4 py-3">Total Sales</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Outstanding</th>
                  <th className="px-4 py-3">Last Purchase</th>
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
                    <td className="px-4 py-3">{row.numberOfSales}</td>
                    <td className="px-4 py-3">{row.itemsPurchased}</td>
                    <td className="px-4 py-3">{formatCurrency(row.totalSales)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.paid)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.outstanding)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(row.lastPurchase)}</td>
                  </tr>
                ))}
                {byCustomer.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                      No customer sales in this period.
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
            Sales Payment Status
          </h2>
          <p className="text-sm text-slate-500">Transaction count and amount by payment status</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {paymentSummary.map((row) => (
            <div key={row.status} className="card p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <StatusBadge status={row.status} />
                <span className="text-sm text-slate-500">{row.count} txns</span>
              </div>
              <p className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(row.amount)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-slate-400 no-print">
        Showing {customers.length} customers in catalog · Report period {formatDateDMY(from)} —{' '}
        {formatDateDMY(to)}
      </p>
    </div>
  )
}
