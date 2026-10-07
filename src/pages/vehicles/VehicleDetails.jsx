import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Banknote, Edit2, FileText, KeyRound, Paperclip, Receipt, Tractor, Wrench } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import EmptyState from '../../components/ui/EmptyState'
import VehicleForm, { mapVehicleApiErrors } from '../../components/vehicles/VehicleForm'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import vehicleService from '../../services/vehicleService'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/helpers'
import { openBlob, saveVehicle, unitLabel, useVehiclePhoto } from '../../utils/vehicleHelpers'

function VehiclePicker() {
  const navigate = useNavigate()
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setVehicles((await vehicleService.getVehicles()).vehicles)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load vehicles. Please try again.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="page-shell">
      <PageHeader
        title="Vehicle Details"
        subtitle="Select a vehicle to see its rentals, maintenance, income and documents"
        breadcrumbs={[{ label: 'Vehicles', to: '/vehicles' }, { label: 'Vehicle Details' }]}
      />
      <div className="card max-w-xl p-4">
        {loading ? (
          <LoadingState label="Loading vehicles..." />
        ) : error ? (
          <ApiErrorState title="Unable to load vehicles" message={error} onRetry={load} />
        ) : vehicles.length === 0 ? (
          <EmptyState title="No vehicles added yet." description="Add a vehicle first to view its details." />
        ) : (
          <>
            <label className="label" htmlFor="vehicle-picker">Vehicle</label>
            <select
              id="vehicle-picker"
              className="input-field"
              defaultValue=""
              onChange={(e) => e.target.value && navigate(`/vehicles/${e.target.value}`)}
            >
              <option value="">Select vehicle</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.name} · {v.registrationNumber} ({v.status})</option>
              ))}
            </select>
          </>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{value || '—'}</dd>
    </div>
  )
}

function Section({ title, icon: Icon, children, actions }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5">
        <h2 className="flex items-center gap-2 font-display font-semibold text-slate-900 dark:text-white">
          {Icon ? <Icon size={16} className="text-slate-400" aria-hidden /> : null}
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  )
}

export default function VehicleDetails() {
  const { id } = useParams()
  if (!id) return <VehiclePicker />
  return <VehicleDetailsView id={id} />
}

function VehicleDetailsView({ id }) {
  const { can, branches = [] } = useApp()
  const { success, error: toastError } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [photoVersion, setPhotoVersion] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setData(await vehicleService.getVehicle(id))
    } catch (error) {
      setLoadError(
        error?.response?.status === 404
          ? 'This vehicle could not be found. It may have been deleted.'
          : getApiErrorMessage(error, 'Unable to load vehicle details. Please try again.')
      )
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const vehicle = data?.vehicle
  const photoUrl = useVehiclePhoto(vehicle?.id, vehicle?.hasPhoto, photoVersion)
  const branchName = useMemo(
    () => branches.find((b) => String(b.id) === String(vehicle?.branchId))?.name,
    [branches, vehicle]
  )

  const handleSubmit = async (form, photo) => {
    setSaving(true)
    setServerErrors({})
    try {
      const { message, photoError } = await saveVehicle(vehicle, form, photo)
      success(message)
      if (photoError) toastError(getApiErrorMessage(photoError, 'Vehicle saved, but the photo could not be uploaded.'))
      setFormOpen(false)
      setPhotoVersion((v) => v + 1)
      await load()
    } catch (error) {
      setServerErrors(mapVehicleApiErrors(getApiValidationErrors(error)))
      toastError(getApiErrorMessage(error, 'Unable to save vehicle.'))
    } finally {
      setSaving(false)
    }
  }

  const viewReceipt = async (doc) => {
    try {
      await openBlob(() => vehicleService.getReceiptBlob(doc.maintenance_id), doc.name)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to open the receipt.'))
    }
  }

  if (loading && !data) return <LoadingState label="Loading vehicle details..." />

  if (loadError && !data) {
    return (
      <div className="page-shell">
        <ApiErrorState title="Unable to load vehicle" message={loadError} onRetry={load} />
        <Link to="/vehicles" className="btn-secondary w-fit">Back to vehicles</Link>
      </div>
    )
  }

  const { stats = {}, currentRental, rentals = [], maintenance = [], documents = [], activity = [] } = data
  const rateText = (value, unit) => (value != null ? `${formatCurrency(value)} / ${unit}` : 'Not set')

  const rentalColumns = [
    { key: 'rentalNumber', label: 'Rental #' },
    { key: 'customerName', label: 'Customer' },
    { key: 'startDate', label: 'Start', render: (r) => formatDate(r.startDate) },
    {
      key: 'end',
      label: 'Return',
      render: (r) => (r.actualReturnDate ? formatDate(r.actualReturnDate) : r.expectedReturnDate ? `${formatDate(r.expectedReturnDate)} (expected)` : 'Open-ended'),
    },
    {
      key: 'duration',
      label: 'Duration',
      render: (r) => `${r.rentalDays} day${r.rentalDays === 1 ? '' : 's'}${r.rateType !== 'Daily' ? ` · ${unitLabel(r.rateType, r.billedUnits)}` : ''}`,
    },
    { key: 'totalAmount', label: 'Total', render: (r) => formatCurrency(r.totalAmount) },
    { key: 'paidAmount', label: 'Paid', render: (r) => formatCurrency(r.paidAmount) },
    { key: 'paymentStatus', label: 'Payment', render: (r) => <StatusBadge status={r.paymentStatus} /> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  const maintenanceColumns = [
    { key: 'maintenanceNumber', label: 'Record #' },
    { key: 'maintenanceDate', label: 'Date', render: (m) => formatDate(m.maintenanceDate) },
    { key: 'maintenanceType', label: 'Type' },
    { key: 'serviceProvider', label: 'Provider', render: (m) => m.serviceProvider || '—' },
    { key: 'totalCost', label: 'Total Cost', render: (m) => formatCurrency(m.totalCost) },
    { key: 'next', label: 'Next Service', render: (m) => formatDate(m.nextMaintenanceDate) },
    { key: 'status', label: 'Status', render: (m) => <StatusBadge status={m.status} /> },
  ]

  return (
    <div className="page-shell">
      <PageHeader
        title={vehicle.name}
        subtitle={`${vehicle.vehicleCode} · ${vehicle.registrationNumber}`}
        breadcrumbs={[{ label: 'Vehicles', to: '/vehicles' }, { label: vehicle.name }]}
        actions={
          <>
            {can('vehicles.rentals') && vehicle.status === 'Available' && (
              <Link to={`/vehicles/rentals?vehicle=${vehicle.id}`} className="btn-primary">
                <KeyRound size={16} />
                Rent Vehicle
              </Link>
            )}
            {can('vehicles.maintenance') && (
              <Link to={`/vehicles/maintenance?vehicle=${vehicle.id}`} className="btn-secondary">
                <Wrench size={16} />
                Add Maintenance
              </Link>
            )}
            {can('vehicles.update') && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setServerErrors({})
                  setFormOpen(true)
                }}
              >
                <Edit2 size={16} />
                Edit
              </button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Rental Income" value={formatCurrency(stats.total_rental_income)} icon={Banknote} tone="green" trend={`Billed ${formatCurrency(stats.total_rental_billed)}`} />
        <StatCard title="Total Maintenance Cost" value={formatCurrency(stats.total_maintenance_cost)} icon={Receipt} tone="red" />
        <StatCard title="Times Rented" value={stats.times_rented ?? 0} icon={KeyRound} tone="blue" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Basic Info" icon={Tractor}>
          <div className="space-y-4 p-4 sm:p-5">
            {photoUrl ? (
              <img src={photoUrl} alt={vehicle.name} className="h-48 w-full rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
            ) : (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 dark:border-slate-700">
                <Tractor size={32} aria-hidden />
              </div>
            )}
            <div><StatusBadge status={vehicle.status} /></div>
            <dl className="grid grid-cols-2 gap-3">
              <InfoRow label="Category" value={vehicle.category} />
              <InfoRow label="Registration" value={vehicle.registrationNumber} />
              <InfoRow label="Brand" value={vehicle.brand} />
              <InfoRow label="Model" value={vehicle.model} />
              <InfoRow label="Manufacturing Year" value={vehicle.manufactureYear} />
              <InfoRow label="Branch" value={branchName} />
              <InfoRow label="Purchase Date" value={vehicle.purchaseDate ? formatDate(vehicle.purchaseDate) : null} />
              <InfoRow label="Purchase Cost" value={vehicle.purchaseCost != null ? formatCurrency(vehicle.purchaseCost) : null} />
            </dl>
            <dl className="grid gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <InfoRow label="Daily Rate" value={rateText(vehicle.dailyRate, 'day')} />
              <InfoRow label="Weekly Rate" value={rateText(vehicle.weeklyRate, 'week')} />
              <InfoRow label="Monthly Rate" value={rateText(vehicle.monthlyRate, 'month')} />
            </dl>
            {vehicle.description && (
              <p className="whitespace-pre-line border-t border-slate-200 pt-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
                {vehicle.description}
              </p>
            )}
          </div>
        </Section>

        <div className="space-y-4 lg:col-span-2">
          <Section
            title="Current Rental"
            icon={KeyRound}
            actions={currentRental ? <Link to="/vehicles/rentals" className="text-sm text-brand-600 hover:underline">Manage</Link> : null}
          >
            {currentRental ? (
              <dl className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
                <InfoRow label="Rental #" value={currentRental.rentalNumber} />
                <InfoRow label="Customer" value={[currentRental.customerName, currentRental.customerPhone].filter(Boolean).join(' · ')} />
                <InfoRow label="Start Date" value={formatDate(currentRental.startDate)} />
                <InfoRow label="Expected Return" value={currentRental.expectedReturnDate ? formatDate(currentRental.expectedReturnDate) : 'Open-ended'} />
                <InfoRow label="Rate" value={`${formatCurrency(currentRental.rentalRate)} / ${currentRental.rateType.toLowerCase()}`} />
                <InfoRow label="Total" value={formatCurrency(currentRental.totalAmount)} />
                <InfoRow label="Paid" value={formatCurrency(currentRental.paidAmount)} />
                <InfoRow label="Balance" value={formatCurrency(currentRental.balance)} />
                <div>
                  <dt className="text-xs text-slate-500">Payment Status</dt>
                  <dd className="mt-1"><StatusBadge status={currentRental.paymentStatus} /></dd>
                </div>
              </dl>
            ) : (
              <p className="p-4 text-sm text-slate-500 sm:p-5">This vehicle is not currently rented.</p>
            )}
          </Section>

          <Section title={`Rental History (${rentals.length})`} icon={FileText}>
            <DataTable columns={rentalColumns} data={rentals} emptyTitle="No rentals yet." emptyDescription="Rentals of this vehicle will appear here." />
          </Section>

          <Section title={`Maintenance History (${maintenance.length})`} icon={Wrench}>
            <DataTable columns={maintenanceColumns} data={maintenance} emptyTitle="No maintenance recorded." emptyDescription="Maintenance records for this vehicle will appear here." />
          </Section>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Documents / Receipts" icon={Paperclip}>
          {documents.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {documents.map((doc) => (
                <li key={doc.maintenance_id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{doc.name}</p>
                    <p className="text-xs text-slate-500">{doc.maintenance_number} · {formatDate(doc.date)}</p>
                  </div>
                  <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => viewReceipt(doc)}>
                    Open
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-sm text-slate-500 sm:p-5">No receipts uploaded. Attach invoices or receipts to maintenance records.</p>
          )}
        </Section>

        <Section title="Activity History" icon={FileText}>
          {!can('activity.view') ? (
            <p className="p-4 text-sm text-slate-500 sm:p-5">You do not have permission to view activity history.</p>
          ) : activity.length ? (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {activity.map((log) => (
                <li key={log.id} className="px-4 py-3 sm:px-5">
                  <p className="text-sm text-slate-900 dark:text-white">{log.description}</p>
                  <p className="text-xs text-slate-500">{log.user_name} · {formatDateTime(log.created_at)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-sm text-slate-500 sm:p-5">No activity recorded yet.</p>
          )}
        </Section>
      </div>

      <VehicleForm
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        onSubmit={handleSubmit}
        vehicle={vehicle}
        saving={saving}
        serverErrors={serverErrors}
      />
    </div>
  )
}
