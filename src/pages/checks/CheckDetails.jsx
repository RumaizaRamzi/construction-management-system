import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  CheckCircle2,
  Pencil,
} from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import {
  CheckDetails,
  CheckForm,
  CheckStatusBadge,
  CompleteCheckModal,
  PriorityBadge,
  RescheduleCheckModal,
} from '../../components/checks'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage } from '../../services/api'
import {
  applyCancelCheck,
  applyCompleteCheck,
  applyRescheduleCheck,
  checkToForm,
  deriveCheckStatus,
  normalizeCheckPayload,
} from '../../utils/checkHelpers'

export default function CheckDetailsPage() {
  const { id } = useParams()
  const { checks, products, updateCheck, completeCheck } = useApp()
  const { success, error: toastError } = useToast()

  const check = useMemo(
    () => checks.find((c) => String(c.id) === String(id)),
    [checks, id]
  )

  const product = useMemo(
    () =>
      check
        ? products.find(
            (p) =>
              p.id === check.productId ||
              p.name === check.product
          )
        : null,
    [check, products]
  )

  const [editOpen, setEditOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const status = check ? deriveCheckStatus(check) : null
  const canComplete = check && status !== 'Completed' && status !== 'Cancelled'
  const canReschedule = check && status !== 'Cancelled'
  const canCancel = check && status !== 'Cancelled' && status !== 'Completed'

  const formInitialValues = useMemo(
    () => (check ? checkToForm(check) : null),
    [check]
  )

  const handleEdit = async (form) => {
    if (!check) return
    try {
      const payload = normalizeCheckPayload(
        form,
        check.checkId || check.checkNumber,
        check
      )
      const { message } = await updateCheck(check.id, payload)
      success(message || `Check ${payload.checkId} updated.`)
      setEditOpen(false)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to update check.'))
    }
  }

  const handleComplete = async (form) => {
    if (!check) return
    try {
      const updated = applyCompleteCheck(check, form)
      const { message } = await completeCheck(check.id, updated)
      success(message || 'Check completed successfully.')
      setCompleteOpen(false)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to complete check.'))
    }
  }

  const handleReschedule = async (form) => {
    if (!check) return
    try {
      const updated = applyRescheduleCheck(check, form)
      const { message } = await updateCheck(check.id, updated)
      success(message || `Check rescheduled to ${form.checkDate}.`)
      setRescheduleOpen(false)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to reschedule check.'))
    }
  }

  const handleCancel = async () => {
    if (!check) return
    try {
      const { message } = await updateCheck(check.id, applyCancelCheck(check))
      success(message || `Check ${check.checkId || check.check} cancelled.`)
      setCancelOpen(false)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to cancel check.'))
    }
  }

  if (!check) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Checks', to: '/checks' }, { label: 'Not found' }]} />
        <div className="card p-8 text-center">
          <h1 className="page-title">Check not found</h1>
          <p className="page-subtitle mt-2">
            The check you are looking for does not exist or was removed.
          </p>
          <Link to="/checks" className="btn-primary mt-6 inline-flex">
            <ArrowLeft size={18} />
            Back to Checks
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
              { label: 'Checks', to: '/checks' },
              { label: check.checkId || check.checkNumber || 'Details' },
            ]}
          />
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-title">{check.checkId || check.checkNumber}</h1>
            <CheckStatusBadge status={status} />
            <PriorityBadge priority={check.priority} />
          </div>
          <p className="page-subtitle">
            {check.check} — {check.product}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to="/checks" className="btn-secondary">
            <ArrowLeft size={16} />
            Back
          </Link>
          <button type="button" className="btn-secondary" onClick={() => setEditOpen(true)}>
            <Pencil size={16} />
            Edit
          </button>
          {canComplete && (
            <button type="button" className="btn-primary" onClick={() => setCompleteOpen(true)}>
              <CheckCircle2 size={16} />
              Mark as Completed
            </button>
          )}
          {canReschedule && (
            <button type="button" className="btn-secondary" onClick={() => setRescheduleOpen(true)}>
              <CalendarClock size={16} />
              Reschedule
            </button>
          )}
          {canCancel && (
            <button type="button" className="btn-danger" onClick={() => setCancelOpen(true)}>
              <Ban size={16} />
              Cancel
            </button>
          )}
        </div>
      </div>

      <CheckDetails check={check} product={product} />

      <CheckForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEdit}
        initialValues={formInitialValues}
        products={products}
        isEdit
      />

      <CompleteCheckModal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        onSubmit={handleComplete}
        check={check}
      />

      <RescheduleCheckModal
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        onSubmit={handleReschedule}
        check={check}
      />

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Check"
        message={`Cancel ${check.checkId || check.check}? This check will be marked as Cancelled.`}
        confirmText="Cancel Check"
        danger
      />
    </div>
  )
}
