import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarCheck,
  CheckCircle2,
  Edit2,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import SearchBar from '../../components/ui/SearchBar'
import FilterDropdown from '../../components/ui/FilterDropdown'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import Modal from '../../components/ui/Modal'
import BranchSelect from '../../components/ui/BranchSelect'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import StatusBadge from '../../components/ui/StatusBadge'
import StatCard from '../../components/ui/StatCard'
import EmptyState from '../../components/ui/EmptyState'
import ProductImage from '../../components/ui/ProductImage'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'
import { formatCurrency, formatDate, paginate } from '../../utils/helpers'
import { calcBookingDuration, calcBookingEstimate } from '../../utils/bookingHelpers'
import { isListedForRent } from '../../utils/productHelpers'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Confirmed', label: 'Confirmed' },
  { value: 'Active', label: 'Active' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
  { value: 'Rejected', label: 'Rejected' },
]

const emptyForm = {
  customerId: '',
  productId: '',
  quantity: 1,
  startDate: '',
  endDate: '',
  status: 'Pending',
  deposit: 0,
  discount: 0,
  rentalRate: '',
  notes: '',
  branchId: '',
}

export default function Bookings() {
  const {
    bookings,
    bookingsLoading,
    bookingsError,
    loadBookings,
    customers,
    products,
    addBooking,
    updateBooking,
    deleteBooking,
    updateBookingStatus,
    convertBookingToRental,
    checkEquipmentAvailability,
  } = useApp()
  const { success, error: showError } = useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [actionBusy, setActionBusy] = useState(null)
  const [availability, setAvailability] = useState(null)
  const [checkingAvail, setCheckingAvail] = useState(false)
  const [details, setDetails] = useState(null)

  const stats = useMemo(
    () => ({
      total: bookings.length,
      pending: bookings.filter((b) => b.status === 'Pending').length,
      confirmed: bookings.filter((b) => b.status === 'Confirmed').length,
      deposits: bookings.reduce((sum, b) => sum + (Number(b.deposit) || 0), 0),
    }),
    [bookings]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return bookings.filter((b) => {
      const matchStatus = statusFilter === 'all' || b.status === statusFilter
      const matchSearch =
        !q ||
        b.customer?.toLowerCase().includes(q) ||
        b.product?.toLowerCase().includes(q) ||
        b.bookingNumber?.toLowerCase().includes(q) ||
        b.notes?.toLowerCase().includes(q)
      return matchStatus && matchSearch
    })
  }, [bookings, search, statusFilter])

  const paged = paginate(filtered, page, 8)

  const selectedProduct = products.find((p) => Number(p.id) === Number(form.productId))
  const duration = calcBookingDuration(form.startDate, form.endDate)
  const estimate = calcBookingEstimate({
    rate: form.rentalRate || selectedProduct?.rentalPrice || 0,
    duration,
    quantity: form.quantity,
    discount: form.discount,
    deposit: form.deposit,
  })

  useEffect(() => {
    if (!form.productId || !form.startDate || !form.endDate) {
      setAvailability(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setCheckingAvail(true)
      try {
        const snap = await checkEquipmentAvailability({
          productId: form.productId,
          startDate: form.startDate,
          endDate: form.endDate,
          excludeBookingId: editing?.id,
        })
        if (!cancelled) setAvailability(snap)
      } catch {
        if (!cancelled) setAvailability(null)
      } finally {
        if (!cancelled) setCheckingAvail(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [
    form.productId,
    form.startDate,
    form.endDate,
    editing?.id,
    checkEquipmentAvailability,
  ])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setAvailability(null)
    setModalOpen(true)
  }

  const openEdit = (booking) => {
    setEditing(booking)
    setForm({
      customerId: String(booking.customerId),
      productId: String(booking.productId),
      quantity: booking.quantity,
      startDate: booking.startDate,
      endDate: booking.endDate,
      status: booking.status,
      deposit: booking.deposit,
      discount: booking.discount || 0,
      rentalRate: booking.rentalRate || '',
      notes: booking.notes || '',
      branchId: booking.branchId != null ? String(booking.branchId) : '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.customerId || !form.productId || !form.startDate || !form.endDate) {
      showError('Customer, product and dates are required.')
      return
    }
    if (availability && Number(form.quantity) > Number(availability.availableQuantity)) {
      showError(
        `Only ${availability.availableQuantity} unit(s) are available for the selected dates.`
      )
      return
    }

    const product = products.find((p) => p.id === Number(form.productId))
    const payload = {
      customerId: Number(form.customerId),
      productId: Number(form.productId),
      quantity: Number(form.quantity),
      rentalRate: Number(form.rentalRate || product?.rentalPrice || 0),
      startDate: form.startDate,
      endDate: form.endDate,
      status: form.status,
      deposit: Number(form.deposit),
      discount: Number(form.discount || 0),
      notes: form.notes,
      branchId: form.branchId || null,
      bookingDate: new Date().toISOString().slice(0, 10),
    }

    setSaving(true)
    try {
      if (editing) {
        const { message } = await updateBooking(editing.id, payload)
        success(message || 'Booking updated successfully.')
      } else {
        const { message } = await addBooking(payload)
        success(message || 'Booking created successfully.')
      }
      setModalOpen(false)
    } catch (err) {
      const fields = getApiValidationErrors(err)
      showError(
        fields.quantity ||
          fields.items ||
          getApiErrorMessage(err, 'Unable to save booking.')
      )
    } finally {
      setSaving(false)
    }
  }

  const runStatus = async (booking, status) => {
    setActionBusy(`${booking.id}-${status}`)
    try {
      const { message } = await updateBookingStatus(booking.id, status)
      success(message || `Booking marked ${status}.`)
      setDetails((d) => (d && d.id === booking.id ? { ...d, status } : d))
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to update booking status.'))
    } finally {
      setActionBusy(null)
    }
  }

  const runConvert = async (booking) => {
    setActionBusy(`${booking.id}-convert`)
    try {
      const { rental, message } = await convertBookingToRental(booking.id)
      success(message || 'Booking converted to rental.')
      setDetails(null)
      if (rental?.id) {
        // stay on bookings; user can open rentals
      }
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to convert booking.'))
    } finally {
      setActionBusy(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setActionBusy(`del-${deleteId}`)
    try {
      const result = await deleteBooking(deleteId)
      success(result?.message || 'Booking deleted.')
      setDeleteId(null)
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to delete booking.'))
    } finally {
      setActionBusy(null)
    }
  }

  const columns = [
    {
      key: 'bookingNumber',
      label: 'Booking #',
      render: (r) => (
        <button type="button" className="text-brand-600 font-medium hover:underline" onClick={() => setDetails(r)}>
          {r.bookingNumber || r.bookingId}
        </button>
      ),
    },
    { key: 'customer', label: 'Customer' },
    {
      key: 'product',
      label: 'Product',
      render: (r) => (
        <div className="flex items-center gap-2">
          <ProductImage src={r.productImage || products.find((p) => p.id === r.productId)?.image} alt="" className="h-8 w-8 rounded" />
          <span>{r.product}</span>
        </div>
      ),
    },
    { key: 'quantity', label: 'Qty' },
    { key: 'startDate', label: 'Start', render: (r) => formatDate(r.startDate) },
    { key: 'endDate', label: 'End', render: (r) => formatDate(r.endDate) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'deposit', label: 'Deposit', render: (r) => formatCurrency(r.deposit) },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.status === 'Pending' && (
            <button
              type="button"
              className="btn-secondary !px-2 !py-1"
              disabled={Boolean(actionBusy)}
              onClick={() => runStatus(r, 'Confirmed')}
              title="Confirm"
            >
              <CheckCircle2 size={14} />
            </button>
          )}
          {['Pending', 'Confirmed'].includes(r.status) && (
            <button
              type="button"
              className="btn-secondary !px-2 !py-1"
              disabled={Boolean(actionBusy)}
              onClick={() => runStatus(r, 'Cancelled')}
              title="Cancel"
            >
              <XCircle size={14} />
            </button>
          )}
          {['Confirmed', 'Active'].includes(r.status) && !r.rentalId && (
            <button
              type="button"
              className="btn-secondary !px-2 !py-1"
              disabled={Boolean(actionBusy)}
              onClick={() => runConvert(r)}
              title="Convert to Rental"
            >
              <RefreshCw size={14} />
            </button>
          )}
          {!['Completed', 'Cancelled', 'Rejected'].includes(r.status) && !r.rentalId && (
            <button type="button" className="btn-secondary !px-2 !py-1" onClick={() => openEdit(r)}>
              <Edit2 size={14} />
            </button>
          )}
          {!r.rentalId && (
            <button type="button" className="btn-danger !px-2 !py-1" onClick={() => setDeleteId(r.id)}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Breadcrumbs items={[{ label: 'Bookings' }]} />
          <h1 className="page-title">Bookings</h1>
          <p className="page-subtitle">Schedule and manage equipment reservations</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/calendar/availability" className="btn-secondary">
            Availability
          </Link>
          <Link to="/calendar" className="btn-secondary">
            Calendar
          </Link>
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus size={16} />
            New Booking
          </button>
        </div>
      </div>

      {bookingsError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 flex flex-wrap items-center justify-between gap-3">
          <span>{bookingsError}</span>
          <button type="button" className="btn-secondary text-xs" onClick={() => loadBookings().catch(() => {})}>
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Bookings" value={stats.total} icon={CalendarCheck} tone="brand" />
        <StatCard title="Pending" value={stats.pending} icon={CalendarCheck} tone="slate" />
        <StatCard title="Confirmed" value={stats.confirmed} icon={CheckCircle2} tone="green" />
        <StatCard title="Deposits" value={formatCurrency(stats.deposits)} icon={CalendarCheck} tone="blue" />
      </div>

      <div className="card p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search bookings..." />
        <FilterDropdown
          label="Status"
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1) }}
          options={STATUS_OPTIONS}
        />
      </div>

      <div className="card">
        {bookingsLoading && bookings.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading bookings...</div>
        ) : paged.data.length === 0 ? (
          <EmptyState
            title="No bookings found"
            description="Create a booking to reserve equipment for upcoming dates."
            action={
              <button type="button" className="btn-primary" onClick={openCreate}>
                <Plus size={16} />
                New Booking
              </button>
            }
          />
        ) : (
          <>
            <DataTable columns={columns} data={paged.data} />
            <Pagination
              page={page}
              totalPages={paged.totalPages}
              total={paged.total}
              onChange={setPage}
            />
          </>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Edit Booking' : 'New Booking'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Customer</label>
              <select
                className="input-field"
                value={form.customerId}
                onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
                required
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Equipment</label>
              <select
                className="input-field"
                value={form.productId}
                onChange={(e) => {
                  const p = products.find((x) => String(x.id) === e.target.value)
                  setForm((f) => ({
                    ...f,
                    productId: e.target.value,
                    rentalRate: p?.rentalPrice ?? f.rentalRate,
                  }))
                }}
                required
              >
                <option value="">Select product</option>
                {products
                  .filter((p) => isListedForRent(p) || String(p.id) === String(form.productId))
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                className="input-field"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                type="date"
                className="input-field"
                value={form.endDate}
                min={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Quantity</label>
              <input
                type="number"
                min="1"
                className="input-field"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Daily Rate</label>
              <input
                type="number"
                min="0"
                className="input-field"
                value={form.rentalRate}
                onChange={(e) => setForm((f) => ({ ...f, rentalRate: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Deposit</label>
              <input
                type="number"
                min="0"
                className="input-field"
                value={form.deposit}
                onChange={(e) => setForm((f) => ({ ...f, deposit: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Discount</label>
              <input
                type="number"
                min="0"
                className="input-field"
                value={form.discount}
                onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input-field"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {STATUS_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm space-y-1">
            <p>
              Duration: <strong>{duration || 0} days</strong>
              {' · '}
              Estimate: <strong>{formatCurrency(estimate.estimatedAmount)}</strong>
            </p>
            {checkingAvail && <p className="text-slate-500">Checking availability...</p>}
            {!checkingAvail && availability && (
              <p className={Number(form.quantity) > availability.availableQuantity ? 'text-red-600' : 'text-emerald-600'}>
                Available: {availability.availableQuantity} / Total {availability.totalQuantity}
                {' '}(booked {availability.bookedQuantity}, rented {availability.rentedQuantity})
              </p>
            )}
          </div>

          <BranchSelect
            value={form.branchId ?? ''}
            onChange={(v) => setForm((f) => ({ ...f, branchId: v }))}
          />

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input-field"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" disabled={saving} onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving || checkingAvail}>
              {saving ? 'Saving...' : editing ? 'Update Booking' : 'Create Booking'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(details)} onClose={() => setDetails(null)} title={details?.bookingNumber || 'Booking'}>
        {details && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={details.status} />
              <StatusBadge status={details.paymentStatus} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-slate-500">Customer</p><p className="font-medium">{details.customer}</p></div>
              <div><p className="text-slate-500">Equipment</p><p className="font-medium">{details.product} × {details.quantity}</p></div>
              <div><p className="text-slate-500">Period</p><p className="font-medium">{formatDate(details.startDate)} → {formatDate(details.endDate)}</p></div>
              <div><p className="text-slate-500">Duration</p><p className="font-medium">{details.duration} days</p></div>
              <div><p className="text-slate-500">Rate</p><p className="font-medium">{formatCurrency(details.rentalRate)}/day</p></div>
              <div><p className="text-slate-500">Total</p><p className="font-medium">{formatCurrency(details.estimatedAmount || details.total)}</p></div>
              <div><p className="text-slate-500">Deposit</p><p className="font-medium">{formatCurrency(details.deposit)}</p></div>
              <div><p className="text-slate-500">Balance</p><p className="font-medium">{formatCurrency(details.balance)}</p></div>
            </div>
            {details.notes && <p className="text-slate-600">{details.notes}</p>}
            {details.rentalId && (
              <p className="text-emerald-600">Converted to rental #{details.rentalId}</p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              {details.status === 'Pending' && (
                <button type="button" className="btn-primary" disabled={Boolean(actionBusy)} onClick={() => runStatus(details, 'Confirmed')}>
                  Confirm
                </button>
              )}
              {['Confirmed', 'Active'].includes(details.status) && !details.rentalId && (
                <button type="button" className="btn-primary" disabled={Boolean(actionBusy)} onClick={() => runConvert(details)}>
                  Convert to Rental
                </button>
              )}
              {['Pending', 'Confirmed'].includes(details.status) && (
                <button type="button" className="btn-secondary" disabled={Boolean(actionBusy)} onClick={() => runStatus(details, 'Cancelled')}>
                  Cancel Booking
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={() => setDetails(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete booking?"
        message="This permanently removes the booking if it has not been converted."
      />
    </div>
  )
}
