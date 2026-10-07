import { useMemo, useState } from 'react'
import { calcLateDays, calcLateFee } from '../../utils/rentalHelpers'
import { formatCurrency, formatDate } from '../../utils/helpers'

const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Damaged', 'Needs Maintenance']

/** Units still out per rental item, mirroring RentalService::outstandingByItem on the API. */
export function outstandingByItem(rental) {
  const items = rental?.items?.length
    ? rental.items
    : [{ id: null, productId: rental?.productId, product: rental?.product, quantity: rental?.quantity || 0 }]
  const outstanding = new Map(items.map((item) => [item.id, Number(item.quantity || 0)]))

  for (const ret of rental?.returns || []) {
    if (ret.items?.length) {
      for (const line of ret.items) {
        if (outstanding.has(line.rentalItemId)) {
          const used = Number(line.returnedQty || 0) + Number(line.damagedQty || 0) + Number(line.missingQty || 0)
          outstanding.set(line.rentalItemId, Math.max(0, outstanding.get(line.rentalItemId) - used))
        }
      }
      continue
    }
    let legacy = Number(ret.returnedQty || 0) + Number(ret.damagedQty || 0) + Number(ret.missingQty || 0)
    for (const [id, left] of outstanding) {
      if (legacy <= 0) break
      const take = Math.min(left, legacy)
      outstanding.set(id, left - take)
      legacy -= take
    }
  }

  return items.map((item) => ({ ...item, outstanding: outstanding.get(item.id) ?? 0 }))
}

export default function RentalReturnForm({ rental, lateFeePerDay = 2500, onSubmit, onCancel, submitting = false }) {
  const today = new Date().toISOString().slice(0, 10)
  const lines = useMemo(() => outstandingByItem(rental).filter((line) => line.outstanding > 0), [rental])

  const [form, setForm] = useState({
    returnDate: today,
    condition: rental?.productCondition || 'Good',
    damageDescription: '',
    notes: '',
    damageFee: '',
  })
  const [quantities, setQuantities] = useState(() =>
    Object.fromEntries(lines.map((line) => [line.id ?? 'single', { returned: line.outstanding, damaged: 0, missing: 0 }]))
  )
  const [errors, setErrors] = useState({})

  const totals = useMemo(
    () =>
      Object.values(quantities).reduce(
        (sum, q) => ({
          returned: sum.returned + Number(q.returned || 0),
          damaged: sum.damaged + Number(q.damaged || 0),
          missing: sum.missing + Number(q.missing || 0),
        }),
        { returned: 0, damaged: 0, missing: 0 }
      ),
    [quantities]
  )
  const unitsInReturn = totals.returned + totals.damaged + totals.missing

  const lateDays = useMemo(
    () => calcLateDays(rental?.expectedReturn, form.returnDate),
    [rental?.expectedReturn, form.returnDate]
  )
  const lateFee = useMemo(
    () => calcLateFee(lateDays, lateFeePerDay, Math.max(1, unitsInReturn)),
    [lateDays, lateFeePerDay, unitsInReturn]
  )

  const deposit = Number(rental?.deposit || 0)
  const damageFee = Number(form.damageFee || 0)
  const depositRefund = Math.max(0, deposit - damageFee - lateFee)

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const setQty = (lineKey, field, value) =>
    setQuantities((prev) => ({ ...prev, [lineKey]: { ...prev[lineKey], [field]: value } }))

  const validate = () => {
    const next = {}
    if (!form.returnDate) next.returnDate = 'Return date is required'
    lines.forEach((line) => {
      const key = line.id ?? 'single'
      const q = quantities[key] || {}
      const values = [q.returned, q.damaged, q.missing].map((v) => Number(v || 0))
      if (values.some((v) => v < 0 || !Number.isInteger(v))) {
        next[`line-${key}`] = 'Quantities must be whole numbers of 0 or more'
      } else if (values.reduce((a, b) => a + b, 0) !== line.outstanding) {
        next[`line-${key}`] = `Returned + damaged + missing must equal ${line.outstanding} unit(s) for ${line.product}`
      }
    })
    if (unitsInReturn <= 0) next.quantity = 'At least one unit must be accounted for'
    if (form.damageFee !== '' && !(Number(form.damageFee) >= 0)) next.damageFee = 'Damage fee cannot be negative'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    const items = lines
      .filter((line) => line.id != null)
      .map((line) => {
        const q = quantities[line.id]
        return {
          rental_item_id: line.id,
          returned_quantity: Number(q.returned || 0),
          damaged_quantity: Number(q.damaged || 0),
          missing_quantity: Number(q.missing || 0),
        }
      })
    onSubmit?.({
      ...form,
      items: items.length ? items : undefined,
      returnedQty: totals.returned,
      damagedQty: totals.damaged,
      missingQty: totals.missing,
      damageFee: damageFee,
      lateDays,
      lateFee,
      depositRefund,
    })
  }

  if (!rental) return null

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card p-5 space-y-4">
        <div>
          <h3 className="font-medium text-slate-900 dark:text-white">Return Equipment</h3>
          <p className="text-sm text-slate-500 mt-1">
            {rental.rentalId} — {lines.length} item line(s), {lines.reduce((s, l) => s + l.outstanding, 0)} unit(s) still out
          </p>
          <p className="text-xs text-slate-500 mt-1">Expected return: {formatDate(rental.expectedReturn)}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Return Date</label>
            <input type="date" className="input-field" value={form.returnDate} onChange={(e) => set('returnDate', e.target.value)} />
            {errors.returnDate && <p className="mt-1 text-xs text-red-600">{errors.returnDate}</p>}
          </div>
          <div>
            <label className="label">Condition</label>
            <select className="input-field" value={form.condition} onChange={(e) => set('condition', e.target.value)}>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/60">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Still out</th>
                <th className="px-3 py-2">Returned</th>
                <th className="px-3 py-2">Damaged</th>
                <th className="px-3 py-2">Missing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.map((line) => {
                const key = line.id ?? 'single'
                const q = quantities[key] || {}
                return (
                  <tr key={key}>
                    <td className="px-3 py-2">
                      <p className="font-medium">{line.product}</p>
                      {errors[`line-${key}`] && <p className="mt-1 text-xs text-red-600">{errors[`line-${key}`]}</p>}
                    </td>
                    <td className="px-3 py-2">{line.outstanding}</td>
                    {['returned', 'damaged', 'missing'].map((field) => (
                      <td key={field} className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          max={line.outstanding}
                          step="1"
                          aria-label={`${field} quantity for ${line.product}`}
                          className="input-field !w-24"
                          value={q[field]}
                          onChange={(e) => setQty(key, field, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {errors.quantity && <p className="text-xs text-red-600">{errors.quantity}</p>}

        <div>
          <label className="label">Damage Description</label>
          <textarea
            className="input-field"
            rows={3}
            value={form.damageDescription}
            onChange={(e) => set('damageDescription', e.target.value)}
            placeholder="Describe any damage or missing parts..."
          />
        </div>

        <div>
          <label className="label">
            Damage Fee <span className="font-normal text-slate-400">(Optional)</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input-field max-w-xs"
            value={form.damageFee}
            onChange={(e) => set('damageFee', e.target.value)}
            placeholder="0.00"
          />
          {errors.damageFee && <p className="mt-1 text-xs text-red-600">{errors.damageFee}</p>}
        </div>

        <div>
          <label className="label">Return Notes</label>
          <textarea
            className="input-field"
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Inspection notes, meter readings, etc."
          />
        </div>
      </div>

      <div className="card p-5 space-y-3 text-sm">
        <p className="font-medium text-slate-900 dark:text-white">Charges &amp; Refund</p>
        <div className="flex justify-between">
          <span className="text-slate-500">Late Days</span>
          <span className={lateDays > 0 ? 'text-red-600 font-medium' : ''}>{lateDays > 0 ? `${lateDays} days` : 'None'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">
            Late Fee ({formatCurrency(lateFeePerDay)}/day × {Math.max(1, unitsInReturn)} unit(s))
          </span>
          <span className="font-medium">{formatCurrency(lateFee)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Damage Fee</span>
          <span className="font-medium">{formatCurrency(damageFee)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Deposit Held</span>
          <span className="font-medium">{formatCurrency(deposit)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 text-base font-bold">
          <span>Deposit Refund</span>
          <span className="text-emerald-600">{formatCurrency(depositRefund)}</span>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel Return
        </button>
        <button type="submit" className="btn-primary" disabled={submitting || lines.length === 0}>
          {submitting ? 'Processing...' : 'Complete Return'}
        </button>
      </div>
    </form>
  )
}
