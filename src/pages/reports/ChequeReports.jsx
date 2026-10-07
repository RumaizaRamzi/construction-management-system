import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, BadgeCheck, Ban, CalendarClock, Landmark, Printer } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import LoadingState from '../../components/ui/LoadingState'
import FilterDropdown from '../../components/ui/FilterDropdown'
import Pagination from '../../components/ui/Pagination'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import { ReportDateFilter, ReportExportButtons } from '../../components/reports'
import useReportQuery from '../../hooks/useReportQuery'
import chequeService from '../../services/chequeService'
import { formatCurrency, formatDateDMY, paginate } from '../../utils/helpers'
import BrandLogo from '../../components/ui/BrandLogo'
import { resolveReportDateRange } from '../../utils/reportHelpers'
import { CHEQUE_STATUSES, CHEQUE_TYPES, chequeTypeLabel } from '../../utils/chequeHelpers'

const PAGE_SIZE = 15

const VIEWS = [
  { value: 'all', label: 'All cheques' },
  { value: 'upcoming', label: 'Upcoming (pending, not yet due)' },
  { value: 'Overdue', label: 'Overdue (pending, past date)' },
  ...CHEQUE_STATUSES.map((s) => ({ value: s, label: s })),
]

export default function ChequeReports() {
  const initialRange = resolveReportDateRange('this_year')
  const [preset, setPreset] = useState('this_year')
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)
  const [view, setView] = useState('all')
  const [type, setType] = useState('all')
  const [page, setPage] = useState(1)

  const status = view === 'upcoming' ? 'Pending' : view
  const fetchReport = useCallback((params) => chequeService.getReport({ ...params, status, type }), [status, type])
  const { data, loading, error, reload } = useReportQuery(fetchReport, { from, to })

  const rows = useMemo(() => {
    const list = data?.cheques || []
    return view === 'upcoming' ? list.filter((c) => !c.isOverdue) : list
  }, [data, view])

  useEffect(() => setPage(1), [view, type, from, to])

  const paged = paginate(rows, page, PAGE_SIZE)
  const s = data?.summary
  const stat = (t) => (t ? `${t.count} · ${formatCurrency(t.amount)}` : '0')
  const viewLabel = VIEWS.find((v) => v.value === view)?.label || 'All cheques'
  const exportRows = rows.map((c) => ({
    ...c,
    typeLabel: chequeTypeLabel(c.type),
    displayStatus: c.isOverdue ? 'Overdue' : c.status,
  }))

  if (loading && !data) return <LoadingState label="Loading cheque report..." />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between no-print">
        <div>
          <Breadcrumbs items={[{ label: 'Reports', to: '/reports' }, { label: 'Cheque Reports' }]} />
          <h1 className="page-title">Cheque Reports</h1>
          <p className="page-subtitle">Pending, cleared, bounced and upcoming cheques by cheque date.</p>
          <p className="text-sm text-slate-500 mt-2">
            Report Period: {formatDateDMY(from)} – {formatDateDMY(to)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/reports" className="btn-secondary">
            <ArrowLeft size={16} />
            Reports
          </Link>
          <ReportExportButtons
            filename={`cheque-report-${from}-to-${to}`}
            getSheets={() => [
              {
                name: 'Cheques',
                columns: [
                  { key: 'chequeNumber', label: 'Cheque Number' },
                  { key: 'bank', label: 'Bank' },
                  { key: 'typeLabel', label: 'Type' },
                  { key: 'partyName', label: 'Customer / Supplier' },
                  { key: 'chequeDate', label: 'Cheque Date' },
                  { key: 'amount', label: 'Amount', value: (r) => Number(r.amount || 0) },
                  { key: 'displayStatus', label: 'Status' },
                  { key: 'referenceLabel', label: 'Linked To' },
                  { key: 'notes', label: 'Notes' },
                ],
                rows: exportRows,
              },
              {
                name: 'Summary',
                columns: [
                  { key: 'label', label: 'Group' },
                  { key: 'count', label: 'Cheques', value: (r) => Number(r.count || 0) },
                  { key: 'amount', label: 'Amount', value: (r) => Number(r.amount || 0) },
                ],
                rows: s
                  ? [
                      ['Pending', s.pending], ['Deposited', s.deposited], ['Cleared', s.cleared], ['Bounced', s.bounced],
                      ['Upcoming', s.upcoming], ['Overdue', s.overdue], ['Received', s.received], ['Issued', s.issued], ['Total', s.total],
                    ].map(([label, t]) => ({ label, ...t }))
                  : [],
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
        <p className="text-sm">Construction Management System — Cheque Report ({viewLabel})</p>
        <p className="text-sm mt-1">Report Period: {formatDateDMY(from)} – {formatDateDMY(to)}</p>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Pending" value={stat(s?.pending)} icon={Landmark} tone="brand" />
        <StatCard title="Upcoming" value={stat(s?.upcoming)} icon={CalendarClock} tone="blue" />
        <StatCard title="Overdue" value={stat(s?.overdue)} icon={AlertTriangle} tone="red" />
        <StatCard title="Cleared" value={stat(s?.cleared)} icon={BadgeCheck} tone="green" />
        <StatCard title="Bounced" value={stat(s?.bounced)} icon={Ban} tone="slate" />
      </div>

      <div className="card p-4 grid gap-3 sm:grid-cols-2 no-print">
        <FilterDropdown label="Report" value={view} onChange={setView} options={VIEWS} />
        <FilterDropdown label="Type" value={type} onChange={setType} options={[{ value: 'all', label: 'Received and issued' }, ...CHEQUE_TYPES]} />
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500 dark:border-slate-800">
          {viewLabel}: <span className="font-medium text-slate-800 dark:text-slate-200">{rows.length}</span> cheques ·{' '}
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {formatCurrency(rows.reduce((sum, c) => sum + Number(c.amount || 0), 0))}
          </span>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No cheques for the selected filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Cheque Number</th>
                    <th className="px-4 py-3">Bank</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Customer / Supplier</th>
                    <th className="px-4 py-3">Cheque Date</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Linked To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paged.data.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        <Link to={`/cheques/${c.id}`} className="hover:text-brand-600">{c.chequeNumber || `#${c.id}`}</Link>
                      </td>
                      <td className="px-4 py-3">{c.bank || '—'}</td>
                      <td className="px-4 py-3">{chequeTypeLabel(c.type)}</td>
                      <td className="px-4 py-3">{c.partyName || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(c.chequeDate)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrency(c.amount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.isOverdue ? 'Overdue' : c.status} /></td>
                      <td className="px-4 py-3">{c.referenceLabel || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 border-t border-slate-200 dark:border-slate-800 no-print">
              <Pagination page={paged.page} totalPages={paged.totalPages} total={paged.total} onChange={setPage} />
            </div>
          </>
        )}
      </section>
    </div>
  )
}
