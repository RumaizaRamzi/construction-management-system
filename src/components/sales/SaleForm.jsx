import { useState } from 'react'
import CustomerSelector from './CustomerSelector'
import ProductSelector from './ProductSelector'
import SaleItemRow from './SaleItemRow'
import SaleSummary from './SaleSummary'
import BranchSelect from '../ui/BranchSelect'
import { validateSaleForm } from '../../utils/saleHelpers'

export default function SaleForm({
  form,
  setForm,
  products = [],
  customers = [],
  categories = [],
  onSubmit,
  onCancel,
  onAddCustomer,
  submitLabel = 'Save Sale',
  secondaryAction,
}) {
  const [errors, setErrors] = useState({})

  const handleCustomerChange = (customerFields) => {
    setForm((f) => ({ ...f, ...customerFields }))
  }

  const handleAddItem = (item) => {
    setForm((f) => ({
      ...f,
      items: [...(f.items || []), { ...item, id: Date.now() }],
    }))
    setErrors((e) => ({ ...e, items: undefined }))
  }

  const handleItemChange = (index, item) => {
    setForm((f) => {
      const items = [...(f.items || [])]
      items[index] = item
      return { ...f, items }
    })
  }

  const handleItemRemove = (index) => {
    setForm((f) => ({
      ...f,
      items: (f.items || []).filter((_, i) => i !== index),
    }))
  }

  const runValidation = () => {
    const nextErrors = validateSaleForm(form, products)
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
        <div className="space-y-6">
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

          <div>
            <label className="label">Sale Date</label>
            <input
              type="date"
              className="input-field max-w-xs"
              value={form.date || ''}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
            {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date}</p>}
          </div>

          <BranchSelect
            className="max-w-xs"
            value={form.branchId ?? ''}
            onChange={(v) => setForm((f) => ({ ...f, branchId: v }))}
          />
        </div>

        <ProductSelector products={products} existingItems={form.items || []} onAddItem={handleAddItem} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-medium text-slate-900 dark:text-white">Line Items</p>
          {errors.items && <p className="text-xs text-red-600">{errors.items}</p>}
        </div>
        {errors.stock && <p className="text-xs text-red-600">{errors.stock}</p>}

        {(form.items || []).length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">No products added yet. Select a product above to begin.</div>
        ) : (
          <div className="space-y-3">
            {(form.items || []).map((item, index) => (
              <SaleItemRow
                key={item.id ?? index}
                item={item}
                index={index}
                onChange={handleItemChange}
                onRemove={handleItemRemove}
                error={errors[`item_${index}`]}
              />
            ))}
          </div>
        )}
      </div>

      <SaleSummary form={form} onChange={setForm} errors={errors} />

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        {secondaryAction && (
          <button type="button" className="btn-secondary" onClick={handleSecondary}>
            Save &amp; Print
          </button>
        )}
        <button type="submit" className="btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
