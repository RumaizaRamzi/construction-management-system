import { formatCurrency, formatDateDMY } from '../../utils/helpers'
import { sumPaymentAmounts } from '../../utils/financialHelpers'
import BrandLogo from '../ui/BrandLogo'

export default function PrintTransaction({
  type = 'income',
  record,
  payments = [],
}) {
  if (!record) return null

  const isIncome = type === 'income'
  const paid = sumPaymentAmounts(payments)
  const remaining = Math.max(0, (Number(record.amount) || 0) - paid)
  const partyLabel = isIncome ? 'Customer' : 'Supplier / Payee'
  const partyValue = isIncome ? record.customer : record.supplier
  const number = isIncome ? record.incomeId : record.expenseId
  const heading = isIncome ? 'Income Receipt' : 'Expense Payment Record'

  return (
    <div className="hidden print:block invoice-sheet mx-auto max-w-[210mm] bg-white text-slate-900 p-8">
      <div className="border-b border-slate-300 pb-4 mb-6">
        <BrandLogo className="mb-2 block h-16 w-16" />
        <h1 className="text-2xl font-bold tracking-tight">RN TRADING LANKA PVT. LTD</h1>
        <p className="text-sm text-slate-600">Construction Management System</p>
        <p className="mt-3 text-lg font-semibold">{heading}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-6">
        <div>
          <p className="text-slate-500">Transaction Number</p>
          <p className="font-semibold">{number}</p>
        </div>
        <div>
          <p className="text-slate-500">Date</p>
          <p className="font-semibold">{formatDateDMY(record.date)}</p>
        </div>
        <div>
          <p className="text-slate-500">{partyLabel}</p>
          <p className="font-semibold">{partyValue || '—'}</p>
        </div>
        <div>
          <p className="text-slate-500">Payment Status</p>
          <p className="font-semibold">{record.paymentStatus}</p>
        </div>
        <div className="col-span-2">
          <p className="text-slate-500">Description</p>
          <p className="font-semibold">{record.description}</p>
        </div>
        {record.reference && (
          <div>
            <p className="text-slate-500">Reference</p>
            <p className="font-semibold">{record.reference}</p>
          </div>
        )}
        <div>
          <p className="text-slate-500">Payment Method</p>
          <p className="font-semibold">{record.paymentMethod}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 border border-slate-300 rounded-lg p-4 mb-6 text-sm">
        <div>
          <p className="text-slate-500">Amount</p>
          <p className="font-bold text-base">{formatCurrency(record.amount)}</p>
        </div>
        <div>
          <p className="text-slate-500">Paid</p>
          <p className="font-bold text-base">{formatCurrency(paid)}</p>
        </div>
        <div>
          <p className="text-slate-500">Remaining</p>
          <p className="font-bold text-base">{formatCurrency(remaining)}</p>
        </div>
      </div>

      {payments.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold mb-2">Payments</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-left">
                <th className="py-2 pr-2">Date</th>
                <th className="py-2 pr-2">Amount</th>
                <th className="py-2 pr-2">Method</th>
                <th className="py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-200">
                  <td className="py-2 pr-2">{formatDateDMY(p.paymentDate)}</td>
                  <td className="py-2 pr-2">{formatCurrency(p.amount)}</td>
                  <td className="py-2 pr-2">{p.paymentMethod}</td>
                  <td className="py-2">{p.reference || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-2 gap-8 mt-16 text-sm">
        <div>
          <p className="text-slate-500 mb-8">Authorized By</p>
          <div className="border-t border-slate-400 pt-2">Name / Signature</div>
        </div>
        <div>
          <p className="text-slate-500 mb-8">Received By</p>
          <div className="border-t border-slate-400 pt-2">Signature</div>
        </div>
      </div>
    </div>
  )
}
