import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Eye,
  History,
  Package,
  Printer,
  AlertTriangle,
} from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import LoadingState from '../../components/ui/LoadingState'
import SearchBar from '../../components/ui/SearchBar'
import FilterDropdown from '../../components/ui/FilterDropdown'
import Pagination from '../../components/ui/Pagination'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import ProductImage from '../../components/ui/ProductImage'
import EmptyState from '../../components/ui/EmptyState'
import { ReportDateFilter, ReportExportButtons } from '../../components/reports'
import { useApp } from '../../contexts/AppContext'
import useReportQuery from '../../hooks/useReportQuery'
import reportService from '../../services/reportService'
import { formatCurrency, formatDateDMY, paginate } from '../../utils/helpers'
import BrandLogo from '../../components/ui/BrandLogo'
import { resolveReportDateRange } from '../../utils/reportHelpers'
import {
  calculateInventoryByStatus,
  calculateInventorySummary,
  calculateLowStockProducts,
  calculateStockMovement,
  calculateStockMovementSummary,
  getInventoryOverviewRows,
} from '../../utils/reportCalculations'

const PAGE_SIZE = 8

export default function InventoryReports() {
  const { products, bookings, stockHistory } = useApp()

  const initialRange = resolveReportDateRange('this_year')
  const [preset, setPreset] = useState('this_year')
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [movementSearch, setMovementSearch] = useState('')

  const fetchInventory = useCallback(() => reportService.getInventoryReport(), [])
  const { data: apiReport, loading, error, reload } = useReportQuery(fetchInventory, {
    from,
    to,
  })

  const apiProducts = useMemo(() => {
    if (!apiReport?.products) return null
    return apiReport.products.map((row) => ({
      id: row.id,
      name: row.name || row.product,
      product: row.product || row.name,
      serial_number: row.serial_number,
      category: row.category,
      quantity: row.quantity,
      available: row.available,
      rented: row.rented,
      maintenance: row.maintenance,
      sold: row.sold,
      status: row.status,
      minStock: row.minStock,
      image: products.find((p) => Number(p.id) === Number(row.id))?.image,
    }))
  }, [apiReport, products])

  const inventorySource = apiProducts ?? products

  const localSummary = useMemo(
    () => calculateInventorySummary(inventorySource),
    [inventorySource]
  )
  const summary = apiReport?.summary
    ? {
        totalProducts: apiReport.summary.totalProducts ?? localSummary.totalProducts,
        totalAvailable: apiReport.summary.availableQuantity ?? localSummary.totalAvailable,
        currentlyRented: apiReport.summary.rentedQuantity ?? localSummary.currentlyRented,
        underMaintenance:
          apiReport.summary.maintenanceQuantity ?? localSummary.underMaintenance,
        lowStock: apiReport.summary.lowStockCount ?? localSummary.lowStock,
        totalInventoryValue: localSummary.totalInventoryValue,
        hasCost: localSummary.hasCost,
      }
    : localSummary

  const statusBreakdown = useMemo(
    () => calculateInventoryByStatus(inventorySource),
    [inventorySource]
  )
  const lowStock = useMemo(
    () => calculateLowStockProducts(inventorySource),
    [inventorySource]
  )

  const overviewRows = useMemo(() => {
    let rows = apiProducts
      ? apiProducts.map((p) => {
          let stockStatus = 'OK'
          if (Number(p.available) <= 0) stockStatus = 'Out of Stock'
          else if (Number(p.available) <= Number(p.minStock || 0)) stockStatus = 'Low Stock'
          return {
            id: p.id,
            image: p.image,
            name: p.name,
            serial_number: p.serial_number || '—',
            category: p.category || '—',
            totalQuantity: Number(p.quantity) || 0,
            availableQuantity: Number(p.available) || 0,
            rentedQuantity: Number(p.rented) || 0,
            reservedQuantity: 0,
            maintenanceQuantity: Number(p.maintenance) || 0,
            minimumStock: Number(p.minStock) || 0,
            stockStatus,
            currentStatus: p.status || '—',
          }
        })
      : getInventoryOverviewRows(products, bookings || [])
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (r) =>
          String(r.name || '').toLowerCase().includes(q) ||
          String(r.serial_number || '').toLowerCase().includes(q) ||
          String(r.category || '').toLowerCase().includes(q)
      )
    }
    if (categoryFilter) rows = rows.filter((r) => r.category === categoryFilter)
    if (statusFilter) rows = rows.filter((r) => r.currentStatus === statusFilter)
    return rows
  }, [apiProducts, products, bookings, search, categoryFilter, statusFilter])

  const paged = paginate(overviewRows, page, PAGE_SIZE)

  const movements = useMemo(
    () => calculateStockMovement(stockHistory || [], { from, to, search: movementSearch }),
    [stockHistory, from, to, movementSearch]
  )
  const movementSummary = useMemo(
    () => calculateStockMovementSummary(movements),
    [movements]
  )

  useEffect(() => {
    setPage(1)
  }, [search, categoryFilter, statusFilter])

  const categories = useMemo(
    () => [...new Set(inventorySource.map((p) => p.category).filter(Boolean))],
    [inventorySource]
  )
  const statuses = useMemo(
    () => [...new Set(inventorySource.map((p) => p.status).filter(Boolean))],
    [inventorySource]
  )

  if (loading && !apiReport) {
    return <LoadingState label="Loading inventory report..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between no-print">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Reports', to: '/reports' },
              { label: 'Inventory Reports' },
            ]}
          />
          <h1 className="page-title">Inventory Reports</h1>
          <p className="page-subtitle">
            Monitor equipment stock, availability, movement and current inventory status.
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
          <Link to="/reports/inventory/usage" className="btn-secondary">
            Product Usage
          </Link>
          <Link to="/reports/equipment" className="btn-secondary">
            Equipment
          </Link>
          <ReportExportButtons
            filename={`inventory-report-${from}-to-${to}`}
            getSheets={() => [
              {
                name: 'Inventory',
                columns: [
                  { key: 'name', label: 'Product' },
                  { key: 'serial_number', label: 'Serial Number' },
                  { key: 'category', label: 'Category' },
                  { key: 'totalQuantity', label: 'Total Qty' },
                  { key: 'availableQuantity', label: 'Available' },
                  { key: 'rentedQuantity', label: 'Rented' },
                  { key: 'maintenanceQuantity', label: 'Maintenance' },
                  { key: 'minimumStock', label: 'Minimum Stock' },
                  { key: 'stockStatus', label: 'Stock Status' },
                  { key: 'currentStatus', label: 'Product Status' },
                ],
                rows: overviewRows,
              },
              {
                name: 'Low Stock',
                columns: [
                  { key: 'product', label: 'Product' },
                  { key: 'serial_number', label: 'Serial Number' },
                  { key: 'category', label: 'Category' },
                  { key: 'availableQuantity', label: 'Available' },
                  { key: 'minimumStock', label: 'Minimum Stock' },
                  { key: 'difference', label: 'Difference' },
                  { key: 'status', label: 'Status' },
                ],
                rows: lowStock,
              },
              {
                name: 'Stock Movements',
                columns: [
                  { key: 'date', label: 'Date' },
                  { key: 'reference', label: 'Reference' },
                  { key: 'product', label: 'Product' },
                  { key: 'movementType', label: 'Movement' },
                  { key: 'quantity', label: 'Quantity' },
                  { key: 'previousQuantity', label: 'Previous Qty' },
                  { key: 'newQuantity', label: 'New Qty' },
                  { key: 'relatedParty', label: 'User / Party' },
                  { key: 'notes', label: 'Notes' },
                ],
                rows: movements,
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
        <p className="text-sm">Construction Management System — Inventory Reports</p>
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
        <StatCard title="Total Products" value={summary.totalProducts} icon={Package} tone="brand" />
        <StatCard title="Total Available" value={summary.totalAvailable} icon={Package} tone="green" />
        <StatCard title="Currently Rented" value={summary.currentlyRented} icon={Package} tone="blue" />
        <StatCard title="Under Maintenance" value={summary.underMaintenance} icon={Package} tone="violet" />
        <StatCard title="Low Stock" value={summary.lowStock} icon={AlertTriangle} tone="red" />
        <StatCard
          title="Total Inventory Value"
          value={
            summary.hasCost ? formatCurrency(summary.totalInventoryValue) : '—'
          }
          icon={Package}
          tone="slate"
          trend={summary.hasCost ? 'Based on purchase cost × quantity' : 'Cost data unavailable'}
        />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Inventory Status Summary
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {statusBreakdown.map((row) => (
            <div key={row.status} className="card p-4">
              <p className="text-sm text-slate-500">{row.status}</p>
              <p className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-white">
                {row.quantity}
              </p>
              <p className="text-xs text-slate-400 mt-1">{row.percentage}%</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 no-print">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Inventory Overview
          </h2>
        </div>
        <div className="card p-4 flex flex-col gap-3 lg:flex-row">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search product, serial number, category..."
            className="flex-1"
          />
          <FilterDropdown
            label="Category"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: '', label: 'All categories' },
              ...categories.map((c) => ({ value: c, label: c })),
            ]}
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
            <EmptyState
              title="No inventory records available."
              description="Adjust filters or add products to the catalog."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                      <th className="px-4 py-3">Image</th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Serial Number</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Available</th>
                      <th className="px-4 py-3">Rented</th>
                      <th className="px-4 py-3">Reserved</th>
                      <th className="px-4 py-3">Maintenance</th>
                      <th className="px-4 py-3">Min Stock</th>
                      <th className="px-4 py-3">Stock Status</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paged.data.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3">
                          <ProductImage src={row.image} alt={row.name} className="h-10 w-10" />
                        </td>
                        <td className="px-4 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3">{row.serial_number}</td>
                        <td className="px-4 py-3">{row.category}</td>
                        <td className="px-4 py-3">{row.totalQuantity}</td>
                        <td className="px-4 py-3">{row.availableQuantity}</td>
                        <td className="px-4 py-3">{row.rentedQuantity}</td>
                        <td className="px-4 py-3">{row.reservedQuantity}</td>
                        <td className="px-4 py-3">{row.maintenanceQuantity}</td>
                        <td className="px-4 py-3">{row.minimumStock}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.stockStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.currentStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Link
                              to={`/products/${row.id}`}
                              className="btn-secondary !px-2 !py-1"
                              title="View Product"
                            >
                              <Eye size={14} />
                            </Link>
                            <Link
                              to={`/products/${row.id}/usage`}
                              className="btn-secondary !px-2 !py-1"
                              title="View Usage"
                            >
                              <Package size={14} />
                            </Link>
                            <Link
                              to={`/products/${row.id}`}
                              className="btn-secondary !px-2 !py-1"
                              title="View History"
                            >
                              <History size={14} />
                            </Link>
                          </div>
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
            Stock Movement Summary
          </h2>
          <p className="text-sm text-slate-500">
            Calculated from stock history in the selected period
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Stock Added" value={movementSummary.stockAdded} icon={Package} tone="green" />
          <StatCard title="Stock Sold" value={movementSummary.stockSold} icon={Package} tone="blue" />
          <StatCard title="Stock Rented" value={movementSummary.stockRented} icon={Package} tone="violet" />
          <StatCard title="Stock Returned" value={movementSummary.stockReturned} icon={Package} tone="brand" />
          <StatCard title="Stock Adjustments" value={movementSummary.stockAdjustments} icon={Package} tone="slate" />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Stock Movement
            </h2>
            <p className="text-sm text-slate-500">Inventory changes for the selected period</p>
          </div>
          <SearchBar
            value={movementSearch}
            onChange={setMovementSearch}
            placeholder="Search movement..."
            className="w-full sm:w-64 no-print"
          />
        </div>
        <div className="card overflow-hidden">
          {movements.length === 0 ? (
            <EmptyState
              title="No stock movement records available for the selected period."
              description="Stock movements appear here when purchase, sale, rental, or adjustment history exists."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Movement Type</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Previous Qty</th>
                    <th className="px-4 py-3">New Qty</th>
                    <th className="px-4 py-3">Related</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(m.date)}</td>
                      <td className="px-4 py-3">{m.reference}</td>
                      <td className="px-4 py-3 font-medium">{m.product}</td>
                      <td className="px-4 py-3">{m.movementType}</td>
                      <td className="px-4 py-3">{m.quantity}</td>
                      <td className="px-4 py-3">
                        {m.previousQuantity == null ? '—' : m.previousQuantity}
                      </td>
                      <td className="px-4 py-3">
                        {m.newQuantity == null ? '—' : m.newQuantity}
                      </td>
                      <td className="px-4 py-3">{m.relatedParty}</td>
                      <td className="px-4 py-3 text-slate-500">{m.notes || '—'}</td>
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
            Low Stock Report
          </h2>
          <p className="text-sm text-slate-500">
            Products where available quantity is at or below minimum stock
          </p>
        </div>
        <div className="card overflow-hidden">
          {lowStock.length === 0 ? (
            <EmptyState
              title="No low-stock products found."
              description="All products are above their configured minimum stock levels."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Serial Number</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Available</th>
                    <th className="px-4 py-3">Minimum Stock</th>
                    <th className="px-4 py-3">Difference</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lowStock.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-medium">{row.product}</td>
                      <td className="px-4 py-3">{row.serial_number}</td>
                      <td className="px-4 py-3">{row.category}</td>
                      <td className="px-4 py-3">{row.availableQuantity}</td>
                      <td className="px-4 py-3">{row.minimumStock}</td>
                      <td className="px-4 py-3 font-semibold text-red-600">{row.difference}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/products/${row.id}`} className="btn-secondary text-xs">
                          <Eye size={14} />
                          View Product
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
