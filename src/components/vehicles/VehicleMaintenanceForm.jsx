import { useEffect, useState } from 'react'
import { Paperclip, X } from 'lucide-react'
import Modal from '../ui/Modal'
import { formatCurrency } from '../../utils/helpers'
import { MAINTENANCE_STATUSES, MAINTENANCE_TYPES, todayISO } from '../../utils/vehicleHelpers'

const NO_ERRORS = {}
const RECEIPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024

const emptyForm = (vehicleId = '') => ({
  vehicleId: vehicleId ? String(vehicleId) : '',
  maintenanceDate: todayISO(),
  maintenanceType: '',
  description: '',
  partsCost: '',
  labourCost: '',
  nextMaintenanceDate: '',
  meterReading: '',
  meterUnit: 'hours',
  serviceProvider: '',
  notes: '',
  status: 'Scheduled',
})

const toForm = (record) => ({
  vehicleId: String(record.vehicleId || ''),
  maintenanceDate: record.maintenanceDate || '',
  maintenanceType: record.maintenanceType || '',
  description: record.description || '',
  partsCost: record.partsCost ? String(record.partsCost) : '',
  labourCost: record.labourCost ? String(record.labourCost) : '',
  nextMaintenanceDate: record.nextMaintenanceDate || '',
  meterReading: record.meterReading != null ? String(record.meterReading) : '',
  meterUnit: record.meterUnit || 'hours',
  serviceProvider: record.serviceProvider || '',
  notes: record.notes || '',
  status: record.status || 'Scheduled',
})

const API_FIELD_MAP = {
  vehicle_id: 'vehicleId',
  maintenance_date: 'maintenanceDate',
  maintenance_type: 'maintenanceType',
  parts_cost: 'partsCost',
  labour_cost: 'labourCost',
  next_maintenance_date: 'nextMaintenanceDate',
  meter_reading: 'meterReading',
  meter_unit: 'meterUnit',
  service_provider: 'serviceProvider',
}

export const mapMaintenanceApiErrors = (errors) =>
  Object.fromEntries(Object.entries(errors || {}).map(([k, v]) => [API_FIELD_MAP[k] || k, v]))

function Field({ label, error, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

export default function VehicleMaintenanceForm({
  open,
  onClose,
  onSubmit,
  record,
  vehicles = [],
  presetVehicleId,
  saving = false,
  serverErrors = NO_ERRORS,
}) {
  const isEdit = Boolean(record)
  const [form, setForm] = useState(emptyForm())
  const [errors, setErrors] = useState({})
  const [receiptFile, setReceiptFile] = useState(null)
  const [removeReceipt, setRemoveReceipt] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(record ? toForm(record) : emptyForm(presetVehicleId))
    setErrors({})
    setReceiptFile(null)
    setRemoveReceipt(false)
  }, [open, record, presetVehicleId])

  useEffect(() => {
    setErrors((prev) => ({ ...prev, ...serverErrors }))
  }, [serverErrors])

  const selectedVehicle = vehicles.find((v) => String(v.id) === form.vehicleId)
  const total = (Number(form.partsCost) || 0) + (Number(form.labourCost) || 0)
  const vehicleRented = selectedVehicle?.status === 'Rented'

  const set = (key) => (e) => {
    const value = e.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const pickReceipt = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!RECEIPT_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, receipt: 'The receipt must be a PDF or an image (JPG, PNG or WEBP).' }))
      return
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      setErrors((prev) => ({ ...prev, receipt: 'The receipt must not be larger than 10 MB.' }))
      return
    }
    setErrors((prev) => ({ ...prev, receipt: undefined }))
    setReceiptFile(file)
    setRemoveReceipt(false)
  }

  const validate = () => {
    const found = {}
    if (!form.vehicleId) found.vehicleId = 'Please select a vehicle.'
    if (!form.maintenanceDate) found.maintenanceDate = 'Maintenance date is required.'
    if (!form.maintenanceType) found.maintenanceType = 'Please select the maintenance type.'
    if (form.nextMaintenanceDate && form.maintenanceDate && form.nextMaintenanceDate < form.maintenanceDate) {
      found.nextMaintenanceDate = 'Next maintenance date cannot be before the maintenance date.'
    }
    ;['partsCost', 'labourCost', 'meterReading'].forEach((key) => {
      if (form[key] !== '' && (!Number.isFinite(Number(form[key])) || Number(form[key]) < 0)) {
        found[key] = 'Enter a valid number (0 or more).'
      }
    })
    const startingWork = form.status === 'In Progress' && (!isEdit || record.status !== 'In Progress')
    if (startingWork && vehicleRented) {
      found.status = `${selectedVehicle.name} is currently rented. Complete the rental first, or save this record as Scheduled.`
    }
    return found
  }

  const submit = (e) => {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return
    const payload = { ...form }
    if (isEdit) delete payload.vehicleId
    onSubmit?.(payload, { receiptFile, removeReceipt })
  }

  const hasExistingReceipt = isEdit && record.hasReceipt && !removeReceipt

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose?.()}
      title={isEdit ? `Edit Maintenance ${record.maintenanceNumber}` : 'New Vehicle Maintenance'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="vehicle-maintenance-form" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Record'}
          </button>
        </>
      }
    >
      <form id="vehicle-maintenance-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Vehicle *" error={errors.vehicleId}>
          <select className="input-field" value={form.vehicleId} onChange={set('vehicleId')} disabled={isEdit}>
            <option value="">Select vehicle</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.name} · {v.registrationNumber} ({v.status})</option>
            ))}
          </select>
        </Field>
        <Field label="Maintenance Date *" error={errors.maintenanceDate}>
          <input type="date" className="input-field" value={form.maintenanceDate} onChange={set('maintenanceDate')} />
        </Field>
        <Field label="Maintenance Type *" error={errors.maintenanceType}>
          <select className="input-field" value={form.maintenanceType} onChange={set('maintenanceType')}>
            <option value="">Select type</option>
            {[...MAINTENANCE_TYPES, ...(form.maintenanceType && !MAINTENANCE_TYPES.includes(form.maintenanceType) ? [form.maintenanceType] : [])].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field
          label="Status"
          error={errors.status}
          hint="In Progress marks the vehicle Under Maintenance so it cannot be rented."
        >
          <select className="input-field" value={form.status} onChange={set('status')}>
            {MAINTENANCE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Description" error={errors.description} className="sm:col-span-2">
          <textarea className="input-field min-h-[70px]" value={form.description} onChange={set('description')} maxLength={5000} />
        </Field>
        <Field label="Parts Cost (LKR)" error={errors.partsCost}>
          <input type="number" min="0" step="0.01" className="input-field" value={form.partsCost} onChange={set('partsCost')} />
        </Field>
        <Field label="Labour Cost (LKR)" error={errors.labourCost}>
          <input type="number" min="0" step="0.01" className="input-field" value={form.labourCost} onChange={set('labourCost')} />
        </Field>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/40 sm:col-span-2">
          <span className="text-slate-500">Total cost: </span>
          <span className="font-semibold">{formatCurrency(total)}</span>
        </div>
        <Field label="Next Maintenance Date" error={errors.nextMaintenanceDate}>
          <input type="date" className="input-field" value={form.nextMaintenanceDate} onChange={set('nextMaintenanceDate')} min={form.maintenanceDate || undefined} />
        </Field>
        <Field label="Odometer / Working Hours" error={errors.meterReading || errors.meterUnit}>
          <div className="flex gap-2">
            <input type="number" min="0" step="0.1" className="input-field" value={form.meterReading} onChange={set('meterReading')} />
            <select className="input-field !w-28" value={form.meterUnit} onChange={set('meterUnit')} aria-label="Reading unit">
              <option value="hours">hours</option>
              <option value="km">km</option>
            </select>
          </div>
        </Field>
        <Field label="Service Provider" error={errors.serviceProvider}>
          <input className="input-field" value={form.serviceProvider} onChange={set('serviceProvider')} maxLength={150} />
        </Field>
        <Field label="Invoice / Receipt" error={errors.receipt} hint="PDF or image, up to 10 MB.">
          <div className="flex flex-wrap items-center gap-2">
            {(receiptFile || hasExistingReceipt) && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                <Paperclip size={12} />
                <span className="max-w-[10rem] truncate">{receiptFile?.name || record?.receiptName || 'Receipt'}</span>
                <button
                  type="button"
                  className="text-slate-400 hover:text-red-600"
                  aria-label="Remove receipt"
                  onClick={() => {
                    setReceiptFile(null)
                    if (record?.hasReceipt) setRemoveReceipt(true)
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            )}
            <label className="btn-secondary cursor-pointer !py-1.5 text-xs">
              <Paperclip size={14} />
              {receiptFile || hasExistingReceipt ? 'Replace' : 'Upload'}
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={pickReceipt} />
            </label>
          </div>
        </Field>
        <Field label="Notes" error={errors.notes} className="sm:col-span-2">
          <textarea className="input-field min-h-[60px]" value={form.notes} onChange={set('notes')} maxLength={2000} />
        </Field>
      </form>
    </Modal>
  )
}
