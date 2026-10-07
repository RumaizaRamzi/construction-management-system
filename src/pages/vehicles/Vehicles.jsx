import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Edit2, Eye, KeyRound, Plus, Tractor, Trash2, Wrench } from 'lucide-react'
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
import VehicleForm, { mapVehicleApiErrors } from '../../components/vehicles/VehicleForm'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import vehicleService from '../../services/vehicleService'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'
import { formatCurrency, paginate } from '../../utils/helpers'
import { VEHICLE_CATEGORIES, VEHICLE_STATUSES, saveVehicle } from '../../utils/vehicleHelpers'

const PAGE_SIZE = 10

export default function Vehicles({ createMode = false }) {
  const { can, branches = [] } = useApp()
  const { success, error: toastError } = useToast()
  const navigate = useNavigate()

  const [vehicles, setVehicles] = useState([])
  const [categories, setCategories] = useState(VEHICLE_CATEGORIES)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [branch, setBranch] = useState('all')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(createMode)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { vehicles: rows, options } = await vehicleService.getVehicles()
      setVehicles(rows)
      if (options.categories?.length) setCategories(options.categories)
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Unable to load vehicles. Please try again.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (createMode) {
      setEditing(null)
      setServerErrors({})
      setFormOpen(true)
    }
  }, [createMode])

  useEffect(() => setPage(1), [search, category, status, branch])

  const branchName = useCallback(
    (id) => branches.find((b) => String(b.id) === String(id))?.name || '—',
    [branches]
  )

  const stats = useMemo(() => {
    const count = (s) => vehicles.filter((v) => v.status === s).length
    return {
      total: vehicles.length,
      available: count('Available'),
      rented: count('Rented'),
      unavailable: count('Under Maintenance') + count('Out of Service'),
    }
  }, [vehicles])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return vehicles.filter((v) => {
      if (category !== 'all' && v.category !== category) return false
      if (status !== 'all' && v.status !== status) return false
      if (branch === 'none' && v.branchId) return false
      if (branch !== 'all' && branch !== 'none' && String(v.branchId) !== branch) return false
      if (!q) return true
      return [v.name, v.registrationNumber, v.vehicleCode, v.brand, v.model, v.category]
        .some((f) => String(f || '').toLowerCase().includes(q))
    })
  }, [vehicles, search, category, status, branch])

  const paged = paginate(filtered, page, PAGE_SIZE)

  const closeForm = () => {
    if (saving) return
    setFormOpen(false)
    setEditing(null)
    if (createMode) navigate('/vehicles', { replace: true })
  }

  const openCreate = () => {
    setEditing(null)
    setServerErrors({})
    setFormOpen(true)
  }

  const openEdit = (vehicle) => {
    setEditing(vehicle)
    setServerErrors({})
    setFormOpen(true)
  }

  const handleSubmit = async (form, photo) => {
    setSaving(true)
    setServerErrors({})
    try {
      const { vehicle, message, photoError } = await saveVehicle(editing, form, photo)
      success(message)
      if (photoError) toastError(getApiErrorMessage(photoError, 'Vehicle saved, but the photo could not be uploaded.'))
      setVehicles((prev) => {
        const exists = prev.some((v) => v.id === vehicle.id)
        const next = exists ? prev.map((v) => (v.id === vehicle.id ? vehicle : v)) : [...prev, vehicle]
        return next.sort((a, b) => a.name.localeCompare(b.name))
      })
      setFormOpen(false)
      setEditing(null)
      if (createMode) navigate('/vehicles', { replace: true })
    } catch (error) {
      setServerErrors(mapVehicleApiErrors(getApiValidationErrors(error)))
      toastError(getApiErrorMessage(error, 'Unable to save vehicle.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { message } = await vehicleService.deleteVehicle(deleteTarget.id)
      success(message)
      setVehicles((prev) => prev.filter((v) => v.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to delete vehicle.'))
    } finally {
      setDeleting(false)
    }
  }

  const rates = (v) => {
    const parts = [
      v.dailyRate != null && `${formatCurrency(v.dailyRate)}/day`,
      v.weeklyRate != null && `${formatCurrency(v.weeklyRate)}/week`,
      v.monthlyRate != null && `${formatCurrency(v.monthlyRate)}/month`,
    ].filter(Boolean)
    if (!parts.length) return <span className="text-slate-400">Not set</span>
    return (
      <div className="space-y-0.5 text-xs">
        {parts.map((p) => <div key={p}>{p}</div>)}
      </div>
    )
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (v) => (
        <Link to={`/vehicles/${v.id}`} className="block hover:text-brand-600">
          <span className="font-medium text-slate-900 dark:text-white">{v.name}</span>
          <span className="block text-xs text-slate-500">{v.vehicleCode}</span>
        </Link>
      ),
    },
    { key: 'registrationNumber', label: 'Registration Number' },
    { key: 'category', label: 'Category' },
    {
      key: 'model',
      label: 'Model',
      render: (v) => [v.brand, v.model].filter(Boolean).join(' ') || '—',
    },
    { key: 'rates', label: 'Rental Rate', render: rates },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v.status} /> },
    { key: 'branch', label: 'Branch', render: (v) => (v.branchId ? branchName(v.branchId) : '—') },
    {
      key: 'actions',
      label: '',
      render: (v) => (
        <div className="flex gap-1">
          <Link to={`/vehicles/${v.id}`} className="btn-secondary !px-2 !py-1" title="View details" aria-label={`View ${v.name}`}>
            <Eye size={14} />
          </Link>
          {can('vehicles.rentals') && v.status === 'Available' && (
            <Link
              to={`/vehicles/rentals?vehicle=${v.id}`}
              className="btn-secondary !px-2 !py-1"
              title="Rent this vehicle"
              aria-label={`Rent ${v.name}`}
            >
              <KeyRound size={14} />
            </Link>
          )}
          {can('vehicles.update') && (
            <button type="button" className="btn-secondary !px-2 !py-1" onClick={() => openEdit(v)} title="Edit" aria-label={`Edit ${v.name}`}>
              <Edit2 size={14} />
            </button>
          )}
          {can('vehicles.delete') && (
            <button type="button" className="btn-danger !px-2 !py-1" onClick={() => setDeleteTarget(v)} title="Delete" aria-label={`Delete ${v.name}`}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ]

  const branchOptions = [
    { value: 'all', label: 'All branches' },
    { value: 'none', label: 'No branch' },
    ...branches.map((b) => ({ value: String(b.id), label: b.name })),
  ]

  return (
    <div className="page-shell">
      <PageHeader
        title="All Vehicles"
        subtitle="Construction vehicles and heavy machinery, managed separately from equipment products"
        breadcrumbs={[{ label: 'Vehicles' }]}
        actions={
          can('vehicles.create') ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} />
              Add Vehicle
            </button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Vehicles" value={stats.total} icon={Tractor} tone="brand" loading={loading} />
        <StatCard title="Available" value={stats.available} icon={CheckCircle2} tone="green" loading={loading} />
        <StatCard title="Rented" value={stats.rented} icon={KeyRound} tone="blue" loading={loading} />
        <StatCard title="Maintenance / Out of Service" value={stats.unavailable} icon={Wrench} tone="red" loading={loading} />
      </div>

      <div className="card p-4">
        <div className="grid gap-3 md:grid-cols-4 md:items-end">
          <div>
            <label className="label">Search</label>
            <SearchBar value={search} onChange={setSearch} placeholder="Name, registration, brand..." />
          </div>
          <FilterDropdown
            label="Category"
            value={category}
            onChange={setCategory}
            options={[{ value: 'all', label: 'All categories' }, ...categories.map((c) => ({ value: c, label: c }))]}
          />
          <FilterDropdown
            label="Status"
            value={status}
            onChange={setStatus}
            options={[{ value: 'all', label: 'All statuses' }, ...VEHICLE_STATUSES.map((s) => ({ value: s, label: s }))]}
          />
          <FilterDropdown label="Branch" value={branch} onChange={setBranch} options={branchOptions} />
        </div>
      </div>

      {loading && vehicles.length === 0 ? (
        <div className="card">
          <LoadingState label="Loading vehicles..." />
        </div>
      ) : loadError && vehicles.length === 0 ? (
        <div className="card">
          <ApiErrorState title="Unable to load vehicles" message={loadError} onRetry={load} />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <p className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-800 dark:text-slate-200">{paged.data.length}</span> of{' '}
              <span className="font-medium text-slate-800 dark:text-slate-200">{filtered.length}</span> vehicles
            </p>
          </div>
          <DataTable
            columns={columns}
            data={paged.data}
            emptyTitle={vehicles.length ? 'No vehicles match your filters.' : 'No vehicles added yet.'}
            emptyDescription={vehicles.length ? 'Try a different search or filter.' : 'Add your first vehicle to start tracking rentals and maintenance.'}
          />
          <div className="border-t border-slate-200 px-4 dark:border-slate-800">
            <Pagination page={paged.page} totalPages={paged.totalPages} total={paged.total} onChange={setPage} />
          </div>
        </div>
      )}

      <VehicleForm
        open={formOpen}
        onClose={closeForm}
        onSubmit={handleSubmit}
        vehicle={editing}
        categories={categories}
        saving={saving}
        serverErrors={serverErrors}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete vehicle"
        message={`Delete “${deleteTarget?.name}” (${deleteTarget?.registrationNumber})? Vehicles with rental or maintenance history cannot be deleted — mark them Out of Service instead.`}
        confirmText="Delete"
        danger
        loading={deleting}
      />
    </div>
  )
}
