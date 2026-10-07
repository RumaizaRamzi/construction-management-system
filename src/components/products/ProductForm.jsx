import { PRODUCT_CONDITIONS, PRODUCT_IMAGES, PRODUCT_STATUSES, PRODUCT_UNITS } from '../../data/productsData'
import BranchSelect from '../ui/BranchSelect'

export default function ProductForm({ form, errors = {}, categories = [], onChange, onSubmit, onCancel, submitLabel = 'Save Product', purpose }) {
  const set = (key, value) => onChange?.({ ...form, [key]: value })
  const showSalePrice = purpose !== 'rent'
  const showRentalPrice = purpose !== 'sale'

  const handleCategory = (categoryId) => {
    const cat = categories.find((c) => String(c.id) === String(categoryId))
    onChange?.({
      ...form,
      categoryId,
      category: cat?.name || '',
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">Product Image</label>
        <div className="flex flex-wrap gap-3">
          {PRODUCT_IMAGES.map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => set('image', src)}
              className={`rounded-xl border-2 p-1 transition-colors ${
                form.image === src ? 'border-brand-500' : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <img src={src} alt="Product option" className="h-16 w-20 rounded-lg object-cover bg-slate-100" />
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Product Name</label>
          <input className="input-field" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Concrete Mixer" />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>
        <div>
          <label className="label">Serial Number</label>
          <input className="input-field" value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} placeholder="Enter serial number" />
          {errors.serial_number && <p className="mt-1 text-xs text-red-600">{errors.serial_number}</p>}
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input-field" value={form.categoryId} onChange={(e) => handleCategory(e.target.value)}>
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
        </div>
        <div>
          <label className="label">
            Unit <span className="font-normal text-slate-400">(Optional)</span>
          </label>
          <select className="input-field" value={form.unit || ''} onChange={(e) => set('unit', e.target.value)}>
            <option value="">No unit</option>
            {PRODUCT_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Description</label>
        <textarea
          className="input-field"
          rows={3}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Product description..."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Quantity</label>
          <input type="number" min="0" className="input-field" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
          {errors.quantity && <p className="mt-1 text-xs text-red-600">{errors.quantity}</p>}
        </div>
        <div>
          <label className="label">Minimum Stock Level</label>
          <input type="number" min="0" className="input-field" value={form.minStock} onChange={(e) => set('minStock', e.target.value)} />
          {errors.minStock && <p className="mt-1 text-xs text-red-600">{errors.minStock}</p>}
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input-field" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Warehouse / Yard" />
        </div>
      </div>

      <BranchSelect value={form.branchId ?? ''} onChange={(v) => set('branchId', v)} />

      <div className={`grid gap-4 ${showSalePrice && showRentalPrice ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <div>
          <label className="label">
            Purchase Cost (LKR) <span className="font-normal text-slate-400">(Optional)</span>
          </label>
          <input type="number" min="0" className="input-field" value={form.purchaseCost} onChange={(e) => set('purchaseCost', e.target.value)} />
          {errors.purchaseCost && <p className="mt-1 text-xs text-red-600">{errors.purchaseCost}</p>}
        </div>
        {showSalePrice ? (
          <div>
            <label className="label">
              Sale Price (LKR) <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <input type="number" min="0" className="input-field" value={form.salePrice} onChange={(e) => set('salePrice', e.target.value)} />
            {errors.salePrice && <p className="mt-1 text-xs text-red-600">{errors.salePrice}</p>}
          </div>
        ) : null}
        {showRentalPrice ? (
          <div>
            <label className="label">
              Rental Price / day (LKR) <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <input type="number" min="0" className="input-field" value={form.rentalPrice} onChange={(e) => set('rentalPrice', e.target.value)} />
            {errors.rentalPrice && <p className="mt-1 text-xs text-red-600">{errors.rentalPrice}</p>}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Condition</label>
          <select className="input-field" value={form.condition} onChange={(e) => set('condition', e.target.value)}>
            {PRODUCT_CONDITIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {errors.condition && <p className="mt-1 text-xs text-red-600">{errors.condition}</p>}
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input-field" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {errors.status && <p className="mt-1 text-xs text-red-600">{errors.status}</p>}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary">{submitLabel}</button>
      </div>
    </form>
  )
}
