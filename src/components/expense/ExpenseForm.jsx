import { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal'
import BranchSelect from '../ui/BranchSelect'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  calcRemaining,
  deriveExpensePaymentStatus,
  emptyExpenseForm,
  validateExpenseForm,
} from '../../utils/expenseHelpers'
import { formatCurrency } from '../../utils/helpers'

export default function ExpenseForm({
  open,
  onClose,
  onSubmit,
  initialValues,
  suppliers = [],
  products = [],
  maintenance = [],
  isEdit = false,
}) {
  const [form, setForm] = useState(emptyExpenseForm)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm(initialValues ? { ...emptyExpenseForm(), ...initialValues } : emptyExpenseForm())
      setErrors({})
    }
  }, [open, initialValues])

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const remaining = useMemo(
    () => calcRemaining(form.amount, form.paidAmount),
    [form.amount, form.paidAmount]
  )

  const derivedStatus = useMemo(
    () =>
      deriveExpensePaymentStatus({
        amount: form.amount,
        paidAmount: form.paidAmount,
        dueDate: form.dueDate || null,
      }),
    [form.amount, form.paidAmount, form.dueDate]
  )

  const handleSupplierChange = (supplierId) => {
    if (!supplierId) {
      setForm((prev) => ({ ...prev, supplierId: '', supplier: '' }))
      return
    }
    const supplier = suppliers.find((s) => String(s.id) === String(supplierId))
    setForm((prev) => ({
      ...prev,
      supplierId,
      supplier: supplier?.name || prev.supplier,
    }))
  }

  const handleProductChange = (productId) => {
    if (!productId) {
      setForm((prev) => ({ ...prev, productId: '', product: '' }))
      return
    }
    const product = products.find((p) => String(p.id) === String(productId))
    setForm((prev) => ({
      ...prev,
      productId,
      product: product?.name || '',
    }))
  }

  const handleMaintenanceChange = (maintenanceId) => {
    if (!maintenanceId) {
      setForm((prev) => ({ ...prev, maintenanceId: '', maintenanceLabel: '' }))
      return
    }
    const record = maintenance.find((m) => String(m.id) === String(maintenanceId))
    if (!record) return
    setForm((prev) => ({
      ...prev,
      maintenanceId,
      maintenanceLabel: `${record.maintenanceId} — ${record.product}`,
      productId: record.productId ? String(record.productId) : prev.productId,
      product: record.product || prev.product,
      description: prev.description || record.description || `${record.product} Service Cost`,
      amount: prev.amount || record.cost || record.estimatedCost || '',
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const nextErrors = validateExpenseForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    onSubmit?.({
      ...form,
      paymentStatus: derivedStatus,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Expense' : 'Add Expense'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="expense-form" className="btn-primary">
            Save Expense
          </button>
        </>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Expense Date</label>
          <input
            type="date"
            className="input-field"
            value={form.date}
            onChange={(e) => setField('date', e.target.value)}
          />
          {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date}</p>}
        </div>

        <div>
          <label className="label">Expense Category</label>
          <select
            className="input-field"
            value={form.category}
            onChange={(e) => setField('category', e.target.value)}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Supplier / Payee</label>
          <select
            className="input-field"
            value={form.supplierId || ''}
            onChange={(e) => handleSupplierChange(e.target.value)}
          >
            <option value="">Select supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {!form.supplierId && (
            <input
              className="input-field mt-2"
              value={form.supplier}
              onChange={(e) => setField('supplier', e.target.value)}
              placeholder="Or type payee name"
            />
          )}
          {errors.supplier && <p className="mt-1 text-xs text-red-600">{errors.supplier}</p>}
        </div>

        <div>
          <label className="label">Reference Number</label>
          <input
            className="input-field"
            value={form.reference}
            onChange={(e) => setField('reference', e.target.value)}
            placeholder="PO / receipt / transfer ref"
          />
        </div>

        <div>
          <label className="label">Related Product</label>
          <select
            className="input-field"
            value={form.productId || ''}
            onChange={(e) => handleProductChange(e.target.value)}
          >
            <option value="">No Related Product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Related Maintenance (optional)</label>
          <select
            className="input-field"
            value={form.maintenanceId || ''}
            onChange={(e) => handleMaintenanceChange(e.target.value)}
          >
            <option value="">No maintenance link</option>
            {maintenance.map((m) => (
              <option key={m.id} value={m.id}>
                {m.maintenanceId} — {m.product} ({m.maintenanceType})
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea
            className="input-field min-h-[72px]"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-600">{errors.description}</p>
          )}
        </div>

        <div>
          <label className="label">Amount (LKR)</label>
          <input
            type="number"
            min="0"
            className="input-field"
            value={form.amount}
            onChange={(e) => setField('amount', e.target.value)}
          />
          {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
        </div>

        <div>
          <label className="label">Paid Amount (LKR)</label>
          <input
            type="number"
            min="0"
            className="input-field"
            value={form.paidAmount}
            onChange={(e) => setField('paidAmount', e.target.value)}
          />
          {errors.paidAmount && (
            <p className="mt-1 text-xs text-red-600">{errors.paidAmount}</p>
          )}
        </div>

        <div>
          <label className="label">Remaining Amount</label>
          <input
            className="input-field bg-slate-50 dark:bg-slate-800/50"
            value={formatCurrency(remaining)}
            readOnly
          />
        </div>

        <div>
          <label className="label">Payment Status (auto)</label>
          <input
            className="input-field bg-slate-50 dark:bg-slate-800/50"
            value={derivedStatus}
            readOnly
          />
        </div>

        <div>
          <label className="label">Payment Method</label>
          <select
            className="input-field"
            value={form.paymentMethod}
            onChange={(e) => setField('paymentMethod', e.target.value)}
          >
            {EXPENSE_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Due Date (optional)</label>
          <input
            type="date"
            className="input-field"
            value={form.dueDate || ''}
            onChange={(e) => setField('dueDate', e.target.value)}
          />
        </div>

        <BranchSelect value={form.branchId ?? ''} onChange={(v) => setField('branchId', v)} />

        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea
            className="input-field min-h-[72px]"
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </div>
      </form>
    </Modal>
  )
}
