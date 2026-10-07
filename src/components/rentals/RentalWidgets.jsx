import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarCheck, CalendarClock, Package, RotateCcw, TrendingUp } from 'lucide-react'
import ProductImage from '../ui/ProductImage'
import { formatCurrency } from '../../utils/helpers'
import { calcLateDays, calcLateFee, getRentalStats } from '../../utils/rentalHelpers'

export default function RentalWidgets({ rentals = [], products = [], lateFeePerDay = 2500 }) {
  const stats = getRentalStats(rentals, products)
  const today = new Date().toISOString().slice(0, 10)

  const overdueList = rentals.filter(
    (r) =>
      r.rentalStatus === 'Overdue' ||
      (r.rentalStatus === 'Active' && r.expectedReturn && r.expectedReturn < today)
  )

  const mostRented = [...products]
    .map((p) => ({
      ...p,
      rentalCount: rentals.filter(
        (r) => Number(r.productId) === p.id && r.rentalStatus !== 'Cancelled'
      ).length,
    }))
    .sort((a, b) => b.rentalCount - a.rentalCount)
    .slice(0, 5)

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
            <Package size={20} />
          </div>
          <div>
            <p className="text-sm text-slate-500">Active Rentals</p>
            <p className="text-2xl font-display font-bold text-slate-900 dark:text-white">{stats.activeRentals}</p>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40">
            <CalendarClock size={20} />
          </div>
          <div>
            <p className="text-sm text-slate-500">Due Today</p>
            <p className="text-2xl font-display font-bold text-slate-900 dark:text-white">{stats.dueToday.length}</p>
          </div>
        </div>
        {stats.dueToday.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {stats.dueToday.slice(0, 3).map((r) => (
              <li key={r.id}>
                <Link to={`/rentals/${r.id}`} className="text-brand-600 hover:underline">
                  {r.rentalId}
                </Link>
                <span className="text-slate-500"> — {r.product}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40">
            <CalendarCheck size={20} />
          </div>
          <div>
            <p className="text-sm text-slate-500">Due Tomorrow</p>
            <p className="text-2xl font-display font-bold text-slate-900 dark:text-white">{stats.dueTomorrow.length}</p>
          </div>
        </div>
        {stats.dueTomorrow.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {stats.dueTomorrow.slice(0, 3).map((r) => (
              <li key={r.id}>
                <Link to={`/rentals/${r.id}`} className="text-brand-600 hover:underline">
                  {r.rentalId}
                </Link>
                <span className="text-slate-500"> — {r.customer}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-5 md:col-span-2">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={18} className="text-red-500" />
          <h3 className="font-medium text-slate-900 dark:text-white">Overdue Rentals</h3>
          <span className="ml-auto text-sm font-semibold text-red-600">{overdueList.length}</span>
        </div>
        {overdueList.length === 0 ? (
          <p className="text-sm text-slate-500">No overdue rentals.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {overdueList.slice(0, 5).map((r) => {
              const lateDays = calcLateDays(r.expectedReturn, today)
              const lateFee = calcLateFee(lateDays, lateFeePerDay, r.quantity)
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <Link to={`/rentals/${r.id}`} className="font-medium text-brand-600 hover:underline">
                      {r.rentalId}
                    </Link>
                    <span className="text-slate-500"> — {r.customer}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-red-600 font-medium">{lateDays} days overdue</p>
                    <p className="text-xs text-slate-500">Est. late fee: {formatCurrency(lateFee)}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <RotateCcw size={18} className="text-emerald-500" />
          <h3 className="font-medium text-slate-900 dark:text-white">Returned Today</h3>
          <span className="ml-auto text-sm font-semibold">{stats.returnedToday.length}</span>
        </div>
        {stats.returnedToday.length === 0 ? (
          <p className="text-sm text-slate-500">No returns recorded today.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {stats.returnedToday.map((r) => (
              <li key={r.id}>
                <Link to={`/rentals/${r.id}`} className="text-brand-600 hover:underline">
                  {r.rentalId}
                </Link>
                <p className="text-slate-500">{r.product}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-5 xl:col-span-3">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-brand-600" />
          <h3 className="font-medium text-slate-900 dark:text-white">Most Rented Equipment</h3>
        </div>
        {mostRented.length === 0 ? (
          <p className="text-sm text-slate-500">No rental history yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {mostRented.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3"
              >
                <ProductImage src={p.image} alt={p.name} className="h-12 w-12 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.rentalCount} rentals</p>
                  <p className="text-xs text-brand-600">{formatCurrency(p.rentalPrice)}/day</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
