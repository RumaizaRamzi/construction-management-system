import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import Pagination from '../../components/ui/Pagination'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import {
  MaintenanceSummary,
  MaintenanceFilters,
  MaintenanceForm,
  MaintenanceTable,
  DeleteMaintenanceDialog,
} from '../../components/maintenance'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage } from '../../services/api'
import { paginate } from '../../utils/helpers'
import {
  defaultMaintenanceFilters,
  filterMaintenance,
  getMaintenanceStats,
  maintenanceToForm,
  normalizeMaintenancePayload,
} from '../../utils/maintenanceHelpers'

const PAGE_SIZE = 8

export default function Maintenance() {
  const {
    maintenance,
    maintenanceLoading,
    maintenanceError,
    loadMaintenance,
    products,
    addMaintenance,
    updateMaintenance,
    deleteMaintenance,
  } = useApp()
  const { success, error: toastError } = useToast()

  const [draftFilters, setDraftFilters] = useState(defaultMaintenanceFilters)
  const [appliedFilters, setAppliedFilters] = useState(defaultMaintenanceFilters)
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [appliedFilters])

  const stats = useMemo(() => getMaintenanceStats(maintenance), [maintenance])

  const filtered = useMemo(
    () => filterMaintenance(maintenance, appliedFilters),
    [maintenance, appliedFilters]
  )

  const paged = paginate(filtered, page, PAGE_SIZE)

  const formInitialValues = useMemo(
    () => (editing ? maintenanceToForm(editing) : null),
    [editing]
  )

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    setModalOpen(true)
  }

  const handleSubmit = async (form) => {
    setSaving(true)
    try {
      if (editing) {
        const payload = normalizeMaintenancePayload(form, editing.maintenanceId, editing)
        const { maintenance: record, message } = await updateMaintenance(editing.id, payload)
        success(message || `Maintenance ${record?.maintenanceId || payload.maintenanceId} updated.`)
      } else {
        const payload = normalizeMaintenancePayload(form, undefined)
        const { maintenance: record, message } = await addMaintenance(payload)
        success(message || `Maintenance ${record?.maintenanceId || 'created'} created.`)
      }
      setModalOpen(false)
      setEditing(null)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to save maintenance record.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const { message } = await deleteMaintenance(deleteTarget.id)
      success(message || `Maintenance ${deleteTarget.maintenanceId} deleted.`)
      setDeleteTarget(null)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to delete maintenance record.'))
    } finally {
      setSaving(false)
    }
  }

  if (maintenanceLoading && maintenance.length === 0) {
    return <LoadingState label="Loading maintenance..." />
  }

  if (maintenanceError && maintenance.length === 0) {
    return (
      <div className="page-shell">
        <ApiErrorState
          title="Unable to load maintenance"
          message={maintenanceError}
          onRetry={() => loadMaintenance().catch(() => {})}
        />
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Breadcrumbs items={[{ label: 'Maintenance' }]} />
          <h1 className="page-title">Maintenance Management</h1>
          <p className="page-subtitle">
            Track equipment repairs, servicing and preventive maintenance
          </p>
        </div>
        <button type="button" className="btn-primary shrink-0" onClick={openCreate} disabled={saving}>
          <Plus size={16} />
          Create Maintenance
        </button>
      </div>

      <MaintenanceSummary stats={stats} />

      <MaintenanceFilters
        filters={draftFilters}
        onChange={setDraftFilters}
        onFilter={() => setAppliedFilters({ ...draftFilters })}
        onReset={() => {
          const empty = defaultMaintenanceFilters()
          setDraftFilters(empty)
          setAppliedFilters(empty)
        }}
        products={products}
      />

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3">
          <p className="text-sm text-slate-500">
            Showing{' '}
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {paged.data.length}
            </span>{' '}
            of{' '}
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {filtered.length}
            </span>{' '}
            records
          </p>
        </div>
        <div className="p-4 md:p-0">
          <MaintenanceTable
            records={paged.data}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
        </div>
        <div className="px-4 border-t border-slate-200 dark:border-slate-800">
          <Pagination
            page={paged.page}
            totalPages={paged.totalPages}
            total={paged.total}
            onChange={setPage}
          />
        </div>
      </div>

      <MaintenanceForm
        open={modalOpen}
        onClose={() => {
          if (saving) return
          setModalOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        initialValues={formInitialValues}
        products={products}
        isEdit={!!editing}
      />

      <DeleteMaintenanceDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        record={deleteTarget}
      />
    </div>
  )
}
