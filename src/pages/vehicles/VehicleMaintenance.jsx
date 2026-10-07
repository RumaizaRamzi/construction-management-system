import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarClock, Edit2, Paperclip, Plus, Receipt, Trash2, Wrench } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchBar from '../../components/ui/SearchBar'
import FilterDropdown from '../../components/ui/FilterDropdown'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import Pagination from '../../components/ui/Pagination'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import VehicleMaintenanceForm, { mapMaintenanceApiErrors } from '../../components/vehicles/VehicleMaintenanceForm'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import vehicleService from '../../services/vehicleService'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'
import { formatCurrency, formatDate, paginate } from '../../utils/helpers'
import { MAINTENANCE_STATUSES, MAINTENANCE_TYPES, openBlob, todayISO } from '../../utils/vehicleHelpers'

const PAGE_SIZE = 10

export default function VehicleMaintenance() {
  const { can } = useApp()
  const { success, error: toastError } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [records, setRecords] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [presetVehicleId, setPresetVehicleId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)

  const canManage = can('vehicles.maintenance')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [rows, vehicleData] = await Promise.all([vehicleService.getMaintenance(), vehicleService.getVehicles()])
      setRecords(rows)
      setVehicles(vehicleData.vehicles)
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Unable to load vehicle maintenance. Please try again.'))
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

  useEffect(() => setPage(1), [search, status, type, vehicleFilter])

  const stats = useMemo(() => {
    const today = todayISO()
    const live = records.filter((r) => r.status !== 'Cancelled')
    return {
      inProgress: records.filter((r) => r.status === 'In Progress').length,
      scheduled: records.filter((r) => r.status === 'Scheduled').length,
      totalCost: live.reduce((sum, r) => sum + r.totalCost, 0),
      dueSoon: live.filter((r) => r.nextMaintenanceDate && r.nextMaintenanceDate >= today).length,
    }
  }, [records])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return records.filter((r) => {
      if (status !== 'all' && r.status !== status) return false
      if (type !== 'all' && r.maintenanceType !== type) return false
      if (vehicleFilter !== 'all' && String(r.vehicleId) !== vehicleFilter) return false
      if (!q) return true
      return [r.maintenanceNumber, r.vehicleName, r.vehicleRegistration, r.serviceProvider, r.description]
        .some((f) => String(f || '').toLowerCase().includes(q))
    })
  }, [records, search, status, type, vehicleFilter])

  const paged = paginate(filtered, page, PAGE_SIZE)

  const openCreate = () => {
    setEditing(null)
    setPresetVehicleId(null)
    setServerErrors({})
    setFormOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    setServerErrors({})
    setFormOpen(true)
  }

  const handleSubmit = async (form, { receiptFile, removeReceipt }) => {
    setSaving(true)
    setServerErrors({})
    try {
      const { record, message } = editing
        ? await vehicleService.updateMaintenance(editing.id, form)
        : await vehicleService.createMaintenance(form)
      success(message)
      try {
        if (receiptFile) await vehicleService.uploadReceipt(record.id, receiptFile)
        else if (removeReceipt && editing?.hasReceipt) await vehicleService.deleteReceipt(record.id)
      } catch (fileError) {
        toastError(getApiErrorMessage(fileError, 'Record saved, but the receipt could not be uploaded.'))
      }
      setFormOpen(false)
      setEditing(null)
      await load()
    } catch (error) {
      setServerErrors(mapMaintenanceApiErrors(getApiValidationErrors(error)))
      toastError(getApiErrorMessage(error, 'Unable to save maintenance record.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const { message } = await vehicleService.deleteMaintenance(deleteTarget.id)
      success(message)
      setDeleteTarget(null)
      await load()
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to delete maintenance record.'))
    } finally {
      setSaving(false)
    }
  }

  const viewReceipt = async (record) => {
    try {
      await openBlob(() => vehicleService.getReceiptBlob(record.id), record.receiptName)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to open the receipt.'))
    }
  }

  const columns = [
    { key: 'maintenanceNumber', label: 'Record #', render: (r) => <span className="font-medium">{r.maintenanceNumber}</span> },
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
    { key: 'maintenanceDate', label: 'Date', render: (r) => formatDate(r.maintenanceDate) },
    {
      key: 'type',
      label: 'Type',
      wrap: true,
      render: (r) => (
        <div>
          <span>{r.maintenanceType}</span>
          {r.serviceProvider && <span className="block text-xs text-slate-500">{r.serviceProvider}</span>}
        </div>
      ),
    },
    {
      key: 'cost',
      label: 'Cost',
      render: (r) => (
        <div className="text-xs">
          <div className="font-medium">{formatCurrency(r.totalCost)}</div>
          <div className="text-slate-500">Parts {formatCurrency(r.partsCost)} · Labour {formatCurrency(r.labourCost)}</div>
        </div>
      ),
    },
    {
      key: 'meter',
      label: 'Reading',
      render: (r) => (r.meterReading != null ? `${r.meterReading.toLocaleString()} ${r.meterUnit || ''}` : '—'),
    },
    { key: 'next', label: 'Next Service', render: (r) => formatDate(r.nextMaintenanceDate) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex gap-1">
          {r.hasReceipt && (
            <button type="button" className="btn-secondary !px-2 !py-1" onClick={() => viewReceipt(r)} title="View receipt" aria-label={`View receipt for ${r.maintenanceNumber}`}>
              <Paperclip size={14} />
            </button>
          )}
          {canManage && (
            <>
              <button type="button" className="btn-secondary !px-2 !py-1" onClick={() => openEdit(r)} title="Edit" aria-label={`Edit ${r.maintenanceNumber}`}>
                <Edit2 size={14} />
              </button>
              <button type="button" className="btn-danger !px-2 !py-1" onClick={() => setDeleteTarget(r)} title="Delete" aria-label={`Delete ${r.maintenanceNumber}`}>
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="page-shell">
      <PageHeader
        title="Vehicle Maintenance"
        subtitle="Servicing, repairs and inspections for vehicles"
        breadcrumbs={[{ label: 'Vehicles', to: '/vehicles' }, { label: 'Maintenance' }]}
        actions={
          canManage ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} />
              New Maintenance
            </button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="In Progress" value={stats.inProgress} icon={Wrench} tone="red" loading={loading} />
        <StatCard title="Scheduled" value={stats.scheduled} icon={CalendarClock} tone="blue" loading={loading} />
        <StatCard title="Upcoming Next Services" value={stats.dueSoon} icon={CalendarClock} tone="violet" loading={loading} />
        <StatCard title="Total Maintenance Cost" value={formatCurrency(stats.totalCost)} icon={Receipt} tone="brand" loading={loading} />
      </div>

      <div className="card p-4">
        <div className="grid gap-3 md:grid-cols-4 md:items-end">
          <div>
            <label className="label">Search</label>
            <SearchBar value={search} onChange={setSearch} placeholder="Record #, vehicle, provider..." />
          </div>
          <FilterDropdown
            label="Vehicle"
            value={vehicleFilter}
            onChange={setVehicleFilter}
            options={[{ value: 'all', label: 'All vehicles' }, ...vehicles.map((v) => ({ value: String(v.id), label: `${v.name} · ${v.registrationNumber}` }))]}
          />
          <FilterDropdown
            label="Type"
            value={type}
            onChange={setType}
            options={[{ value: 'all', label: 'All types' }, ...MAINTENANCE_TYPES.map((t) => ({ value: t, label: t }))]}
          />
          <FilterDropdown
            label="Status"
            value={status}
            onChange={setStatus}
            options={[{ value: 'all', label: 'All statuses' }, ...MAINTENANCE_STATUSES.map((s) => ({ value: s, label: s }))]}
          />
        </div>
      </div>

      {loading && records.length === 0 ? (
        <div className="card"><LoadingState label="Loading vehicle maintenance..." /></div>
      ) : loadError && records.length === 0 ? (
        <div className="card"><ApiErrorState title="Unable to load vehicle maintenance" message={loadError} onRetry={load} /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <p className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-800 dark:text-slate-200">{paged.data.length}</span> of{' '}
              <span className="font-medium text-slate-800 dark:text-slate-200">{filtered.length}</span> records
            </p>
          </div>
          <DataTable
            columns={columns}
            data={paged.data}
            emptyTitle={records.length ? 'No records match your filters.' : 'No vehicle maintenance recorded yet.'}
            emptyDescription={records.length ? 'Try a different search or filter.' : 'Create a maintenance record to track servicing and repairs.'}
          />
          <div className="border-t border-slate-200 px-4 dark:border-slate-800">
            <Pagination page={paged.page} totalPages={paged.totalPages} total={paged.total} onChange={setPage} />
          </div>
        </div>
      )}

      <VehicleMaintenanceForm
        open={formOpen}
        onClose={() => {
          if (saving) return
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        record={editing}
        vehicles={vehicles}
        presetVehicleId={presetVehicleId}
        saving={saving}
        serverErrors={serverErrors}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !saving && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete maintenance record"
        message={`Delete ${deleteTarget?.maintenanceNumber}? Its uploaded receipt is removed too. If the work was in progress, the vehicle becomes Available again.`}
        confirmText="Delete"
        danger
        loading={saving}
      />
    </div>
  )
}
