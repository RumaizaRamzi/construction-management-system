import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarCheck,
  CalendarOff,
  Clock,
  Edit2,
  Link2,
  Plus,
  Trash2,
  UserCheck,
  UserMinus,
  UserX,
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import EmptyState from '../../components/ui/EmptyState'
import StaffAvatar from '../../components/staff/StaffAvatar'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import staffService from '../../services/staffService'
import vehicleService from '../../services/vehicleService'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'
import { formatDate, formatDateTime } from '../../utils/helpers'
import { todayISO } from '../../utils/vehicleHelpers'
import { ATTENDANCE_LABELS, ATTENDANCE_TONES } from '../../utils/staffHelpers'

const EMPTY_ASSIGNMENT = { vehicleId: '', rentalId: '', assignedFrom: todayISO(), assignedTo: '', notes: '' }

function InfoRow({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900 break-words sm:text-right dark:text-slate-100">{children || '—'}</dd>
    </div>
  )
}

function AttendanceBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ATTENDANCE_TONES[status] || ''}`}>
      {ATTENDANCE_LABELS[status] || status}
    </span>
  )
}

function monthLabel(month) {
  if (!month) return 'This Month'
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export default function StaffDetails() {
  const { id } = useParams()
  const { can, rentals = [] } = useApp()
  const { success, error: toastError } = useToast()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [statusOpen, setStatusOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignment, setAssignment] = useState(EMPTY_ASSIGNMENT)
  const [assignErrors, setAssignErrors] = useState({})
  const [vehicles, setVehicles] = useState([])
  const [removeTarget, setRemoveTarget] = useState(null)

  const canUpdate = can('staff.update')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setData(await staffService.getStaffMember(id))
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Unable to load staff member.'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!assignOpen || vehicles.length) return
    vehicleService
      .getVehicles()
      .then(({ vehicles: rows }) => setVehicles(rows))
      .catch(() => setVehicles([]))
  }, [assignOpen, vehicles.length])

  const rentalOptions = useMemo(
    () =>
      rentals
        .filter((r) => r.status !== 'Cancelled')
        .map((r) => ({ id: String(r.id), label: `${r.rentalNumber || `#${r.id}`}${r.customer ? ` · ${r.customer}` : ''}` })),
    [rentals]
  )

  const staff = data?.staff
  const isActive = staff?.status === 'Active'

  const handleStatus = async () => {
    setSaving(true)
    try {
      const { message } = await staffService.setStatus(id, isActive ? 'Inactive' : 'Active')
      success(message)
      setStatusOpen(false)
      load()
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to update staff status.'))
    } finally {
      setSaving(false)
    }
  }

  const openAssign = () => {
    setAssignment({ ...EMPTY_ASSIGNMENT, assignedFrom: todayISO() })
    setAssignErrors({})
    setAssignOpen(true)
  }

  const setField = (key) => (e) => {
    setAssignment((a) => ({ ...a, [key]: e.target.value }))
    setAssignErrors((prev) => ({ ...prev, [key]: undefined, target: undefined }))
  }

  const handleAssign = async () => {
    const errs = {}
    if (!assignment.vehicleId && !assignment.rentalId) errs.target = 'Select a vehicle or a rental.'
    if (!assignment.assignedFrom) errs.assignedFrom = 'Start date is required.'
    if (assignment.assignedTo && assignment.assignedFrom && assignment.assignedTo < assignment.assignedFrom) {
      errs.assignedTo = 'End date cannot be before the start date.'
    }
    setAssignErrors(errs)
    if (Object.keys(errs).length) return

    setSaving(true)
    try {
      const { message } = await staffService.createAssignment(id, assignment)
      success(message)
      setAssignOpen(false)
      load()
    } catch (error) {
      const fe = getApiValidationErrors(error)
      setAssignErrors({
        target: fe.vehicle_id || fe.rental_id || fe.staff,
        assignedFrom: fe.assigned_from,
        assignedTo: fe.assigned_to,
        notes: fe.notes,
      })
      toastError(getApiErrorMessage(error, 'Unable to assign staff member.'))
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveAssignment = async () => {
    if (!removeTarget) return
    setSaving(true)
    try {
      const { message } = await staffService.deleteAssignment(removeTarget.id)
      success(message)
      setRemoveTarget(null)
      load()
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to remove assignment.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading && !data) return <LoadingState label="Loading staff member..." />

  if (loadError && !data) {
    return (
      <div className="page-shell">
        <PageHeader title="Staff Details" breadcrumbs={[{ label: 'Staff', to: '/staff' }, { label: 'Details' }]} />
        <div className="card"><ApiErrorState title="Unable to load staff member" message={loadError} onRetry={load} /></div>
      </div>
    )
  }

  const summary = data.attendanceSummary

  const assignmentColumns = [
    {
      key: 'target',
      label: 'Assigned To',
      wrap: true,
      render: (a) => (
        <div className="space-y-0.5">
          {a.vehicleId && (
            <Link to={`/vehicles/${a.vehicleId}`} className="block font-medium text-brand-600 hover:underline">
              {a.vehicleName || 'Vehicle'}{a.vehicleRegistration ? ` (${a.vehicleRegistration})` : ''}
            </Link>
          )}
          {a.rentalId && (
            <span className="block text-sm text-slate-700 dark:text-slate-300">
              Rental {a.rentalNumber || `#${a.rentalId}`}{a.rentalCustomer ? ` · ${a.rentalCustomer}` : ''}
            </span>
          )}
          {!a.vehicleId && !a.rentalId && <span className="text-slate-400">Removed record</span>}
        </div>
      ),
    },
    { key: 'assignedFrom', label: 'From', render: (a) => formatDate(a.assignedFrom) },
    { key: 'assignedTo', label: 'To', render: (a) => (a.assignedTo ? formatDate(a.assignedTo) : 'Ongoing') },
    { key: 'isCurrent', label: 'Status', render: (a) => <StatusBadge status={a.isCurrent ? 'Active' : 'Completed'} /> },
    { key: 'notes', label: 'Notes', wrap: true, render: (a) => a.notes || '—' },
    ...(canUpdate
      ? [
          {
            key: 'actions',
            label: '',
            render: (a) => (
              <button type="button" className="btn-danger !px-2 !py-1" onClick={() => setRemoveTarget(a)} title="Remove assignment" aria-label="Remove assignment">
                <Trash2 size={14} />
              </button>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="page-shell">
      <PageHeader
        title={staff.fullName}
        subtitle={`${staff.staffCode}${staff.roleName ? ` · ${staff.roleName}` : ''}`}
        breadcrumbs={[{ label: 'Staff', to: '/staff' }, { label: staff.fullName }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/staff" className="btn-secondary">
              <ArrowLeft size={16} />
              Back
            </Link>
            {canUpdate && (
              <>
                <Link to={`/staff/${staff.id}/edit`} className="btn-secondary">
                  <Edit2 size={16} />
                  Edit
                </Link>
                <button type="button" className={isActive ? 'btn-danger' : 'btn-primary'} onClick={() => setStatusOpen(true)}>
                  {isActive ? <UserMinus size={16} /> : <UserCheck size={16} />}
                  {isActive ? 'Deactivate' : 'Reactivate'}
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          <div className="flex flex-col items-center gap-3 border-b border-slate-200 pb-4 text-center dark:border-slate-700">
            <StaffAvatar staff={staff} size="lg" />
            <div>
              <p className="font-display text-lg font-semibold text-slate-900 dark:text-white">{staff.fullName}</p>
              <p className="text-sm text-slate-500">{staff.roleName || 'No role'}</p>
            </div>
            <StatusBadge status={staff.status} />
          </div>
          <dl className="mt-4 space-y-3">
            <InfoRow label="Staff Code">{staff.staffCode}</InfoRow>
            <InfoRow label="NIC">{staff.nic}</InfoRow>
            <InfoRow label="Phone">{staff.phone}</InfoRow>
            <InfoRow label="Email">{staff.email}</InfoRow>
            <InfoRow label="Address">{staff.address}</InfoRow>
            <InfoRow label="Branch">{staff.branchName}</InfoRow>
            <InfoRow label="Joined">{formatDate(staff.joinedDate)}</InfoRow>
            <InfoRow label="User Account">{staff.userName}</InfoRow>
          </dl>
          {staff.notes && (
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 whitespace-pre-line dark:bg-slate-800/60 dark:text-slate-300">
              {staff.notes}
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div>
            <h2 className="mb-3 font-display font-semibold text-slate-900 dark:text-white">Attendance · {monthLabel(data.month)}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Present" value={summary.present + summary.halfDay} icon={CalendarCheck} tone="green" />
              <StatCard title="Late" value={summary.late} icon={Clock} tone="violet" />
              <StatCard title="Absent" value={summary.absent} icon={UserX} tone="red" />
              <StatCard title="Leave" value={summary.leave} icon={CalendarOff} tone="blue" />
            </div>
            {summary.halfDay > 0 && (
              <p className="mt-2 text-xs text-slate-500">Present includes {summary.halfDay} half day{summary.halfDay === 1 ? '' : 's'}.</p>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-white">Daily Record</h3>
              {can('staff.attendance') && (
                <Link to="/staff/attendance" className="text-sm font-medium text-brand-600 hover:underline">Mark attendance</Link>
              )}
            </div>
            {data.attendance.length === 0 ? (
              <div className="p-4"><EmptyState title="No attendance marked this month." description="Attendance marked on the Attendance page will appear here." /></div>
            ) : (
              <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                {data.attendance.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{formatDate(a.date)}</span>
                    <span className="flex flex-wrap items-center gap-3 text-slate-500">
                      {(a.checkIn || a.checkOut) && <span>{a.checkIn || '—'} – {a.checkOut || '—'}</span>}
                      <AttendanceBadge status={a.status} />
                    </span>
                    {a.notes && <span className="w-full text-xs text-slate-500">{a.notes}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-white">Assignment History</h3>
          {canUpdate && isActive && (
            <button type="button" className="btn-primary" onClick={openAssign}>
              <Plus size={16} />
              Assign
            </button>
          )}
        </div>
        <DataTable
          columns={assignmentColumns}
          data={data.assignments}
          emptyTitle="No assignments yet."
          emptyDescription={isActive ? 'Assign this staff member to a vehicle or rental.' : 'Reactivate this staff member to assign them.'}
        />
      </div>

      {data.activity.length > 0 && (
        <div className="card p-4">
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Activity</h3>
          <ul className="space-y-2">
            {data.activity.map((log) => (
              <li key={log.id} className="flex flex-col gap-0.5 text-sm sm:flex-row sm:justify-between sm:gap-4">
                <span className="text-slate-700 dark:text-slate-300">{log.description}</span>
                <span className="shrink-0 text-xs text-slate-500">{log.user_name} · {formatDateTime(log.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        open={assignOpen}
        onClose={() => !saving && setAssignOpen(false)}
        title={`Assign ${staff.fullName}`}
        closeOnOverlay={!saving}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setAssignOpen(false)} disabled={saving}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleAssign} disabled={saving}>
              <Link2 size={16} />
              {saving ? 'Saving…' : 'Assign'}
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Vehicle</label>
            <select className="input-field" value={assignment.vehicleId} onChange={setField('vehicleId')}>
              <option value="">No vehicle</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}{v.registrationNumber ? ` (${v.registrationNumber})` : ''} · {v.status}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Rental</label>
            <select className="input-field" value={assignment.rentalId} onChange={setField('rentalId')}>
              <option value="">No rental</option>
              {rentalOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            {assignErrors.target && <p className="mt-1 text-xs text-red-600">{assignErrors.target}</p>}
          </div>
          <div>
            <label className="label">From</label>
            <input type="date" className="input-field" value={assignment.assignedFrom} onChange={setField('assignedFrom')} />
            {assignErrors.assignedFrom && <p className="mt-1 text-xs text-red-600">{assignErrors.assignedFrom}</p>}
          </div>
          <div>
            <label className="label">To <span className="font-normal text-slate-400">(Optional)</span></label>
            <input type="date" className="input-field" value={assignment.assignedTo} min={assignment.assignedFrom || undefined} onChange={setField('assignedTo')} />
            {assignErrors.assignedTo && <p className="mt-1 text-xs text-red-600">{assignErrors.assignedTo}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes <span className="font-normal text-slate-400">(Optional)</span></label>
            <textarea className="input-field" rows={2} maxLength={1000} value={assignment.notes} onChange={setField('notes')} />
            {assignErrors.notes && <p className="mt-1 text-xs text-red-600">{assignErrors.notes}</p>}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={statusOpen}
        onClose={() => !saving && setStatusOpen(false)}
        onConfirm={handleStatus}
        title={isActive ? 'Deactivate staff member' : 'Reactivate staff member'}
        message={
          isActive
            ? `Deactivate ${staff.fullName}? They will no longer appear on the attendance sheet or be assignable. Their attendance and assignment history is kept.`
            : `Reactivate ${staff.fullName}? They will appear on the attendance sheet again.`
        }
        confirmText={isActive ? 'Deactivate' : 'Reactivate'}
        danger={isActive}
        loading={saving}
      />

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => !saving && setRemoveTarget(null)}
        onConfirm={handleRemoveAssignment}
        title="Remove assignment"
        message="Remove this assignment record? This cannot be undone."
        confirmText="Remove"
        danger
        loading={saving}
      />
    </div>
  )
}
