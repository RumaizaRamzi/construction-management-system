import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Banknote, CheckCircle2, Edit2, KeyRound, Plus, Trash2, Undo2, Wallet } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchBar from '../../components/ui/SearchBar'
import FilterDropdown from '../../components/ui/FilterDropdown'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import Pagination from '../../components/ui/Pagination'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import VehicleRentalForm, { mapRentalApiErrors } from '../../components/vehicles/VehicleRentalForm'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import vehicleService from '../../services/vehicleService'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'
import { formatCurrency, formatDate, paginate } from '../../utils/helpers'
import { RENTAL_STATUSES, calculateVehicleRental, todayISO, unitLabel } from '../../utils/vehicleHelpers'

const PAGE_SIZE = 10

export default function VehicleRentals() {
  const { can, customers = [], loadVehicleRentals } = useApp()
  const { success, error: toastError } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [rentals, setRentals] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [payment, setPayment] = useState('all')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [presetVehicleId, setPresetVehicleId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [returnTarget, setReturnTarget] = useState(null)
  const [returnForm, setReturnForm] = useState({ actualReturnDate: '', paidAmount: '' })
  const [returnError, setReturnError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const canManage = can('vehicles.rentals')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [rentalRows, vehicleData] = await Promise.all([vehicleService.getRentals(), vehicleService.getVehicles()])
      setRentals(rentalRows)
      setVehicles(vehicleData.vehicles)
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Unable to load vehicle rentals. Please try again.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const preset = searchParams.get('vehicle')
    if (preset && canManage) {
      setEditing(null)
      setPresetVehicleId(preset)
      setServerErrors({})
      setFormOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, canManage])

  useEffect(() => setPage(1), [search, status, payment])

  const refreshAfterChange = async () => {
    await load()
    loadVehicleRentals?.()
  }

  const stats = useMemo(() => {
    const live = rentals.filter((r) => r.status !== 'Cancelled')
    return {
      active: rentals.filter((r) => r.status === 'Active').length,
      completed: rentals.filter((r) => r.status === 'Completed').length,
      collected: live.reduce((sum, r) => sum + r.paidAmount, 0),
      outstanding: live.reduce((sum, r) => sum + r.balance, 0),
    }
  }, [rentals])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rentals.filter((r) => {
      if (status !== 'all' && r.status !== status) return false
      if (payment !== 'all' && r.paymentStatus !== payment) return false
      if (!q) return true
      return [r.rentalNumber, r.vehicleName, r.vehicleRegistration, r.customerName, r.customerPhone]
        .some((f) => String(f || '').toLowerCase().includes(q))
    })
  }, [rentals, search, status, payment])

  const paged = paginate(filtered, page, PAGE_SIZE)

  const openCreate = () => {
    setEditing(null)
    setPresetVehicleId(null)
    setServerErrors({})
    setFormOpen(true)
  }

  const openEdit = (rental) => {
    setEditing(rental)
    setServerErrors({})
    setFormOpen(true)
  }

  const handleSubmit = async (form) => {
    setSaving(true)
    setServerErrors({})
    try {
      const { message } = editing
        ? await vehicleService.updateRental(editing.id, form)
        : await vehicleService.createRental(form)
      success(message)
      setFormOpen(false)
      setEditing(null)
      await refreshAfterChange()
    } catch (error) {
      setServerErrors(mapRentalApiErrors(getApiValidationErrors(error)))
      toastError(getApiErrorMessage(error, 'Unable to save vehicle rental.'))
    } finally {
      setSaving(false)
    }
  }

  const openReturn = (rental) => {
    setReturnTarget(rental)
    setReturnForm({ actualReturnDate: todayISO(), paidAmount: rental.paidAmount ? String(rental.paidAmount) : '' })
    setReturnError('')
  }

  const returnCalc = returnTarget
    ? calculateVehicleRental({ ...returnTarget, actualReturnDate: returnForm.actualReturnDate })
    : null

  const handleReturn = async () => {
    if (!returnTarget) return
    const paid = Number(returnForm.paidAmount) || 0
    if (!returnForm.actualReturnDate) return setReturnError('Actual return date is required.')
    if (returnForm.actualReturnDate < returnTarget.startDate) return setReturnError('Actual return date cannot be before the start date.')
    if (paid < 0) return setReturnError('Enter a valid payment amount.')
    if (paid > returnCalc.total) return setReturnError(`Payment amount cannot be more than the rental total of ${formatCurrency(returnCalc.total)}.`)
    setSaving(true)
    try {
      const { message } = await vehicleService.updateRental(returnTarget.id, {
        ...returnTarget,
        status: 'Completed',
        actualReturnDate: returnForm.actualReturnDate,
        paidAmount: paid,
      })
      success(message)
      setReturnTarget(null)
      await refreshAfterChange()
    } catch (error) {
      const fieldErrors = getApiValidationErrors(error)
      setReturnError(Object.values(fieldErrors)[0] || getApiErrorMessage(error, 'Unable to return vehicle.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const { message } = await vehicleService.deleteRental(deleteTarget.id)
      success(message)
      setDeleteTarget(null)
      await refreshAfterChange()
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to delete vehicle rental.'))
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { key: 'rentalNumber', label: 'Rental #', render: (r) => <span className="font-medium">{r.rentalNumber}</span> },
    {
      key: 'vehicle',
      label: 'Vehicle',
      render: (r) => (
        <Link to={`/vehicles/${r.vehicleId}`} className="block hover:text-brand-600">
          <span className="font-medium text-slate-900 dark:text-white">{r.vehicleName}</span>
          <span className="block text-xs text-slate-500">{r.vehicleRegistration}</span>
        </Link>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (r) => (
        <div>
          <span>{r.customerName}</span>
          {r.customerPhone && <span className="block text-xs text-slate-500">{r.customerPhone}</span>}
        </div>
      ),
    },
    {
      key: 'dates',
      label: 'Period',
      render: (r) => (
        <div className="text-xs">
          <div>{formatDate(r.startDate)} →</div>
          <div>
            {r.actualReturnDate
              ? `${formatDate(r.actualReturnDate)} (returned)`
              : r.expectedReturnDate
                ? `${formatDate(r.expectedReturnDate)} (expected)`
                : 'Open-ended'}
          </div>
        </div>
      ),
    },
    {
      key: 'duration',
      label: 'Duration',
      render: (r) => (
        <div className="text-xs">
          <div>{r.rentalDays} day{r.rentalDays === 1 ? '' : 's'}</div>
          <div className="text-slate-500">{r.rateType}{r.rateType !== 'Daily' ? ` · ${unitLabel(r.rateType, r.billedUnits)}` : ''}</div>
        </div>
      ),
    },
    {
      key: 'amounts',
      label: 'Total / Paid',
      render: (r) => (
        <div className="text-xs">
          <div className="font-medium">{formatCurrency(r.totalAmount)}</div>
          <div className="text-slate-500">Paid {formatCurrency(r.paidAmount)}</div>
          {r.balance > 0 && <div className="text-amber-600">Balance {formatCurrency(r.balance)}</div>}
        </div>
      ),
    },
    { key: 'paymentStatus', label: 'Payment', render: (r) => <StatusBadge status={r.paymentStatus} /> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex gap-1">
          {canManage && r.status === 'Active' && (
            <button type="button" className="btn-secondary !px-2 !py-1" onClick={() => openReturn(r)} title="Return vehicle" aria-label={`Return ${r.vehicleName}`}>
              <Undo2 size={14} />
            </button>
          )}
          {canManage && (
            <button type="button" className="btn-secondary !px-2 !py-1" onClick={() => openEdit(r)} title="Edit" aria-label={`Edit ${r.rentalNumber}`}>
              <Edit2 size={14} />
            </button>
          )}
          {can('vehicles.delete') && (
            <button type="button" className="btn-danger !px-2 !py-1" onClick={() => setDeleteTarget(r)} title="Delete" aria-label={`Delete ${r.rentalNumber}`}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="page-shell">
      <PageHeader
        title="Vehicle Rental"
        subtitle="Rent out vehicles, track payments and record returns"
        breadcrumbs={[{ label: 'Vehicles', to: '/vehicles' }, { label: 'Vehicle Rental' }]}
        actions={
          canManage ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} />
              New Vehicle Rental
            </button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Active Rentals" value={stats.active} icon={KeyRound} tone="blue" loading={loading} />
        <StatCard title="Completed" value={stats.completed} icon={CheckCircle2} tone="green" loading={loading} />
        <StatCard title="Payments Received" value={formatCurrency(stats.collected)} icon={Banknote} tone="brand" loading={loading} />
        <StatCard title="Outstanding Balance" value={formatCurrency(stats.outstanding)} icon={Wallet} tone="red" loading={loading} />
      </div>

      <div className="card p-4">
        <div className="grid gap-3 md:grid-cols-3 md:items-end">
          <div>
            <label className="label">Search</label>
            <SearchBar value={search} onChange={setSearch} placeholder="Rental #, vehicle, customer..." />
          </div>
          <FilterDropdown
            label="Rental Status"
            value={status}
            onChange={setStatus}
            options={[{ value: 'all', label: 'All statuses' }, ...RENTAL_STATUSES.map((s) => ({ value: s, label: s }))]}
          />
          <FilterDropdown
            label="Payment Status"
            value={payment}
            onChange={setPayment}
            options={[
              { value: 'all', label: 'All payments' },
              { value: 'Pending', label: 'Pending' },
              { value: 'Partial', label: 'Partial' },
              { value: 'Paid', label: 'Paid' },
            ]}
          />
        </div>
      </div>

      {loading && rentals.length === 0 ? (
        <div className="card"><LoadingState label="Loading vehicle rentals..." /></div>
      ) : loadError && rentals.length === 0 ? (
        <div className="card"><ApiErrorState title="Unable to load vehicle rentals" message={loadError} onRetry={load} /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <p className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-800 dark:text-slate-200">{paged.data.length}</span> of{' '}
              <span className="font-medium text-slate-800 dark:text-slate-200">{filtered.length}</span> rentals
            </p>
          </div>
          <DataTable
            columns={columns}
            data={paged.data}
            emptyTitle={rentals.length ? 'No rentals match your filters.' : 'No vehicle rentals yet.'}
            emptyDescription={rentals.length ? 'Try a different search or filter.' : 'Create a vehicle rental to get started.'}
          />
          <div className="border-t border-slate-200 px-4 dark:border-slate-800">
            <Pagination page={paged.page} totalPages={paged.totalPages} total={paged.total} onChange={setPage} />
          </div>
        </div>
      )}

      <VehicleRentalForm
        open={formOpen}
        onClose={() => {
          if (saving) return
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        rental={editing}
        vehicles={vehicles}
        customers={customers}
        presetVehicleId={presetVehicleId}
        saving={saving}
        serverErrors={serverErrors}
      />

      <Modal
        open={!!returnTarget}
        onClose={() => !saving && setReturnTarget(null)}
        title={`Return ${returnTarget?.vehicleName || 'vehicle'}`}
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setReturnTarget(null)} disabled={saving}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleReturn} disabled={saving}>
              {saving ? 'Saving…' : 'Complete Return'}
            </button>
          </>
        }
      >
        {returnTarget && (
          <div className="grid gap-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {returnTarget.rentalNumber} · {returnTarget.customerName}. The rental will be completed and the vehicle becomes Available again.
            </p>
            <div>
              <label className="label">Actual Return Date *</label>
              <input
                type="date"
                className="input-field"
                value={returnForm.actualReturnDate}
                min={returnTarget.startDate}
                onChange={(e) => setReturnForm((f) => ({ ...f, actualReturnDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Payment Amount (total received, LKR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input-field"
                value={returnForm.paidAmount}
                onChange={(e) => setReturnForm((f) => ({ ...f, paidAmount: e.target.value }))}
              />
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/40">
              <div className="flex justify-between"><span>Duration</span><span>{returnCalc.days} day{returnCalc.days === 1 ? '' : 's'}</span></div>
              <div className="flex justify-between font-medium"><span>Final total</span><span>{formatCurrency(returnCalc.total)}</span></div>
              <div className="flex justify-between"><span>Balance</span><span>{formatCurrency(Math.max(returnCalc.total - (Number(returnForm.paidAmount) || 0), 0))}</span></div>
            </div>
            {returnError && <p className="text-sm text-red-600">{returnError}</p>}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !saving && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete vehicle rental"
        message={`Delete rental ${deleteTarget?.rentalNumber}? If it is active, the vehicle becomes Available again. This cannot be undone.`}
        confirmText="Delete"
        danger
        loading={saving}
      />
    </div>
  )
}
