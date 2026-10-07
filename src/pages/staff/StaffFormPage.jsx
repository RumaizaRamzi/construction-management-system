import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ImagePlus, Trash2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import BranchSelect from '../../components/ui/BranchSelect'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import StaffAvatar from '../../components/staff/StaffAvatar'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import staffService from '../../services/staffService'
import authService from '../../services/authService'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'
import { todayISO } from '../../utils/vehicleHelpers'
import { MAX_PHOTO_BYTES, STAFF_STATUSES, mapStaffApiErrors, validateStaffForm } from '../../utils/staffHelpers'

const EMPTY_FORM = {
  staffCode: '',
  fullName: '',
  nic: '',
  phone: '',
  email: '',
  address: '',
  roleId: '',
  branchId: '',
  joinedDate: todayISO(),
  status: 'Active',
  userId: '',
  notes: '',
}

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function Field({ label, optional, error, children, className = '' }) {
  return (
    <div className={className}>
      <label className="label">
        {label} {optional && <span className="font-normal text-slate-400">(Optional)</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export default function StaffFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { can } = useApp()
  const { success, error: toastError } = useToast()

  const [form, setForm] = useState(EMPTY_FORM)
  const [original, setOriginal] = useState(null)
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [removePhoto, setRemovePhoto] = useState(false)

  useEffect(() => {
    staffService.getRoles().then(setRoles).catch(() => setRoles([]))
    if (can('users.view')) authService.getUsers().then((rows) => setUsers(Array.isArray(rows) ? rows : [])).catch(() => setUsers([]))
  }, [can])

  useEffect(() => {
    if (!isEdit) return undefined
    let active = true
    setLoading(true)
    staffService
      .getStaffMember(id)
      .then(({ staff }) => {
        if (!active) return
        setOriginal(staff)
        setForm({
          staffCode: staff.staffCode,
          fullName: staff.fullName,
          nic: staff.nic,
          phone: staff.phone,
          email: staff.email,
          address: staff.address,
          roleId: staff.roleId ? String(staff.roleId) : '',
          branchId: staff.branchId ? String(staff.branchId) : '',
          joinedDate: staff.joinedDate || '',
          status: staff.status,
          userId: staff.userId ? String(staff.userId) : '',
          notes: staff.notes,
        })
      })
      .catch((error) => active && setLoadError(getApiErrorMessage(error, 'Unable to load staff member.')))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id, isEdit])

  useEffect(() => {
    if (!photoFile) {
      setPreviewUrl(null)
      return undefined
    }
    const url = URL.createObjectURL(photoFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  const userOptions = useMemo(
    () => users.map((u) => ({ id: String(u.id), label: `${u.name}${u.email ? ` (${u.email})` : ''}` })),
    [users]
  )

  const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  const choosePhoto = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!PHOTO_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, photo: 'The staff photo must be a JPG, PNG or WEBP image.' }))
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setErrors((prev) => ({ ...prev, photo: 'The staff photo must not be larger than 2 MB.' }))
      return
    }
    setErrors((prev) => ({ ...prev, photo: undefined }))
    setRemovePhoto(false)
    setPhotoFile(file)
  }

  const clearPhoto = () => {
    setPhotoFile(null)
    if (original?.hasPhoto) setRemovePhoto(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    const nextErrors = validateStaffForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      toastError('Please check the form and correct the highlighted fields.')
      return
    }

    setSaving(true)
    try {
      const { staff, message } = isEdit ? await staffService.updateStaff(id, form) : await staffService.createStaff(form)
      success(message)
      try {
        if (photoFile) await staffService.uploadPhoto(staff.id, photoFile)
        else if (removePhoto && original?.hasPhoto) await staffService.deletePhoto(staff.id)
      } catch (photoError) {
        toastError(getApiErrorMessage(photoError, 'Staff saved, but the photo could not be uploaded.'))
      }
      navigate(`/staff/${staff.id}`)
    } catch (error) {
      const fieldErrors = mapStaffApiErrors(getApiValidationErrors(error))
      setErrors(fieldErrors)
      toastError(fieldErrors.nic || fieldErrors.staffCode || getApiErrorMessage(error, 'Unable to save staff member.'))
    } finally {
      setSaving(false)
    }
  }

  const backTo = isEdit ? `/staff/${id}` : '/staff'
  const title = isEdit ? `Edit ${original?.fullName || 'Staff'}` : 'Add Staff'

  if (loading) return <LoadingState label="Loading staff member..." />

  if (loadError) {
    return (
      <div className="page-shell">
        <PageHeader title={title} breadcrumbs={[{ label: 'Staff', to: '/staff' }, { label: 'Edit' }]} />
        <div className="card"><ApiErrorState title="Unable to load staff member" message={loadError} /></div>
      </div>
    )
  }

  const showExistingPhoto = !photoFile && !removePhoto && original?.hasPhoto

  return (
    <div className="page-shell">
      <PageHeader
        title={title}
        subtitle={isEdit ? original?.staffCode : 'A staff code is generated automatically if you leave it blank.'}
        breadcrumbs={[
          { label: 'Staff', to: '/staff' },
          ...(isEdit && original ? [{ label: original.fullName, to: backTo }] : []),
          { label: isEdit ? 'Edit' : 'Add' },
        ]}
        actions={
          <Link to={backTo} className="btn-secondary">
            <ArrowLeft size={16} />
            Back
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-3" noValidate>
        <div className="card p-5 space-y-4 lg:col-span-1">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">Photo</h2>
          <div className="flex flex-col items-center gap-3 text-center">
            <StaffAvatar staff={showExistingPhoto ? original : { fullName: form.fullName }} size="lg" previewUrl={previewUrl} />
            <div className="flex flex-wrap justify-center gap-2">
              <label className="btn-secondary cursor-pointer">
                <ImagePlus size={16} />
                {previewUrl || showExistingPhoto ? 'Change Photo' : 'Upload Photo'}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={choosePhoto} />
              </label>
              {(previewUrl || showExistingPhoto) && (
                <button type="button" className="btn-secondary" onClick={clearPhoto}>
                  <Trash2 size={16} />
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">JPG, PNG or WEBP, up to 2 MB. Optional.</p>
            {errors.photo && <p className="text-xs text-red-600">{errors.photo}</p>}
          </div>
        </div>

        <div className="card p-5 space-y-4 lg:col-span-2">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">Staff Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name" error={errors.fullName} className="sm:col-span-2">
              <input className="input-field" value={form.fullName} maxLength={150} onChange={set('fullName')} placeholder="e.g. Nimal Perera" />
            </Field>
            <Field label="NIC Number" error={errors.nic}>
              <input className="input-field uppercase" value={form.nic} maxLength={12} onChange={set('nic')} placeholder="e.g. 199012345678 or 901234567V" />
            </Field>
            <Field label="Staff Code" optional error={errors.staffCode}>
              <input className="input-field uppercase" value={form.staffCode} maxLength={30} onChange={set('staffCode')} placeholder="Auto, e.g. STF-0001" />
            </Field>
            <Field label="Phone" error={errors.phone}>
              <input type="tel" className="input-field" value={form.phone} maxLength={30} onChange={set('phone')} placeholder="e.g. 077 123 4567" />
            </Field>
            <Field label="Email" optional error={errors.email}>
              <input type="email" className="input-field" value={form.email} maxLength={150} onChange={set('email')} />
            </Field>
            <Field label="Address" error={errors.address} className="sm:col-span-2">
              <textarea className="input-field" rows={2} maxLength={500} value={form.address} onChange={set('address')} />
            </Field>
            <Field label="Role" error={errors.roleId}>
              <select className="input-field" value={form.roleId} onChange={set('roleId')}>
                <option value="">Select role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </Field>
            <BranchSelect label="Branch" value={form.branchId} onChange={set('branchId')} error={errors.branchId} />
            <Field label="Joined Date" error={errors.joinedDate}>
              <input type="date" className="input-field" value={form.joinedDate} max={todayISO()} onChange={set('joinedDate')} />
            </Field>
            <Field label="Status" error={errors.status}>
              <select className="input-field" value={form.status} onChange={set('status')}>
                {STAFF_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            {(userOptions.length > 0 || form.userId) && (
              <Field label="Linked User Account" optional error={errors.userId} className="sm:col-span-2">
                <select className="input-field" value={form.userId} onChange={set('userId')}>
                  <option value="">No login account</option>
                  {userOptions.map((u) => (
                    <option key={u.id} value={u.id}>{u.label}</option>
                  ))}
                  {form.userId && !userOptions.some((u) => u.id === form.userId) && (
                    <option value={form.userId}>{original?.userName || 'Linked user'}</option>
                  )}
                </select>
              </Field>
            )}
            <Field label="Notes" optional error={errors.notes} className="sm:col-span-2">
              <textarea className="input-field" rows={3} maxLength={2000} value={form.notes} onChange={set('notes')} />
            </Field>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end dark:border-slate-700">
            <Link to={backTo} className="btn-secondary justify-center">Cancel</Link>
            <button type="submit" className="btn-primary justify-center" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Staff'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
