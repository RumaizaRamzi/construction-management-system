import IncomeSourceBadge from './IncomeSourceBadge'
import PaymentStatusBadge from './PaymentStatusBadge'
import { formatCurrency, formatDateDMY } from '../../utils/helpers'

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <div className="text-sm font-medium text-slate-900 dark:text-white break-words">
        {children || '—'}
      </div>
    </div>
  )
}

export default function IncomeDetails({ record }) {
  if (!record) return null

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <p className="text-xs text-slate-500 font-medium">{record.incomeId}</p>
              <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white mt-1">
                {record.description}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <IncomeSourceBadge source={record.source} />
              <PaymentStatusBadge status={record.paymentStatus} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Income ID">{record.incomeId}</Field>
            <Field label="Date">{formatDateDMY(record.date)}</Field>
            <Field label="Source">
              <IncomeSourceBadge source={record.source} />
            </Field>
            <Field label="Customer">{record.customer}</Field>
            <Field label="Reference">{record.reference}</Field>
            <Field label="Category">{record.category}</Field>
            <Field label="Payment Method">{record.paymentMethod}</Field>
            <Field label="Payment Status">
              <PaymentStatusBadge status={record.paymentStatus} />
            </Field>
            <Field label="Due Date">{formatDateDMY(record.dueDate)}</Field>
            <Field label="Description">{record.description}</Field>
          </div>

          {record.notes && (
            <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
              <Field label="Notes">{record.notes}</Field>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-4">
            Payment History
          </h3>
          {(record.payments || []).length === 0 ? (
            <p className="text-sm text-slate-500">No payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase text-slate-500">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Method</th>
                    <th className="py-2 pr-3">Reference</th>
                    <th className="py-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {record.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDateDMY(p.paymentDate)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap font-medium">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{p.paymentMethod}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{p.reference || '—'}</td>
                      <td className="py-2 text-slate-500">{p.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-5 space-y-4">
          <h3 className="font-display font-semibold text-slate-900 dark:text-white">
            Payment Summary
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Total Amount</span>
              <span className="font-semibold">{formatCurrency(record.amount)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Paid</span>
              <span className="font-semibold text-emerald-600">
                {formatCurrency(record.paidAmount)}
              </span>
            </div>
            <div className="flex justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-3">
              <span className="text-slate-500">Remaining</span>
              <span className="font-semibold text-amber-600">
                {formatCurrency(record.remainingAmount)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
