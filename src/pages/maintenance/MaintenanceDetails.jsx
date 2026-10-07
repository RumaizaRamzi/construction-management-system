import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Pencil,
  Play,
  Trash2,
} from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import {
  MaintenanceDetails,
  MaintenanceForm,
  MaintenanceStatusBadge,
  DeleteMaintenanceDialog,
} from '../../components/maintenance'
import PriorityBadge from '../../components/checks/PriorityBadge'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage } from '../../services/api'
import {
  cancelMaintenance as buildCancelPayload,
  completeMaintenance as buildCompletePayload,
  maintenanceToForm,
  normalizeMaintenancePayload,
  startMaintenance as buildStartPayload,
} from '../../utils/maintenanceHelpers'

export default function MaintenanceDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    maintenance,
    products,
    updateMaintenance,
    completeMaintenance,
    cancelMaintenance,
    deleteMaintenance,
  } = useApp()
  const { success, error: toastError } = useToast()

  const record = useMemo(
    () => maintenance.find((m) => String(m.id) === String(id)),
    [maintenance, id]
  )

  const product = useMemo(
    () =>
      record
        ? products.find(
            (p) => p.id === record.productId || p.name === record.product
          )
        : null,
    [record, products]
  )

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const formInitialValues = useMemo(
    () => (record ? maintenanceToForm(record) : null),
    [record]
  )

  const canStart = record && (record.status === 'Scheduled' || record.status === 'On Hold')
  const canComplete = record && ['Scheduled', 'In Progress', 'On Hold'].includes(record.status)
  const canCancel = record && !['Completed', 'Cancelled'].includes(record.status)

  const handleEdit = async (form) => {
    if (!record) return
    try {
      const payload = normalizeMaintenancePayload(form, record.maintenanceId, record)
      const { message } = await updateMaintenance(record.id, payload)
      success(message || `Maintenance ${payload.maintenanceId} updated.`)
      setEditOpen(false)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to update maintenance.'))
    }
  }

  const handleStart = async () => {
    if (!record) return
    try {
      const { message } = await updateMaintenance(record.id, buildStartPayload(record))
      success(message || 'Maintenance marked as In Progress.')
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to start maintenance.'))
    }
  }

  const handleComplete = async () => {
    if (!record) return
    try {
      const payload = buildCompletePayload(record)
      const { message } = await completeMaintenance(record.id, payload)
      success(message || 'Maintenance completed. Product returned to available status.')
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to complete maintenance.'))
    }
  }

  const handleCancel = async () => {
    if (!record) return
    try {
      const { message } = await cancelMaintenance(record.id, buildCancelPayload(record))
      success(message || `Maintenance ${record.maintenanceId} cancelled.`)
      setCancelOpen(false)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to cancel maintenance.'))
    }
  }

  const handleDelete = async () => {
    if (!record) return
    try {
      const { message } = await deleteMaintenance(record.id)
      success(message || `Maintenance ${record.maintenanceId} deleted.`)
      navigate('/maintenance')
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to delete maintenance.'))
    }
  }

  if (!record) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[{ label: 'Maintenance', to: '/maintenance' }, { label: 'Not found' }]}
        />
        <div className="card p-8 text-center">
          <h1 className="page-title">Maintenance not found</h1>
          <p className="page-subtitle mt-2">
            The maintenance record you are looking for does not exist or was removed.
          </p>
          <Link to="/maintenance" className="btn-primary mt-6 inline-flex">
            <ArrowLeft size={18} />
            Back to Maintenance
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Maintenance', to: '/maintenance' },
              { label: record.maintenanceId },
            ]}
          />
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-title">{record.maintenanceId}</h1>
            <MaintenanceStatusBadge status={record.status} record={record} />
            <PriorityBadge priority={record.priority} />
          </div>
          <p className="page-subtitle">
            {record.product} — {record.maintenanceType}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to="/maintenance" className="btn-secondary">
            <ArrowLeft size={16} />
            Back
          </Link>
          <button type="button" className="btn-secondary" onClick={() => setEditOpen(true)}>
            <Pencil size={16} />
            Edit
          </button>
          {canStart && (
            <button type="button" className="btn-secondary" onClick={handleStart}>
              <Play size={16} />
              Start
            </button>
          )}
          {canComplete && (
            <button type="button" className="btn-primary" onClick={handleComplete}>
              <CheckCircle2 size={16} />
              Mark Completed
            </button>
          )}
          {canCancel && (
            <button type="button" className="btn-danger" onClick={() => setCancelOpen(true)}>
              <Ban size={16} />
              Cancel
            </button>
          )}
          <button type="button" className="btn-danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>

      <MaintenanceDetails record={record} product={product} />

      <MaintenanceForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEdit}
        initialValues={formInitialValues}
        products={products}
        isEdit
      />

      <DeleteMaintenanceDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        record={record}
      />

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Maintenance"
        message={`Cancel ${record.maintenanceId}? The product will return to available status if no other active maintenance exists.`}
        confirmText="Cancel Maintenance"
        danger
      />
    </div>
  )
}
