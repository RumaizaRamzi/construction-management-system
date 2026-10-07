import { useEffect, useMemo, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import Modal from '../ui/Modal'
import BranchSelect from '../ui/BranchSelect'
import { VEHICLE_CATEGORIES, VEHICLE_STATUSES, todayISO, useVehiclePhoto } from '../../utils/vehicleHelpers'

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const NO_ERRORS = {}

const emptyForm = {
  name: '',
  category: '',
  registrationNumber: '',
  brand: '',
  model: '',
  manufactureYear: '',
  purchaseDate: '',
  purchaseCost: '',
  dailyRate: '',
  weeklyRate: '',
  monthlyRate: '',
  branchId: '',
  description: '',
  status: 'Available',
}

const toForm = (vehicle) => ({
  ...emptyForm,
  ...Object.fromEntries(
    Object.keys(emptyForm).map((key) => [key, vehicle?.[key] == null ? emptyForm[key] : String(vehicle[key])])
  ),
})

export function validateVehicleForm(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Vehicle name is required.'
  if (!form.category.trim()) errors.category = 'Please select a category.'
  if (!form.registrationNumber.trim()) errors.registrationNumber = 'Registration number is required.'
  const maxYear = new Date().getFullYear() + 1
  if (form.manufactureYear !== '') {
    const year = Number(form.manufactureYear)
    if (!Number.isInteger(year) || year < 1950 || year > maxYear) {
      errors.manufactureYear = `Enter a year between 1950 and ${maxYear}.`
    }
  }
  if (form.purchaseDate && form.purchaseDate > todayISO()) errors.purchaseDate = 'Purchase date cannot be in the future.'
  ;['purchaseCost', 'dailyRate', 'weeklyRate', 'monthlyRate'].forEach((key) => {
    if (form[key] !== '' && (!Number.isFinite(Number(form[key])) || Number(form[key]) < 0)) {
      errors[key] = 'Enter a valid amount (0 or more).'
    }
  })
  return errors
}

const API_FIELD_MAP = {
  registration_number: 'registrationNumber',
  manufacture_year: 'manufactureYear',
  purchase_date: 'purchaseDate',
  purchase_cost: 'purchaseCost',
  daily_rate: 'dailyRate',
  weekly_rate: 'weeklyRate',
  monthly_rate: 'monthlyRate',
  branch_id: 'branchId',
}

export const mapVehicleApiErrors = (errors) =>
  Object.fromEntries(Object.entries(errors || {}).map(([k, v]) => [API_FIELD_MAP[k] || k, v]))

function Field({ label, error, children, className = '' }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

export default function VehicleForm({
  open,
  onClose,
  onSubmit,
  vehicle,
  categories = VEHICLE_CATEGORIES,
  saving = false,
  serverErrors = NO_ERRORS,
}) {
  const isEdit = Boolean(vehicle)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const existingPhoto = useVehiclePhoto(open && vehicle?.id, open && vehicle?.hasPhoto && !removePhoto)

  useEffect(() => {
    if (!open) return
    setForm(vehicle ? toForm(vehicle) : emptyForm)
    setErrors({})
    setPhotoFile(null)
    setPhotoPreview(null)
    setRemovePhoto(false)
  }, [open, vehicle])

  useEffect(() => {
    setErrors((prev) => ({ ...prev, ...serverErrors }))
  }, [serverErrors])

  useEffect(() => {
    if (!photoFile) return undefined
    const url = URL.createObjectURL(photoFile)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  const categoryOptions = useMemo(() => {
    const list = [...categories]
    if (form.category && !list.includes(form.category)) list.push(form.category)
    return list
  }, [categories, form.category])

  const statusOptions = VEHICLE_STATUSES.filter((s) => s !== 'Rented' || form.status === 'Rented')
  const statusLocked = vehicle?.status === 'Rented'

  const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const pickPhoto = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!PHOTO_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, photo: 'The vehicle photo must be a JPG, PNG or WEBP image.' }))
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setErrors((prev) => ({ ...prev, photo: 'The vehicle photo must not be larger than 5 MB.' }))
      return
    }
    setErrors((prev) => ({ ...prev, photo: undefined }))
    setPhotoFile(file)
    setRemovePhoto(false)
  }

  const clearPhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
    if (vehicle?.hasPhoto) setRemovePhoto(true)
  }

  const submit = (e) => {
    e.preventDefault()
    const found = validateVehicleForm(form)
    setErrors(found)
    if (Object.keys(found).length) return
    const payload = { ...form }
    if (statusLocked) delete payload.status
    onSubmit?.(payload, { photoFile, removePhoto })
  }

  const shownPhoto = photoPreview || existingPhoto

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose?.()}
      title={isEdit ? 'Edit Vehicle' : 'Add Vehicle'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="vehicle-form" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Vehicle'}
          </button>
        </>
      }
    >
      <form id="vehicle-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Vehicle Name *" error={errors.name}>
          <input className="input-field" value={form.name} onChange={set('name')} maxLength={150} />
        </Field>
        <Field label="Category *" error={errors.category}>
          <select className="input-field" value={form.category} onChange={set('category')}>
            <option value="">Select category</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Registration Number *" error={errors.registrationNumber}>
          <input
            className="input-field uppercase"
            value={form.registrationNumber}
            onChange={set('registrationNumber')}
            maxLength={50}
          />
        </Field>
        <Field label="Brand" error={errors.brand}>
          <input className="input-field" value={form.brand} onChange={set('brand')} maxLength={100} />
        </Field>
        <Field label="Model" error={errors.model}>
          <input className="input-field" value={form.model} onChange={set('model')} maxLength={100} />
        </Field>
        <Field label="Manufacturing Year" error={errors.manufactureYear}>
          <input
            type="number"
            className="input-field"
            value={form.manufactureYear}
            onChange={set('manufactureYear')}
            min={1950}
            max={new Date().getFullYear() + 1}
          />
        </Field>
        <Field label="Purchase Date" error={errors.purchaseDate}>
          <input type="date" className="input-field" value={form.purchaseDate} onChange={set('purchaseDate')} max={todayISO()} />
        </Field>
        <Field label="Purchase Cost (LKR)" error={errors.purchaseCost}>
          <input type="number" min="0" step="0.01" className="input-field" value={form.purchaseCost} onChange={set('purchaseCost')} />
        </Field>

        <div className="sm:col-span-2">
          <p className="label">Rental Rate (LKR)</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Daily" error={errors.dailyRate}>
              <input type="number" min="0" step="0.01" className="input-field" value={form.dailyRate} onChange={set('dailyRate')} />
            </Field>
            <Field label="Weekly" error={errors.weeklyRate}>
              <input type="number" min="0" step="0.01" className="input-field" value={form.weeklyRate} onChange={set('weeklyRate')} />
            </Field>
            <Field label="Monthly" error={errors.monthlyRate}>
              <input type="number" min="0" step="0.01" className="input-field" value={form.monthlyRate} onChange={set('monthlyRate')} />
            </Field>
          </div>
        </div>

        <BranchSelect
          label="Branch (Optional)"
          value={form.branchId}
          onChange={set('branchId')}
          error={errors.branchId}
        />
        <Field label="Status" error={errors.status}>
          <select className="input-field" value={form.status} onChange={set('status')} disabled={statusLocked}>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {statusLocked
              ? 'This vehicle is on an active rental. Return it from Vehicle Rental to change its status.'
              : 'Rented is set automatically when a rental is created.'}
          </p>
        </Field>

        <Field label="Photo" error={errors.photo} className="sm:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            {shownPhoto ? (
              <div className="relative">
                <img src={shownPhoto} alt="Vehicle" className="h-24 w-32 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-slate-500 shadow hover:text-red-600 dark:bg-slate-800"
                  aria-label="Remove photo"
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}
            <label className="btn-secondary cursor-pointer">
              <ImagePlus size={16} />
              {shownPhoto ? 'Change Photo' : 'Upload Photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pickPhoto} />
            </label>
            <span className="text-xs text-slate-500">JPG, PNG or WEBP, up to 5 MB.</span>
          </div>
        </Field>

        <Field label="Description" error={errors.description} className="sm:col-span-2">
          <textarea className="input-field min-h-[80px]" value={form.description} onChange={set('description')} maxLength={5000} />
        </Field>
      </form>
    </Modal>
  )
}
