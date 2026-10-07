import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Package } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import StatCard from '../../components/ui/StatCard'
import { useApp } from '../../contexts/AppContext'
import { formatDate } from '../../utils/helpers'
import { getDayAvailability } from '../../utils/bookingHelpers'
import { isListedForRent } from '../../utils/productHelpers'

export default function AvailabilityCalendarPage() {
  const {
    products,
    bookings,
    rentals,
    checkEquipmentAvailability,
    productsLoading,
  } = useApp()

  const [productId, setProductId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [snap, setSnap] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const product = products.find((p) => String(p.id) === String(productId))

  useEffect(() => {
    const firstRentable = products.find(isListedForRent)
    if (!productId && firstRentable) {
      setProductId(String(firstRentable.id))
    }
  }, [products, productId])

  useEffect(() => {
    if (!productId || !startDate || !endDate) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await checkEquipmentAvailability({
          productId,
          startDate,
          endDate,
        })
        if (!cancelled) setSnap(data)
      } catch (err) {
        if (!cancelled) {
          setSnap(null)
          setError(err?.response?.data?.message || 'Unable to check availability.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [productId, startDate, endDate, checkEquipmentAvailability])

  const dayRows = useMemo(() => {
    if (!product || !startDate || !endDate) return []
    const rows = []
    const cursor = new Date(startDate)
    const end = new Date(endDate)
    while (cursor <= end) {
      const date = cursor.toISOString().slice(0, 10)
      const day = getDayAvailability({
        product,
        date,
        bookings,
        rentals,
      })
      rows.push({ date, ...day })
      cursor.setDate(cursor.getDate() + 1)
    }
    return rows
  }, [product, startDate, endDate, bookings, rentals])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Calendar', to: '/calendar' },
              { label: 'Equipment Availability' },
            ]}
          />
          <h1 className="page-title">Equipment Availability</h1>
          <p className="page-subtitle">
            Check booked vs rented quantities for a date range (live API)
          </p>
        </div>
        <Link to="/bookings" className="btn-secondary">
          Back to Bookings
        </Link>
      </div>

      <div className="card p-5 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Equipment</label>
          <select
            className="input-field"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={productsLoading}
          >
            <option value="">Select product</option>
            {products.filter(isListedForRent).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Start Date</label>
          <input
            type="date"
            className="input-field"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">End Date</label>
          <input
            type="date"
            className="input-field"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && <div className="card p-6 text-center text-sm text-slate-500">Checking availability...</div>}

      {snap && !loading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Quantity" value={snap.totalQuantity} icon={Package} />
          <StatCard title="Booked" value={snap.bookedQuantity} icon={CalendarDays} />
          <StatCard title="Rented" value={snap.rentedQuantity} icon={CalendarDays} />
          <StatCard title="Available" value={snap.availableQuantity} icon={Package} />
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-display font-semibold">Day-by-day (client view)</h2>
          <p className="text-xs text-slate-500 mt-1">
            Uses loaded bookings + rentals for daily breakdown. Range totals above come from the API.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Booked</th>
                <th className="px-4 py-3">Rented</th>
                <th className="px-4 py-3">Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {dayRows.map((row) => (
                <tr key={row.date}>
                  <td className="px-4 py-2">{formatDate(row.date)}</td>
                  <td className="px-4 py-2">{row.status}</td>
                  <td className="px-4 py-2">{row.booked}</td>
                  <td className="px-4 py-2">{row.rented}</td>
                  <td className="px-4 py-2 font-medium">{row.available}</td>
                </tr>
              ))}
              {!dayRows.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Select a product and date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
