import { useCallback, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import LoadingState from '../../components/ui/LoadingState'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import { ReportDateFilter } from '../../components/reports'
import { useApp } from '../../contexts/AppContext'
import useReportQuery from '../../hooks/useReportQuery'
import reportService from '../../services/reportService'
import { formatCurrency, formatDateDMY } from '../../utils/helpers'
import BrandLogo from '../../components/ui/BrandLogo'
import { resolveReportDateRange } from '../../utils/reportHelpers'
import {
  calculateCustomerActivityTimeline,
  calculateCustomerPaymentHistory,
  calculateCustomerTransactionHistory,
} from '../../utils/reportCalculations'

export default function CustomerTransactionReport() {
  const { customerId } = useParams()
  const { customers, sales, rentals, income, incomePayments } = useApp()

  const localCustomer = customers.find((c) => String(c.id) === String(customerId))

  const initialRange = resolveReportDateRange('this_year')
  const [preset, setPreset] = useState('this_year')
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)

  const fetchDetails = useCallback(
    (params) => reportService.getCustomerDetailsReport(customerId, params),
    [customerId]
  )
  const { data: apiReport, loading, error, reload } = useReportQuery(fetchDetails, {
    from,
    to,
    enabled: Boolean(customerId),
    extraKey: String(customerId || ''),
  })

  const customer = apiReport?.customer?.id
    ? {
        id: apiReport.customer.id,
        name: apiReport.customer.name,
        phone: apiReport.customer.phone,
        email: apiReport.customer.email,
        address: apiReport.customer.address,
        status: apiReport.customer.status,
        customerType: apiReport.customer.customerType,
        company: apiReport.customer.company,
      }
    : localCustomer

  const localHistory = useMemo(
    () =>
      calculateCustomerTransactionHistory(localCustomer, sales, rentals, { from, to }),
    [localCustomer, sales, rentals, from, to]
  )

  const history = useMemo(() => {
    if (!apiReport) return localHistory

    const mappedSales = (apiReport.sales || []).map((s) => ({
      ...s,
      invoiceNumber: s.invoice_number || s.invoiceNumber,
      date: s.sale_date || s.date,
      total: s.total ?? s.total_amount,
      amountPaid: s.paid_amount ?? s.amount_paid ?? s.amountPaid,
      balance: s.balance,
      paymentStatus: s.payment_status || s.paymentStatus,
    }))

    const mappedRentals = (apiReport.rentals || []).map((r) => ({
      ...r,
      rentalId: r.rental_number || r.rentalId,
      product: r.product || '—',
      startDate: r.start_date || r.startDate,
      expectedReturn: r.expected_return_date || r.expectedReturn,
      actualReturnDate: r.actual_return_date || r.actualReturnDate,
      total: r.total ?? r.total_amount,
      amountPaid: r.paid_amount ?? r.paid ?? r.amountPaid,
      balance: r.balance,
      rentalStatus: r.rental_status || r.status || r.rentalStatus,
    }))

    const totalSales = apiReport.summary?.salesRevenue ?? mappedSales.reduce((s, row) => s + (Number(row.total) || 0), 0)
    const totalRentals = apiReport.summary?.rentalRevenue ?? mappedRentals.reduce((s, row) => s + (Number(row.total) || 0), 0)
    const totalPaid =
      mappedSales.reduce((s, row) => s + (Number(row.amountPaid) || 0), 0) +
      mappedRentals.reduce((s, row) => s + (Number(row.amountPaid) || 0), 0)
    const totalOutstanding =
      apiReport.summary?.outstandingBalance ??
      mappedSales.reduce((s, row) => s + (Number(row.balance) || 0), 0) +
        mappedRentals.reduce((s, row) => s + (Number(row.balance) || 0), 0)

    return {
      customer,
      sales: mappedSales,
      rentals: mappedRentals,
      financialSummary: {
        totalSales,
        totalRentals,
        totalPaid,
        totalOutstanding,
      },
    }
  }, [apiReport, localHistory, customer])

  const payments = useMemo(() => {
    if (apiReport?.payments?.length) {
      return apiReport.payments.map((p, idx) => ({
        id: p.id || `pay-${idx}`,
        date: p.payment_date || p.date,
        reference: p.reference || p.related || '—',
        type: p.type || 'Payment',
        paymentMethod: p.payment_method || p.paymentMethod || '—',
        amount: Number(p.amount) || 0,
        status: p.status || 'Paid',
      }))
    }
    return calculateCustomerPaymentHistory({
      customerId,
      sales: history?.sales || [],
      rentals: history?.rentals || [],
      income,
      incomePayments,
    })
  }, [apiReport, customerId, history, income, incomePayments])

  const timeline = useMemo(() => {
    if (apiReport?.activityTimeline?.length) {
      return apiReport.activityTimeline.map((event, idx) => ({
        id: event.id || `evt-${idx}-${event.related_id || ''}`,
        date: event.date,
        activity: event.description || event.activity || event.type || 'Activity',
        reference: event.reference || event.type || '—',
        amount: Number(event.amount) || 0,
      }))
    }
    return calculateCustomerActivityTimeline({
      customerId,
      sales: history?.sales || [],
      rentals: history?.rentals || [],
      income,
      incomePayments,
    })
  }, [apiReport, customerId, history, income, incomePayments])

  if (!customerId) {
    return <Navigate to="/reports/customers" replace />
  }

  if (loading && !apiReport) {
    return <LoadingState label="Loading customer report..." />
  }

  if (!customer && !loading) {
    return <Navigate to="/reports/customers" replace />
  }

  if (!customer) {
    return <LoadingState label="Loading customer report..." />
  }

  const summary = history?.financialSummary

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between no-print">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Reports', to: '/reports' },
              { label: 'Customers', to: '/reports/customers' },
              { label: customer.name },
            ]}
          />
          <h1 className="page-title">Customer Transaction Report</h1>
          <p className="page-subtitle">{customer.name}</p>
          <p className="text-sm text-slate-500 mt-2">
            Report Period: {formatDateDMY(from)} – {formatDateDMY(to)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/reports/customers" className="btn-secondary">
            <ArrowLeft size={16} />
            Customer Reports
          </Link>
          <Link to={`/customers/${customer.id}`} className="btn-secondary">
            Customer Profile
          </Link>
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            <Printer size={16} />
            Print Report
          </button>
        </div>
      </div>

      <div className="print-only hidden mb-4">
        <BrandLogo className="mb-2 block h-16 w-16" />
        <h1 className="text-2xl font-bold">RN TRADING LANKA PVT. LTD</h1>
        <p className="text-sm">Customer Transaction Report — {customer.name}</p>
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

      <div className="card p-5">
        <h2 className="font-display font-semibold mb-3">Customer Information</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 text-sm">
          <div>
            <p className="text-slate-500">Name</p>
            <p className="font-medium">{customer.name}</p>
          </div>
          <div>
            <p className="text-slate-500">Phone</p>
            <p className="font-medium">{customer.phone || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500">Email</p>
            <p className="font-medium">{customer.email || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500">Address</p>
            <p className="font-medium">{customer.address || '—'}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Sales" value={formatCurrency(summary?.totalSales)} tone="green" />
        <StatCard title="Total Rentals" value={formatCurrency(summary?.totalRentals)} tone="blue" />
        <StatCard title="Total Paid" value={formatCurrency(summary?.totalPaid)} tone="brand" />
        <StatCard title="Total Outstanding" value={formatCurrency(summary?.totalOutstanding)} tone="red" />
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Sales History</h2>
        <div className="card overflow-hidden">
          {(history?.sales || []).length === 0 ? (
            <EmptyState title="No transaction history available." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Sale ID</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {history.sales.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3">
                        <Link to={`/sales/${s.id}`} className="text-brand-600 hover:underline">
                          {s.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(s.date)}</td>
                      <td className="px-4 py-3">{formatCurrency(s.total)}</td>
                      <td className="px-4 py-3">{formatCurrency(s.amountPaid)}</td>
                      <td className="px-4 py-3">{formatCurrency(s.balance)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.paymentStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Rental History</h2>
        <div className="card overflow-hidden">
          {(history?.rentals || []).length === 0 ? (
            <EmptyState title="No transaction history available." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Rental ID</th>
                    <th className="px-4 py-3">Equipment</th>
                    <th className="px-4 py-3">Start Date</th>
                    <th className="px-4 py-3">Return Date</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {history.rentals.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3">
                        <Link to={`/rentals/${r.id}`} className="text-brand-600 hover:underline">
                          {r.rentalId}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{r.product}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(r.startDate)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDateDMY(r.actualReturnDate || r.expectedReturn)}
                      </td>
                      <td className="px-4 py-3">{formatCurrency(r.total)}</td>
                      <td className="px-4 py-3">{formatCurrency(r.amountPaid)}</td>
                      <td className="px-4 py-3">{formatCurrency(r.balance)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.rentalStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Payment History</h2>
        <div className="card overflow-hidden">
          {payments.length === 0 ? (
            <EmptyState title="No transaction history available." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Payment Method</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(p.date)}</td>
                      <td className="px-4 py-3">{p.reference}</td>
                      <td className="px-4 py-3">{p.type}</td>
                      <td className="px-4 py-3">{p.paymentMethod}</td>
                      <td className="px-4 py-3">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Customer Activity Timeline</h2>
        <div className="card p-5">
          {timeline.length === 0 ? (
            <EmptyState title="No transaction history available." />
          ) : (
            <ol className="space-y-4">
              {timeline.slice(0, 30).map((event) => (
                <li key={event.id} className="flex gap-4 text-sm">
                  <div className="w-28 shrink-0 text-slate-500">{formatDateDMY(event.date)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 dark:text-white">{event.activity}</p>
                    <p className="text-slate-500">
                      {event.reference} · {formatCurrency(event.amount)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  )
}
