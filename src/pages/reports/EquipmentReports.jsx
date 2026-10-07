import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Eye, Printer, Wrench } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import LoadingState from '../../components/ui/LoadingState'
import SearchBar from '../../components/ui/SearchBar'
import FilterDropdown from '../../components/ui/FilterDropdown'
import Pagination from '../../components/ui/Pagination'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import { ReportDateFilter, ReportExportButtons } from '../../components/reports'
import { useApp } from '../../contexts/AppContext'
import useReportQuery from '../../hooks/useReportQuery'
import reportService from '../../services/reportService'
import { formatCurrency, formatDateDMY, paginate } from '../../utils/helpers'
import BrandLogo from '../../components/ui/BrandLogo'
import { resolveReportDateRange } from '../../utils/reportHelpers'
import {
  calculateEquipmentCheckHistory,
  calculateEquipmentMaintenanceHistory,
  calculateEquipmentStatus,
} from '../../utils/reportCalculations'
import { MAINTENANCE_STATUSES } from '../../data/maintenanceData'
import { CHECK_STATUSES } from '../../data/checksData'

const PAGE_SIZE = 8

export default function EquipmentReports() {
  const { products, rentals, maintenance, checks } = useApp()

  const initialRange = resolveReportDateRange('this_year')
  const [preset, setPreset] = useState('this_year')
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const [maintProduct, setMaintProduct] = useState('')
  const [maintStatus, setMaintStatus] = useState('')
  const [maintSearch, setMaintSearch] = useState('')

  const [checkProduct, setCheckProduct] = useState('')
  const [checkStatus, setCheckStatus] = useState('')
  const [checkSearch, setCheckSearch] = useState('')

  const fetchEquipment = useCallback(() => reportService.getEquipmentReport(), [])
  const { data: apiReport, loading, error, reload } = useReportQuery(fetchEquipment, {
    from,
    to,
  })

  const localEquipment = useMemo(
    () => calculateEquipmentStatus(products, rentals, maintenance),
    [products, rentals, maintenance]
  )

  const equipment = useMemo(() => {
    if (apiReport?.equipment) {
      const rows = apiReport.equipment.map((row) => {
        const product = products.find((p) => Number(p.id) === Number(row.id))
        return {
          productId: row.id,
          equipment: row.product || product?.name || '—',
          serial_number: row.serial_number || product?.serial_number || '—',
          category: product?.category || '—',
          condition: row.condition || product?.condition || '—',
          currentStatus: row.status || product?.status || '—',
          rentalCount: row.rentalCount ?? 0,
          totalRentalDays: row.rentalDays ?? row.totalRentalDays ?? 0,
          rentalIncome: row.rentalIncome ?? 0,
          lastRental: row.lastRentalDate || row.lastRental || null,
          lastMaintenance: row.lastMaintenanceDate || row.lastMaintenance || null,
        }
      })

      const summary = {
        totalEquipment: rows.length,
        available: rows.filter((r) => String(r.currentStatus).toLowerCase() === 'available')
          .length,
        rented: rows.filter((r) => String(r.currentStatus).toLowerCase() === 'rented').length,
        reserved: rows.filter((r) => String(r.currentStatus).toLowerCase() === 'reserved')
          .length,
        maintenance: rows.filter(
          (r) => String(r.currentStatus).toLowerCase() === 'maintenance'
        ).length,
        inactive: rows.filter((r) => String(r.currentStatus).toLowerCase() === 'inactive')
          .length,
      }

      return { rows, summary }
    }
    return localEquipment
  }, [apiReport, products, localEquipment])

  const filteredEquipment = useMemo(() => {
    let rows = equipment.rows
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (r) =>
          String(r.equipment || '').toLowerCase().includes(q) ||
          String(r.serial_number || '').toLowerCase().includes(q) ||
          String(r.category || '').toLowerCase().includes(q)
      )
    }
    if (statusFilter) rows = rows.filter((r) => r.currentStatus === statusFilter)
    return rows
  }, [equipment.rows, search, statusFilter])

  const paged = paginate(filteredEquipment, page, PAGE_SIZE)

  const maintenanceHistory = useMemo(
    () =>
      calculateEquipmentMaintenanceHistory(maintenance, {
        from,
        to,
        productId: maintProduct,
        status: maintStatus,
        search: maintSearch,
      }),
    [maintenance, from, to, maintProduct, maintStatus, maintSearch]
  )

  const checkHistory = useMemo(
    () =>
      calculateEquipmentCheckHistory(checks, {
        from,
        to,
        productId: checkProduct,
        status: checkStatus,
        search: checkSearch,
      }),
    [checks, from, to, checkProduct, checkStatus, checkSearch]
  )

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  const productOptions = useMemo(() => {
    const source = apiReport?.equipment
      ? apiReport.equipment.map((e) => ({ id: e.id, name: e.product }))
      : products
    return [
      { value: '', label: 'All equipment' },
      ...source.map((p) => ({ value: String(p.id), label: p.name || p.product })),
    ]
  }, [apiReport, products])

  const statuses = useMemo(
    () => [...new Set(equipment.rows.map((r) => r.currentStatus).filter(Boolean))],
    [equipment.rows]
  )

  const { summary } = equipment

  if (loading && !apiReport) {
    return <LoadingState label="Loading equipment report..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between no-print">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Reports', to: '/reports' },
              { label: 'Equipment Reports' },
            ]}
          />
          <h1 className="page-title">Equipment Reports</h1>
          <p className="page-subtitle">
            Monitor equipment status, rental activity, maintenance and check history.
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
          <Link to="/reports/inventory" className="btn-secondary">
            Inventory
          </Link>
          <ReportExportButtons
            filename={`equipment-report-${from}-to-${to}`}
            getSheets={() => [
              {
                name: 'Equipment',
                columns: [
                  { key: 'equipment', label: 'Equipment' },
                  { key: 'serial_number', label: 'Serial Number' },
                  { key: 'category', label: 'Category' },
                  { key: 'condition', label: 'Condition' },
                  { key: 'currentStatus', label: 'Status' },
                  { key: 'rentalCount', label: 'Rentals', value: (r) => Number(r.rentalCount || 0) },
                  { key: 'totalRentalDays', label: 'Rental Days', value: (r) => Number(r.totalRentalDays || 0) },
                  { key: 'rentalIncome', label: 'Rental Income', value: (r) => Number(r.rentalIncome || 0) },
                  { key: 'lastRental', label: 'Last Rental' },
                  { key: 'lastMaintenance', label: 'Last Maintenance' },
                ],
                rows: filteredEquipment,
              },
              {
                name: 'Maintenance',
                columns: [
                  { key: 'maintenanceId', label: 'Maintenance ID' },
                  { key: 'equipment', label: 'Equipment' },
                  { key: 'maintenanceType', label: 'Type' },
                  { key: 'date', label: 'Date' },
                  { key: 'status', label: 'Status' },
                  { key: 'cost', label: 'Cost', value: (r) => (r.cost == null ? '' : Number(r.cost)) },
                  { key: 'nextMaintenance', label: 'Expected Completion' },
                  { key: 'notes', label: 'Notes' },
                ],
                rows: maintenanceHistory,
              },
              {
                name: 'Checks',
                columns: [
                  { key: 'checkId', label: 'Check ID' },
                  { key: 'equipment', label: 'Equipment' },
                  { key: 'checkType', label: 'Check' },
                  { key: 'scheduledDate', label: 'Scheduled' },
                  { key: 'completedDate', label: 'Completed' },
                  { key: 'status', label: 'Status' },
                  { key: 'notes', label: 'Notes' },
                ],
                rows: checkHistory,
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
        <p className="text-sm">Construction Management System — Equipment Reports</p>
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
        <StatCard title="Total Equipment" value={summary.totalEquipment} icon={Wrench} tone="brand" />
        <StatCard title="Available" value={summary.available} icon={Wrench} tone="green" />
        <StatCard title="Rented" value={summary.rented} icon={Wrench} tone="blue" />
        <StatCard title="Reserved" value={summary.reserved} icon={Wrench} tone="violet" />
        <StatCard title="Maintenance" value={summary.maintenance} icon={Wrench} tone="red" />
        <StatCard title="Inactive" value={summary.inactive} icon={Wrench} tone="slate" />
      </div>

      <section className="space-y-4 no-print">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Equipment Status
          </h2>
        </div>
        <div className="card p-4 flex flex-col gap-3 lg:flex-row">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search equipment..."
            className="flex-1"
          />
          <FilterDropdown
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: '', label: 'All statuses' },
              ...statuses.map((s) => ({ value: s, label: s })),
            ]}
          />
        </div>
        <div className="card overflow-hidden">
          {paged.data.length === 0 ? (
            <EmptyState title="No equipment records available." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                      <th className="px-4 py-3">Equipment</th>
                      <th className="px-4 py-3">Serial Number</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Condition</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Rental Count</th>
                      <th className="px-4 py-3">Rental Days</th>
                      <th className="px-4 py-3">Rental Income</th>
                      <th className="px-4 py-3">Last Rental</th>
                      <th className="px-4 py-3">Last Maintenance</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paged.data.map((row) => (
                      <tr key={row.productId}>
                        <td className="px-4 py-3 font-medium">{row.equipment}</td>
                        <td className="px-4 py-3">{row.serial_number}</td>
                        <td className="px-4 py-3">{row.category}</td>
                        <td className="px-4 py-3">{row.condition}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.currentStatus} />
                        </td>
                        <td className="px-4 py-3">{row.rentalCount}</td>
                        <td className="px-4 py-3">{row.totalRentalDays}</td>
                        <td className="px-4 py-3">{formatCurrency(row.rentalIncome)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatDateDMY(row.lastRental)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatDateDMY(row.lastMaintenance)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/products/${row.productId}/usage`}
                            className="btn-secondary text-xs"
                          >
                            <Eye size={14} />
                            View Usage
                          </Link>
                        </td>
                      </tr>
                    ))}
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
            </>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Equipment Maintenance History
          </h2>
        </div>
        <div className="card p-4 flex flex-col gap-3 lg:flex-row no-print">
          <SearchBar
            value={maintSearch}
            onChange={setMaintSearch}
            placeholder="Search maintenance..."
            className="flex-1"
          />
          <FilterDropdown
            label="Equipment"
            value={maintProduct}
            onChange={setMaintProduct}
            options={productOptions}
          />
          <FilterDropdown
            label="Status"
            value={maintStatus}
            onChange={setMaintStatus}
            options={[
              { value: '', label: 'All statuses' },
              ...MAINTENANCE_STATUSES.map((s) => ({ value: s, label: s })),
            ]}
          />
        </div>
        <div className="card overflow-hidden">
          {maintenanceHistory.length === 0 ? (
            <EmptyState title="No maintenance history available." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Equipment</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Cost</th>
                    <th className="px-4 py-3">Next Maintenance</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {maintenanceHistory.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-medium">{row.equipment}</td>
                      <td className="px-4 py-3">{row.maintenanceType}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(row.date)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3">
                        {row.cost == null ? '—' : formatCurrency(row.cost)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDateDMY(row.nextMaintenance)}
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-slate-500">
                        {row.notes || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/maintenance/${row.id}`} className="btn-secondary text-xs">
                          View
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
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Equipment Check History
          </h2>
        </div>
        <div className="card p-4 flex flex-col gap-3 lg:flex-row no-print">
          <SearchBar
            value={checkSearch}
            onChange={setCheckSearch}
            placeholder="Search checks..."
            className="flex-1"
          />
          <FilterDropdown
            label="Equipment"
            value={checkProduct}
            onChange={setCheckProduct}
            options={productOptions}
          />
          <FilterDropdown
            label="Status"
            value={checkStatus}
            onChange={setCheckStatus}
            options={[
              { value: '', label: 'All statuses' },
              ...CHECK_STATUSES.map((s) => ({ value: s, label: s })),
            ]}
          />
        </div>
        <div className="card overflow-hidden">
          {checkHistory.length === 0 ? (
            <EmptyState title="No equipment check history available for the selected filters." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Check ID</th>
                    <th className="px-4 py-3">Equipment</th>
                    <th className="px-4 py-3">Check Type</th>
                    <th className="px-4 py-3">Scheduled</th>
                    <th className="px-4 py-3">Completed</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {checkHistory.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{row.checkId}</td>
                      <td className="px-4 py-3">{row.equipment}</td>
                      <td className="px-4 py-3">{row.checkType}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDateDMY(row.scheduledDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDateDMY(row.completedDate)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3">{row.result}</td>
                      <td className="px-4 py-3 max-w-[180px] truncate text-slate-500">
                        {row.notes || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/checks/${row.id}`} className="btn-secondary text-xs">
                          View
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
