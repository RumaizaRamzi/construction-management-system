import { MapPin, Package } from 'lucide-react'
import ProductImage from '../ui/ProductImage'
import ProductStatusBadge from './ProductStatusBadge'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { getListingLabel, getStockStatus, USAGE_TIMELINE } from '../../utils/productHelpers'

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 py-2.5 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-white text-right">{value}</span>
    </div>
  )
}

export default function ProductDetails({ product }) {
  const stockStatus = getStockStatus(product)
  const timeline = product.usageHistory?.length
    ? product.usageHistory
    : USAGE_TIMELINE.map((event, idx) => ({
        id: idx + 1,
        event,
        date: null,
        note: event,
      }))

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <ProductImage src={product.image} alt={product.name} className="h-64 w-full rounded-none sm:h-80" />
          <div className="p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{product.name}</h2>
                <p className="mt-1 text-sm text-slate-500">Serial Number: {product.serial_number}</p>
                <p className="text-sm text-slate-500">{product.category}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ProductStatusBadge product={product} type="condition" />
                <ProductStatusBadge status={stockStatus} />
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-display font-semibold text-lg mb-2">Pricing & Stock</h3>
          <InfoRow label="Listed For" value={getListingLabel(product)} />
          <InfoRow label="Purchase Cost" value={formatCurrency(product.purchaseCost)} />
          <InfoRow label="Sale Price" value={formatCurrency(product.salePrice)} />
          <InfoRow label="Rental Price" value={`${formatCurrency(product.rentalPrice)}/day`} />
          <InfoRow label="Total Quantity" value={product.quantity} />
          <InfoRow label="Available Quantity" value={product.available} />
          <InfoRow label="Rented Quantity" value={product.rented} />
          <InfoRow label="Sold Quantity" value={product.sold} />
          <InfoRow label="Minimum Stock Level" value={product.minStock} />
          <InfoRow
            label="Current Location"
            value={
              <span className="inline-flex items-center gap-1">
                <MapPin size={14} className="text-slate-400" />
                {product.location || '—'}
              </span>
            }
          />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-display font-semibold text-lg">Product Description</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {product.description || 'No description provided.'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-display font-semibold text-lg mb-4">Inventory Summary</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total', value: product.quantity, tone: 'bg-slate-100 dark:bg-slate-800' },
              { label: 'Available', value: product.available, tone: 'bg-emerald-50 dark:bg-emerald-950/30' },
              { label: 'Rented', value: product.rented, tone: 'bg-sky-50 dark:bg-sky-950/30' },
              { label: 'Sold', value: product.sold, tone: 'bg-amber-50 dark:bg-amber-950/30' },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl p-4 ${item.tone}`}>
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className="mt-1 font-display text-2xl font-bold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-display font-semibold text-lg mb-4">Product Usage</h3>
          <div className="space-y-3">
            <InfoRow label="Total rental count" value={product.totalRentals || 0} />
            <InfoRow label="Total sales" value={product.totalSales || product.sold || 0} />
            <InfoRow label="Total rental income" value={formatCurrency(product.totalRentalIncome || 0)} />
            <InfoRow label="Total sales income" value={formatCurrency(product.totalSalesIncome || 0)} />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-display font-semibold text-lg mb-5">Usage Timeline</h3>
        <div className="relative space-y-0">
          {timeline.map((item, index) => (
            <div key={item.id || index} className="flex gap-4 pb-6 last:pb-0">
              <div className="flex flex-col items-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-white">
                  <Package size={14} />
                </div>
                {index < timeline.length - 1 && <div className="mt-1 w-px flex-1 bg-slate-200 dark:bg-slate-700" />}
              </div>
              <div className="pb-2">
                <p className="font-medium text-slate-900 dark:text-white">{item.event}</p>
                {item.date && <p className="text-xs text-slate-400 mt-0.5">{formatDate(item.date)}</p>}
                {item.note && <p className="text-sm text-slate-500 mt-1">{item.note}</p>}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Flow: Purchased → Available → Rented → Returned → Maintenance → Available
        </p>
      </div>

      <div className="card p-5">
        <h3 className="font-display font-semibold text-lg mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {(product.recentActivity || []).length === 0 && (
            <p className="text-sm text-slate-500">No recent activity recorded.</p>
          )}
          {(product.recentActivity || []).map((activity) => (
            <div
              key={activity.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3"
            >
              <p className="text-sm text-slate-700 dark:text-slate-200">{activity.text}</p>
              <p className="text-xs text-slate-400">{formatDate(activity.date)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
