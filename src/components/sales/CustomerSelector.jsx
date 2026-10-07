import { useMemo, useState } from 'react'
import { Plus, UserPlus } from 'lucide-react'
import AddressAutocomplete from '../ui/AddressAutocomplete'

export default function CustomerSelector({
  customers = [],
  customerId,
  customer,
  customerPhone,
  customerEmail,
  customerAddress,
  onChange,
  onAddCustomer,
  error,
}) {
  const [showNewForm, setShowNewForm] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '' })
  const [addError, setAddError] = useState('')
  const savedAddresses = useMemo(
    () => customers.filter((c) => c.address).map((c) => ({ address: c.address, city: c.city || '' })),
    [customers]
  )

  const handleSelect = (id) => {
    const selected = customers.find((c) => String(c.id) === String(id))
    if (selected) {
      onChange?.({
        customerId: String(selected.id),
        customer: selected.name,
        customerPhone: selected.phone || '',
        customerEmail: selected.email || '',
        customerAddress: selected.address || '',
      })
    } else {
      onChange?.({
        customerId: '',
        customer: '',
        customerPhone: '',
        customerEmail: '',
        customerAddress: '',
      })
    }
  }

  const handleAddCustomer = (e) => {
    e.preventDefault()
    if (!newCustomer.name.trim()) {
      setAddError('Customer name is required')
      return
    }
    setAddError('')
    onAddCustomer?.(newCustomer)
    setNewCustomer({ name: '', phone: '', email: '', address: '' })
    setShowNewForm(false)
  }

  const hasSelected = Boolean(customerId || customer?.trim())

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Customer</label>
        <select className="input-field" value={customerId || ''} onChange={(e) => handleSelect(e.target.value)}>
          <option value="">Select customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>

      {hasSelected && (
        <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-4">
          <div>
            <label className="label">Phone</label>
            <input className="input-field bg-white dark:bg-slate-900" value={customerPhone || ''} readOnly />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input-field bg-white dark:bg-slate-900" value={customerEmail || ''} readOnly />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <textarea
              className="input-field bg-white dark:bg-slate-900"
              rows={2}
              value={customerAddress || ''}
              readOnly
            />
          </div>
        </div>
      )}

      {!showNewForm ? (
        <button type="button" className="btn-secondary" onClick={() => setShowNewForm(true)}>
          <UserPlus size={16} />
          Add New Customer
        </button>
      ) : (
        <div className="rounded-xl border border-dashed border-brand-300 dark:border-brand-700 bg-brand-50/30 dark:bg-brand-950/20 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">New Customer</p>
          <form onSubmit={handleAddCustomer} className="space-y-3">
            <div>
              <label className="label">Name</label>
              <input
                className="input-field"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer((c) => ({ ...c, name: e.target.value }))}
                placeholder="Customer name"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Phone</label>
                <input
                  className="input-field"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, phone: e.target.value }))}
                  placeholder="+94 ..."
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input-field"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, email: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <div>
              <label className="label">Address</label>
              <AddressAutocomplete
                className="input-field"
                rows={2}
                value={newCustomer.address}
                onChange={(address) => setNewCustomer((c) => ({ ...c, address }))}
                savedAddresses={savedAddresses}
                placeholder="Street, city"
              />
            </div>
            {addError && <p className="text-xs text-red-600">{addError}</p>}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                <Plus size={16} />
                Save Customer
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowNewForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
