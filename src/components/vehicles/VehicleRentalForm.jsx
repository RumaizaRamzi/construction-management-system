import { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal'
import StatusBadge from '../ui/StatusBadge'
import { formatCurrency } from '../../utils/helpers'
import {
  RATE_TYPES,
  RENTAL_STATUSES,
  calculateVehicleRental,
  paymentStatusFor,
  rateFor,
  todayISO,
  unitLabel,
} from '../../utils/vehicleHelpers'

const NO_ERRORS = {}

const emptyForm = (vehicleId = '') => ({
  customerId: '',
  vehicleId: vehicleId ? String(vehicleId) : '',
  startDate: todayISO(),
  expectedReturnDate: '',
  actualReturnDate: '',
  rateType: 'Daily',
  rentalRate: '',
  securityDeposit: '',
  paidAmount: '',
  status: 'Active',
  notes: '',
})

const toForm = (rental) => ({
  customerId: String(rental.customerId || ''),
  vehicleId: String(rental.vehicleId || ''),
  startDate: rental.startDate || '',
  expectedReturnDate: rental.expectedReturnDate || '',
  actualReturnDate: rental.actualReturnDate || '',
  rateType: rental.rateType || 'Daily',
  rentalRate: String(rental.rentalRate ?? ''),
  securityDeposit: rental.securityDeposit ? String(rental.securityDeposit) : '',
  paidAmount: rental.paidAmount ? String(rental.paidAmount) : '',
  status: rental.status || 'Active',
  notes: rental.notes || '',
})

const API_FIELD_MAP = {
  customer_id: 'customerId',
  vehicle_id: 'vehicleId',
  start_date: 'startDate',
  expected_return_date: 'expectedReturnDate',
  actual_return_date: 'actualReturnDate',
  rate_type: 'rateType',
  rental_rate: 'rentalRate',
  security_deposit: 'securityDeposit',
  paid_amount: 'paidAmount',
}

export const mapRentalApiErrors = (errors) =>
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

export default function VehicleRentalForm({
  open,
  onClose,
  onSubmit,
  rental,
  vehicles = [],
  customers = [],
  presetVehicleId,
  saving = false,
  serverErrors = NO_ERRORS,
}) {
  const isEdit = Boolean(rental)
  const [form, setForm] = useState(emptyForm())
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!open) return
    if (rental) {
      setForm(toForm(rental))
    } else {
      const preset = vehicles.find((v) => String(v.id) === String(presetVehicleId) && v.status === 'Available')
      const next = emptyForm(preset?.id)
      if (preset) next.rentalRate = rateFor(preset, 'Daily') != null ? String(rateFor(preset, 'Daily')) : ''
      setForm(next)
    }
    setErrors({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rental, presetVehicleId])

  useEffect(() => {
    setErrors((prev) => ({ ...prev, ...serverErrors }))
  }, [serverErrors])

  const rentableVehicles = useMemo(
    () => vehicles.filter((v) => v.status === 'Available' || (isEdit && String(v.id) === String(rental?.vehicleId))),
    [vehicles, isEdit, rental]
  )
  const unavailableCount = vehicles.length - vehicles.filter((v) => v.status === 'Available').length
  const selectedVehicle = vehicles.find((v) => String(v.id) === form.vehicleId)

  const activeCustomers = useMemo(
    () => customers.filter((c) => c.status !== 'Inactive' || String(c.id) === form.customerId),
    [customers, form.customerId]
  )

  const calc = calculateVehicleRental(form)
  const paid = Number(form.paidAmount) || 0
  const balance = Math.max(calc.total - paid, 0)
  const paymentStatus = paymentStatusFor(calc.total, paid)

  const set = (key) => (e) => {
    const value = e.target.value
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'vehicleId' || key === 'rateType') {
        const vehicle = vehicles.find((v) => String(v.id) === (key === 'vehicleId' ? value : prev.vehicleId))
        const rate = rateFor(vehicle, key === 'rateType' ? value : prev.rateType)
        if (rate != null) next.rentalRate = String(rate)
      }
      if (key === 'status' && value === 'Completed' && !prev.actualReturnDate) next.actualReturnDate = todayISO()
      if (key === 'status' && value === 'Active') next.actualReturnDate = ''
      if (key === 'actualReturnDate' && value && prev.status === 'Active') next.status = 'Completed'
      return next
    })
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = () => {
    const found = {}
    if (!form.customerId) found.customerId = 'Please select a customer.'
    if (!form.vehicleId) found.vehicleId = 'Please select a vehicle.'
    else if (!isEdit && selectedVehicle?.status !== 'Available') {
      found.vehicleId = `${selectedVehicle?.name || 'This vehicle'} is ${selectedVehicle?.status} and cannot be rented.`
    }
    if (!form.startDate) found.startDate = 'Rental start date is required.'
    if (form.expectedReturnDate && form.startDate && form.expectedReturnDate < form.startDate) {
      found.expectedReturnDate = 'Expected return date cannot be before the start date.'
    }
    if (form.actualReturnDate && form.startDate && form.actualReturnDate < form.startDate) {
      found.actualReturnDate = 'Actual return date cannot be before the start date.'
    }
    ;['rentalRate', 'securityDeposit', 'paidAmount'].forEach((key) => {
      if (form[key] !== '' && (!Number.isFinite(Number(form[key])) || Number(form[key]) < 0)) {
        found[key] = 'Enter a valid amount (0 or more).'
      }
    })
    if (!found.paidAmount && paid > calc.total) {
      found.paidAmount = `Payment amount cannot be more than the rental total of ${formatCurrency(calc.total)}.`
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
    else delete payload.actualReturnDate
    if (!isEdit) delete payload.status
    onSubmit?.(payload)
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose?.()}
      title={isEdit ? `Edit Vehicle Rental ${rental.rentalNumber}` : 'New Vehicle Rental'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="vehicle-rental-form" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Rental'}
          </button>
        </>
      }
    >
      <form id="vehicle-rental-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Customer *" error={errors.customerId}>
          <select className="input-field" value={form.customerId} onChange={set('customerId')}>
            <option value="">Select customer</option>
            {activeCustomers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
            ))}
          </select>
        </Field>
        <Field
          label="Vehicle *"
          error={errors.vehicleId}
          hint={!isEdit && unavailableCount > 0 ? `${unavailableCount} vehicle(s) hidden because they are Rented, Under Maintenance or Out of Service.` : null}
        >
          <select className="input-field" value={form.vehicleId} onChange={set('vehicleId')} disabled={isEdit}>
            <option value="">{rentableVehicles.length ? 'Select vehicle' : 'No vehicles available'}</option>
            {rentableVehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.name} · {v.registrationNumber}</option>
            ))}
          </select>
        </Field>
        <Field label="Start Date *" error={errors.startDate}>
          <input type="date" className="input-field" value={form.startDate} onChange={set('startDate')} />
        </Field>
        <Field label="Expected Return Date (Optional)" error={errors.expectedReturnDate}>
          <input type="date" className="input-field" value={form.expectedReturnDate} onChange={set('expectedReturnDate')} min={form.startDate || undefined} />
        </Field>
        {isEdit && (
          <Field label="Actual Return Date" error={errors.actualReturnDate} hint="Setting this marks the vehicle as returned.">
            <input type="date" className="input-field" value={form.actualReturnDate} onChange={set('actualReturnDate')} min={form.startDate || undefined} />
          </Field>
        )}
        {isEdit && (
          <Field label="Rental Status" error={errors.status}>
            <select className="input-field" value={form.status} onChange={set('status')}>
              {RENTAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        )}
        <Field label="Rate Type" error={errors.rateType}>
          <select className="input-field" value={form.rateType} onChange={set('rateType')}>
            {RATE_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field
          label={`Rate (LKR per ${form.rateType === 'Weekly' ? 'week' : form.rateType === 'Monthly' ? 'month' : 'day'})`}
          error={errors.rentalRate}
          hint={selectedVehicle && rateFor(selectedVehicle, form.rateType) == null ? `No ${form.rateType.toLowerCase()} rate set for this vehicle.` : null}
        >
          <input type="number" min="0" step="0.01" className="input-field" value={form.rentalRate} onChange={set('rentalRate')} />
        </Field>
        <Field label="Security Deposit (LKR)" error={errors.securityDeposit}>
          <input type="number" min="0" step="0.01" className="input-field" value={form.securityDeposit} onChange={set('securityDeposit')} />
        </Field>
        <Field label="Payment Amount (LKR)" error={errors.paidAmount} hint="Total amount received for this rental so far.">
          <input type="number" min="0" step="0.01" className="input-field" value={form.paidAmount} onChange={set('paidAmount')} />
        </Field>

        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/40 sm:col-span-2 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Duration</p>
            <p className="font-medium">{calc.days} day{calc.days === 1 ? '' : 's'}</p>
            {form.rateType !== 'Daily' && <p className="text-xs text-slate-500">Billed {unitLabel(form.rateType, calc.units)}</p>}
            {!form.expectedReturnDate && !form.actualReturnDate && <p className="text-xs text-slate-500">Open-ended: 1 period until returned</p>}
          </div>
          <div>
            <p className="text-xs text-slate-500">Total</p>
            <p className="font-medium">{formatCurrency(calc.total)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Balance</p>
            <p className="font-medium">{formatCurrency(balance)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Payment Status</p>
            <StatusBadge status={paymentStatus} />
          </div>
        </div>

        <Field label="Notes" error={errors.notes} className="sm:col-span-2">
          <textarea className="input-field min-h-[70px]" value={form.notes} onChange={set('notes')} maxLength={2000} />
        </Field>
      </form>
    </Modal>
  )
}
