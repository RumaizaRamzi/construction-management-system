import { useState } from 'react'
import CustomerSelector from '../sales/CustomerSelector'
import RentalProductSelector from './RentalProductSelector'
import RentalCalculation from './RentalCalculation'
import BranchSelect from '../ui/BranchSelect'
import { validateRentalForm } from '../../utils/rentalHelpers'

export default function RentalForm({
  form,
  setForm,
  products = [],
  customers = [],
  onSubmit,
  onCancel,
  onAddCustomer,
  submitLabel = 'Save Rental',
  secondaryAction,
  showRentalStatus = false,
  submitting = false,
}) {
  const [errors, setErrors] = useState({})

  const handleCustomerChange = (customerFields) => {
    setForm((f) => ({ ...f, ...customerFields }))
  }

  const handleProductChange = (fields) => {
    setForm((f) => ({ ...f, ...fields }))
    if (fields.quantity !== undefined || fields.productId !== undefined) {
      setErrors((e) => ({ ...e, quantity: undefined, product: undefined, stock: undefined }))
    }
  }

  const runValidation = () => {
    const nextErrors = validateRentalForm(form, products)
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!runValidation()) return
    onSubmit?.(form)
  }

  const handleSecondary = (e) => {
    e.preventDefault()
    if (!runValidation()) return
    secondaryAction?.(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card p-5">
          <CustomerSelector
            customers={customers}
            customerId={form.customerId}
            customer={form.customer}
            customerPhone={form.customerPhone}
            customerEmail={form.customerEmail}
            customerAddress={form.customerAddress}
            onChange={handleCustomerChange}
            onAddCustomer={onAddCustomer}
            error={errors.customer}
          />
        </div>

        <RentalProductSelector
          products={products}
          productId={form.productId}
          quantity={form.quantity}
          rate={form.rate}
          originalQty={form._originalQty}
          onChange={handleProductChange}
          errors={errors}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
        <div>
          <label className="label">Start Date</label>
          <input
            type="date"
            className="input-field"
            value={form.startDate || ''}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
          />
          {errors.startDate && <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>}
        </div>
        <div>
          <label className="label">
            Expected Return Date <span className="font-normal text-slate-400">(Optional)</span>
          </label>
          <input
            type="date"
            className="input-field"
            value={form.expectedReturn || ''}
            min={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, expectedReturn: e.target.value }))}
          />
          {errors.expectedReturn ? (
            <p className="mt-1 text-xs text-red-600">{errors.expectedReturn}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">Optional — leave blank if not known yet.</p>
          )}
        </div>
        <BranchSelect
          value={form.branchId ?? ''}
          onChange={(v) => setForm((f) => ({ ...f, branchId: v }))}
        />
      </div>

      <RentalCalculation
        form={form}
        onChange={(updates) => setForm((f) => ({ ...f, ...updates }))}
        errors={errors}
        showRentalStatus={showRentalStatus}
      />

      <div className="card p-5 space-y-4">
        <div>
          <label className="label">Notes</label>
          <textarea
            className="input-field"
            rows={3}
            value={form.notes || ''}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="General notes for this rental..."
          />
        </div>
        <div>
          <label className="label">Special Instructions</label>
          <textarea
            className="input-field"
            rows={2}
            value={form.specialInstructions || ''}
            onChange={(e) => setForm((f) => ({ ...f, specialInstructions: e.target.value }))}
            placeholder="Handling or usage instructions..."
          />
        </div>
        <div>
          <label className="label">Delivery Notes</label>
          <textarea
            className="input-field"
            rows={2}
            value={form.deliveryNotes || ''}
            onChange={(e) => setForm((f) => ({ ...f, deliveryNotes: e.target.value }))}
            placeholder="Delivery location, gate access, contact on site..."
          />
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        {secondaryAction && (
          <button type="button" className="btn-secondary" onClick={handleSecondary} disabled={submitting}>
            Save &amp; Print Agreement
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
