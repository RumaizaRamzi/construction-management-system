import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import ProductImage from '../../components/ui/ProductImage'
import { useApp } from '../../contexts/AppContext'
import { formatCurrency, formatDateDMY } from '../../utils/helpers'
import { calculateProductUsageDetails } from '../../utils/reportCalculations'

export default function ProductUsageDetails() {
  const { id } = useParams()
  const { products, rentals, sales, maintenance } = useApp()

  const product = products.find((p) => String(p.id) === String(id))

  const details = useMemo(
    () => calculateProductUsageDetails(product, rentals, sales, maintenance),
    [product, rentals, sales, maintenance]
  )

  if (!product || !details) {
    return <Navigate to="/products" replace />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Products', to: '/products' },
              { label: product.name, to: `/products/${product.id}` },
              { label: 'Usage' },
            ]}
          />
          <div className="flex items-start gap-4 mt-2">
            <ProductImage src={product.image} alt={product.name} className="h-16 w-16" />
            <div>
              <h1 className="page-title">{product.name} — Usage</h1>
              <p className="page-subtitle">
                {product.serial_number} · {product.category}
              </p>
              <div className="mt-2">
                <StatusBadge status={product.status} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/products/${product.id}`} className="btn-secondary">
            <ArrowLeft size={16} />
            Product Details
          </Link>
          <Link to="/reports/inventory/usage" className="btn-secondary">
            Usage Report
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard title="Rental Count" value={details.rentalCount} />
        <StatCard title="Total Rental Days" value={details.totalRentalDays} />
        <StatCard title="Rental Income" value={formatCurrency(details.rentalIncome)} tone="green" />
        <StatCard title="Sales Quantity" value={details.salesQuantity} tone="blue" />
        <StatCard title="Sales Revenue" value={formatCurrency(details.salesRevenue)} tone="violet" />
        <StatCard title="Current Stock" value={details.currentStock} tone="brand" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs text-slate-500">Maintenance Count</p>
          <p className="mt-1 font-display text-xl font-bold">{details.maintenanceCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Last Rental</p>
          <p className="mt-1 font-medium">{formatDateDMY(details.lastRental)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Last Sale</p>
          <p className="mt-1 font-medium">{formatDateDMY(details.lastSale)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Last Maintenance</p>
          <p className="mt-1 font-medium">{formatDateDMY(details.lastMaintenance)}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-display font-semibold">Recent Rentals</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Rental</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Days</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {details.rentals.slice(0, 8).map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <Link to={`/rentals/${r.id}`} className="text-brand-600 hover:underline">
                        {r.rentalId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{r.customer}</td>
                    <td className="px-4 py-3">{r.duration}</td>
                    <td className="px-4 py-3">{formatCurrency(r.total)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.rentalStatus} />
                    </td>
                  </tr>
                ))}
                {details.rentals.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      No rental activity for this product.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-display font-semibold">Usage History</h3>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {(product.usageHistory || []).slice().reverse().map((event) => (
              <li key={event.id} className="px-5 py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="font-medium text-slate-900 dark:text-white">{event.event}</span>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {formatDateDMY(event.date)}
                  </span>
                </div>
                {event.note && <p className="text-slate-500 mt-1">{event.note}</p>}
              </li>
            ))}
            {!(product.usageHistory || []).length && (
              <li className="px-5 py-6 text-center text-slate-500 text-sm">
                No usage history recorded.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
