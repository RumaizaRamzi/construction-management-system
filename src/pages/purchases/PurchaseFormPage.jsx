import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import BranchSelect from '../../components/ui/BranchSelect'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import purchaseService, { PURCHASE_PAYMENT_TYPES } from '../../services/purchaseService'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'
import { formatCurrency } from '../../utils/helpers'
import { LISTING_TYPE_LABELS } from '../../utils/productHelpers'
import { todayISO } from '../../utils/vehicleHelpers'

const LISTING_OPTIONS = ['none', 'sale', 'rent', 'both']
const includesSale = (listing) => listing === 'sale' || listing === 'both'
const includesRent = (listing) => listing === 'rent' || listing === 'both'

let rowSeq = 0
const newRow = (overrides = {}) => ({
  key: `row-${(rowSeq += 1)}`,
  mode: 'existing',
  productId: '',
  name: '',
  serialNumber: '',
  categoryId: '',
  quantity: '1',
  unitCost: '',
  listingType: 'none',
  salePrice: '',
  rentalPrice: '',
  ...overrides,
})

const priceText = (value) => (value != null && Number(value) > 0 ? String(value) : '')
const amount = (value) => (value === '' || value == null ? 0 : Number(value) || 0)

function FieldError({ message }) {
  return message ? <p className="mt-1 text-xs text-red-600">{message}</p> : null
}

export default function PurchaseFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { suppliers = [], products = [], categories = [], loadProducts, loadStockHistory } = useApp()
  const { success, error: toastError } = useToast()

  const [header, setHeader] = useState({
    supplierId: '',
    purchaseDate: todayISO(),
    billNumber: '',
    notes: '',
    branchId: '',
    paymentType: 'Credit',
    paidAmount: '',
  })
  const [rows, setRows] = useState(() => [newRow()])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState(null)
  const [original, setOriginal] = useState(null)

  const productById = useMemo(() => new Map(products.map((p) => [String(p.id), p])), [products])

  useEffect(() => {
    if (!isEdit) return undefined
    let active = true
    setLoading(true)
    setLoadError(null)
    purchaseService
      .getPurchase(id)
      .then(({ purchase }) => {
        if (!active) return
        setOriginal(purchase)
        setHeader({
          supplierId: String(purchase.supplierId || ''),
          purchaseDate: purchase.purchaseDate || todayISO(),
          billNumber: purchase.billNumber,
          notes: purchase.notes,
          branchId: purchase.branchId != null ? String(purchase.branchId) : '',
          paymentType: purchase.paymentType,
          paidAmount: String(purchase.paidAmount),
        })
        setRows(
          purchase.items.map((item) =>
            newRow({
              productId: String(item.productId),
              quantity: String(item.quantity),
              unitCost: String(item.unitCost),
              listingType: item.listingType || item.productListingType || 'none',
              salePrice: item.salePrice != null ? String(item.salePrice) : '',
              rentalPrice: item.rentalPrice != null ? String(item.rentalPrice) : '',
            })
          )
        )
      })
      .catch((error) => active && setLoadError(getApiErrorMessage(error, 'Unable to load purchase.')))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id, isEdit])

  const total = useMemo(
    () => Math.round(rows.reduce((sum, r) => sum + amount(r.quantity) * amount(r.unitCost), 0) * 100) / 100,
    [rows]
  )

  useEffect(() => {
    if (header.paymentType === 'Paid') {
      setHeader((h) => (h.paidAmount === String(total) ? h : { ...h, paidAmount: String(total) }))
    }
  }, [header.paymentType, total])

  const paid = amount(header.paidAmount)
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100)

  const supplierOptions = suppliers.filter((s) => s.status !== 'Inactive' || String(s.id) === header.supplierId)
  const selectedProductIds = rows.filter((r) => r.mode === 'existing' && r.productId).map((r) => r.productId)

  const setHeaderField = (key) => (e) => {
    const value = e?.target ? e.target.value : e
    setHeader((h) => {
      const next = { ...h, [key]: value }
      if (key === 'paymentType' && value !== 'Paid' && h.paymentType === 'Paid') next.paidAmount = ''
      return next
    })
  }

  const updateRow = (index, patch) => {
    setRows((current) => current.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const selectProduct = (index, productId) => {
    const product = productById.get(String(productId))
    const row = rows[index]
    updateRow(index, {
      productId,
      listingType: product?.listingType || 'none',
      unitCost: row.unitCost !== '' ? row.unitCost : product?.purchaseCostSet ? String(product.purchaseCost) : '',
      salePrice: priceText(product?.salePrice),
      rentalPrice: priceText(product?.rentalPrice),
    })
  }

  const switchMode = (index, mode) => {
    updateRow(index, {
      mode,
      productId: '',
      name: '',
      serialNumber: '',
      categoryId: '',
      listingType: 'none',
      salePrice: '',
      rentalPrice: '',
    })
  }

  const addRow = () => setRows((current) => [...current, newRow()])

  const removeRow = (index) => {
    setRows((current) => current.filter((_, i) => i !== index))
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([k]) => !k.startsWith('items.'))))
  }

  const validate = () => {
    const next = {}
    if (!header.supplierId) next.supplier_id = 'Please select a supplier.'
    if (!header.purchaseDate) next.purchase_date = 'Purchase date is required.'
    else if (header.purchaseDate > todayISO()) next.purchase_date = 'Purchase date cannot be in the future.'
    if (!rows.length) next.items = 'Add at least one item.'

    const existingSerials = new Set(products.map((p) => String(p.serial_number || '').trim().toUpperCase()))
    const seenSerials = new Set()
    rows.forEach((r, i) => {
      const k = (field) => `items.${i}.${field}`
      if (r.mode === 'existing') {
        if (!r.productId) next[k('product_id')] = 'Select a product.'
      } else {
        const serial = r.serialNumber.trim().toUpperCase()
        if (!r.name.trim()) next[k('name')] = 'Product name is required.'
        if (!serial) next[k('serial_number')] = 'Serial number is required.'
        else if (existingSerials.has(serial)) next[k('serial_number')] = 'This serial number is already used by another product.'
        else if (seenSerials.has(serial)) next[k('serial_number')] = 'Each new product needs a different serial number.'
        if (serial) seenSerials.add(serial)
        if (!r.categoryId) next[k('category_id')] = 'Category is required.'
      }
      const qty = Number(r.quantity)
      if (r.quantity === '' || !Number.isInteger(qty) || qty < 1) next[k('quantity')] = 'Quantity must be at least 1.'
      if (r.unitCost === '' || Number(r.unitCost) < 0) next[k('unit_cost')] = 'Unit cost is required.'
      if (includesSale(r.listingType) && r.salePrice !== '' && Number(r.salePrice) < 0) {
        next[k('sale_price')] = 'Sale price cannot be negative.'
      }
      if (includesRent(r.listingType) && r.rentalPrice !== '' && Number(r.rentalPrice) < 0) {
        next[k('rental_price')] = 'Rental price cannot be negative.'
      }
    })

    if (header.paidAmount !== '' && paid < 0) next.paid_amount = 'Amount paid cannot be negative.'
    else if (paid > total + 0.0001) next.paid_amount = 'Amount paid cannot be more than the purchase total.'
    return next
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      toastError('Please check the form and correct the highlighted fields.')
      return
    }

    setSaving(true)
    try {
      const payload = { ...header, items: rows }
      const { purchase, message } = isEdit
        ? await purchaseService.updatePurchase(id, payload)
        : await purchaseService.createPurchase(payload)
      success(message)
      loadProducts().catch(() => {})
      loadStockHistory().catch(() => {})
      navigate(`/purchases/${purchase?.id ?? id}`)
    } catch (error) {
      const fieldErrors = getApiValidationErrors(error)
      setErrors(fieldErrors)
      toastError(fieldErrors.purchase || fieldErrors.items || getApiErrorMessage(error, 'Unable to save purchase.'))
    } finally {
      setSaving(false)
    }
  }

  const backTo = isEdit ? `/purchases/${id}` : '/purchases'
  const title = isEdit ? `Edit ${original?.purchaseNumber || 'Purchase'}` : 'New Purchase'

  if (loading) return <LoadingState label="Loading purchase..." />

  if (loadError) {
    return (
      <div className="page-shell">
        <PageHeader title={title} breadcrumbs={[{ label: 'Purchases', to: '/purchases' }, { label: 'Edit' }]} />
        <div className="card"><ApiErrorState title="Unable to load purchase" message={loadError} /></div>
      </div>
    )
  }

  if (original?.status === 'Cancelled') {
    return (
      <div className="page-shell">
        <PageHeader title={title} breadcrumbs={[{ label: 'Purchases', to: '/purchases' }, { label: original.purchaseNumber }]} />
        <div className="card p-8 text-center">
          <p className="page-subtitle">A cancelled purchase cannot be edited.</p>
          <Link to={backTo} className="btn-primary mt-6 inline-flex">
            <ArrowLeft size={18} />
            Back to Purchase
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <PageHeader
        title={title}
        subtitle="Record stock bought from a supplier. Stock and Stock History are updated when you save."
        breadcrumbs={[
          { label: 'Purchases', to: '/purchases' },
          ...(isEdit && original ? [{ label: original.purchaseNumber, to: backTo }] : []),
          { label: isEdit ? 'Edit' : 'New' },
        ]}
        actions={
          <Link to={backTo} className="btn-secondary">
            <ArrowLeft size={16} />
            Back
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="card p-5 space-y-4">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">Purchase Details</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="label">Supplier</label>
              <select className="input-field" value={header.supplierId} onChange={setHeaderField('supplierId')}>
                <option value="">Select supplier</option>
                {supplierOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.status === 'Inactive' ? ' (Inactive)' : ''}
                  </option>
                ))}
              </select>
              <FieldError message={errors.supplier_id} />
            </div>
            <div>
              <label className="label">Purchase Date</label>
              <input type="date" className="input-field" value={header.purchaseDate} max={todayISO()} onChange={setHeaderField('purchaseDate')} />
              <FieldError message={errors.purchase_date} />
            </div>
            <div>
              <label className="label">Bill / Reference No. <span className="font-normal text-slate-400">(Optional)</span></label>
              <input className="input-field" value={header.billNumber} maxLength={100} onChange={setHeaderField('billNumber')} />
              <FieldError message={errors.bill_number} />
            </div>
            <BranchSelect label="Branch" value={header.branchId} onChange={setHeaderField('branchId')} error={errors.branch_id} />
          </div>
          <div>
            <label className="label">Notes <span className="font-normal text-slate-400">(Optional)</span></label>
            <textarea className="input-field" rows={2} maxLength={2000} value={header.notes} onChange={setHeaderField('notes')} />
            <FieldError message={errors.notes} />
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display font-semibold text-slate-900 dark:text-white">Items</h2>
              <p className="text-sm text-slate-500">Restock an existing product or add a new one.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={addRow}>
              <Plus size={16} />
              Add Item
            </button>
          </div>
          <FieldError message={errors.items} />

          {rows.map((row, index) => {
            const k = (field) => errors[`items.${index}.${field}`]
            const product = row.mode === 'existing' ? productById.get(String(row.productId)) : null
            const productOptions = products.filter(
              (p) => (p.status !== 'Inactive' && !selectedProductIds.includes(String(p.id))) || String(p.id) === String(row.productId)
            )
            return (
              <div key={row.key} className="rounded-xl border border-slate-200 p-4 space-y-4 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Item {index + 1}</span>
                    <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-700">
                      {[['existing', 'Existing product'], ['new', 'New product']].map(([mode, label]) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => row.mode !== mode && switchMode(index, mode)}
                          className={`rounded-md px-2.5 py-1 font-medium ${
                            row.mode === mode ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {rows.length > 1 && (
                    <button type="button" className="btn-danger !px-2 !py-1" onClick={() => removeRow(index)} aria-label={`Remove item ${index + 1}`}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {row.mode === 'existing' ? (
                    <div className="sm:col-span-2">
                      <label className="label">Product</label>
                      <select className="input-field" value={row.productId} onChange={(e) => selectProduct(index, e.target.value)}>
                        <option value="">Select product</option>
                        {productOptions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.serial_number ? ` · ${p.serial_number}` : ''}
                          </option>
                        ))}
                      </select>
                      {product && (
                        <p className="mt-1 text-xs text-slate-500">
                          In stock: {product.available} · Currently: {LISTING_TYPE_LABELS[product.listingType] || product.listingType}
                        </p>
                      )}
                      <FieldError message={k('product_id')} />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="label">Product Name</label>
                        <input className="input-field" value={row.name} maxLength={255} onChange={(e) => updateRow(index, { name: e.target.value })} placeholder="e.g. Concrete Mixer" />
                        <FieldError message={k('name')} />
                      </div>
                      <div>
                        <label className="label">Serial Number</label>
                        <input className="input-field" value={row.serialNumber} maxLength={100} onChange={(e) => updateRow(index, { serialNumber: e.target.value })} placeholder="Enter serial number" />
                        <FieldError message={k('serial_number')} />
                      </div>
                      <div>
                        <label className="label">Category</label>
                        <select className="input-field" value={row.categoryId} onChange={(e) => updateRow(index, { categoryId: e.target.value })}>
                          <option value="">Select category</option>
                          {categories.filter((c) => c.status !== 'Inactive').map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <FieldError message={k('category_id')} />
                      </div>
                      <div className="hidden xl:block" />
                    </>
                  )}
                  <div>
                    <label className="label">Quantity</label>
                    <input type="number" min="1" step="1" className="input-field" value={row.quantity} onChange={(e) => updateRow(index, { quantity: e.target.value })} />
                    <FieldError message={k('quantity')} />
                  </div>
                  <div>
                    <label className="label">Unit Cost</label>
                    <input type="number" min="0" step="0.01" className="input-field" value={row.unitCost} onChange={(e) => updateRow(index, { unitCost: e.target.value })} />
                    <FieldError message={k('unit_cost')} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="label">Listing</label>
                    <select className="input-field" value={row.listingType} onChange={(e) => updateRow(index, { listingType: e.target.value })}>
                      {LISTING_OPTIONS.map((value) => (
                        <option key={value} value={value}>{LISTING_TYPE_LABELS[value]}</option>
                      ))}
                    </select>
                    <FieldError message={k('listing_type')} />
                  </div>
                  {includesSale(row.listingType) && (
                    <div>
                      <label className="label">
                        Sale Price <span className="font-normal text-slate-400">(Optional)</span>
                      </label>
                      <input type="number" min="0" step="0.01" className="input-field" value={row.salePrice} onChange={(e) => updateRow(index, { salePrice: e.target.value })} />
                      <FieldError message={k('sale_price')} />
                    </div>
                  )}
                  {includesRent(row.listingType) && (
                    <div>
                      <label className="label">
                        Rental Price / day <span className="font-normal text-slate-400">(Optional)</span>
                      </label>
                      <input type="number" min="0" step="0.01" className="input-field" value={row.rentalPrice} onChange={(e) => updateRow(index, { rentalPrice: e.target.value })} />
                      <FieldError message={k('rental_price')} />
                    </div>
                  )}
                  <div className="xl:col-start-4 text-right self-end">
                    <p className="label">Line Total</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{formatCurrency(amount(row.quantity) * amount(row.unitCost))}</p>
                  </div>
                </div>
                {row.listingType === 'none' && (
                  <p className="text-xs text-slate-500">Not listed yet: this product will not appear in New Sale, Rentals, Bookings or the availability calendar until it is listed.</p>
                )}
              </div>
            )
          })}
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">Payment</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="label">Payment Type</label>
              <select className="input-field" value={header.paymentType} onChange={setHeaderField('paymentType')}>
                {PURCHASE_PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <FieldError message={errors.payment_type} />
            </div>
            <div>
              <label className="label">Amount Paid</label>
              <input
                type="number"
                min="0"
                step="0.01"
                max={total}
                className="input-field"
                value={header.paidAmount}
                onChange={setHeaderField('paidAmount')}
                placeholder="0.00"
              />
              <FieldError message={errors.paid_amount} />
            </div>
            <div>
              <p className="label">Total</p>
              <p className="py-2 text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(total)}</p>
            </div>
            <div>
              <p className="label">Balance</p>
              <p className={`py-2 text-lg font-bold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(balance)}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Link to={backTo} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Purchase'}
          </button>
        </div>
      </form>
    </div>
  )
}
