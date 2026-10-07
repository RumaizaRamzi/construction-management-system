import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import {
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_TECHNICIANS,
  MAINTENANCE_TYPES,
  emptyMaintenanceForm,
  validateMaintenanceForm,
} from '../../utils/maintenanceHelpers'

export default function MaintenanceForm({
  open,
  onClose,
  onSubmit,
  initialValues,
  products = [],
  isEdit = false,
}) {
  const [form, setForm] = useState(emptyMaintenanceForm)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm(initialValues ? { ...emptyMaintenanceForm(), ...initialValues } : emptyMaintenanceForm())
      setErrors({})
    }
  }, [open, initialValues])

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleProductChange = (productId) => {
    const product = products.find((p) => String(p.id) === String(productId))
    if (product) {
      setForm((prev) => ({
        ...prev,
        productId: String(product.id),
        product: product.name,
        product_serial_number: product.serial_number || '',
        productCategory: product.category || '',
        productImage: product.image || '',
      }))
    } else {
      setForm((prev) => ({
        ...prev,
        productId: '',
        product: '',
        product_serial_number: '',
        productCategory: '',
        productImage: '',
      }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const nextErrors = validateMaintenanceForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    onSubmit?.({
      ...form,
      cost: form.estimatedCost,
      status: form.status || 'Scheduled',
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Maintenance' : 'Create Maintenance'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="maintenance-form" className="btn-primary">
            Save
          </button>
        </>
      }
    >
      <form id="maintenance-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Product</label>
          <select
            className="input-field"
            value={form.productId || ''}
            onChange={(e) => handleProductChange(e.target.value)}
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.serial_number}){p.status === 'Maintenance' ? ' — Under Maintenance' : ''}
              </option>
            ))}
          </select>
          {errors.product && <p className="mt-1 text-xs text-red-600">{errors.product}</p>}
        </div>

        <div>
          <label className="label">Maintenance Type</label>
          <select
            className="input-field"
            value={form.maintenanceType}
            onChange={(e) => setField('maintenanceType', e.target.value)}
          >
            {MAINTENANCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea
            className="input-field min-h-[80px]"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Describe the repair or service work"
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-600">{errors.description}</p>
          )}
        </div>

        <div>
          <label className="label">Start Date</label>
          <input
            type="date"
            className="input-field"
            value={form.startDate}
            onChange={(e) => setField('startDate', e.target.value)}
          />
          {errors.startDate && <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>}
        </div>

        <div>
          <label className="label">Expected Completion</label>
          <input
            type="date"
            className="input-field"
            value={form.expectedCompletion}
            onChange={(e) => setField('expectedCompletion', e.target.value)}
          />
          {errors.expectedCompletion && (
            <p className="mt-1 text-xs text-red-600">{errors.expectedCompletion}</p>
          )}
        </div>

        <div>
          <label className="label">Technician</label>
          <select
            className="input-field"
            value={form.technician}
            onChange={(e) => setField('technician', e.target.value)}
          >
            <option value="">Select technician</option>
            {form.technician && !MAINTENANCE_TECHNICIANS.includes(form.technician) && (
              <option value={form.technician}>{form.technician}</option>
            )}
            {MAINTENANCE_TECHNICIANS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {errors.technician && (
            <p className="mt-1 text-xs text-red-600">{errors.technician}</p>
          )}
        </div>

        <div>
          <label className="label">Estimated Cost (LKR)</label>
          <input
            type="number"
            min="0"
            className="input-field"
            value={form.estimatedCost}
            onChange={(e) => setField('estimatedCost', e.target.value)}
            placeholder="0"
          />
        </div>

        <div>
          <label className="label">Priority</label>
          <select
            className="input-field"
            value={form.priority}
            onChange={(e) => setField('priority', e.target.value)}
          >
            {MAINTENANCE_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {isEdit && (
          <div>
            <label className="label">Status</label>
            <select
              className="input-field"
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
            >
              <option value="Scheduled">Scheduled</option>
              <option value="In Progress">In Progress</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea
            className="input-field min-h-[72px]"
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            placeholder="Optional notes"
          />
        </div>
      </form>
    </Modal>
  )
}
