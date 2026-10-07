import { formatCurrency, formatDateDMY } from '../../utils/helpers'
import Modal from '../ui/Modal'

export default function PaymentViewModal({ open, onClose, payment }) {
  if (!payment) return null

  return (
    <Modal open={open} onClose={onClose} title="Payment Details" size="md">
      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <p className="text-xs text-slate-500">Payment ID</p>
          <p className="font-medium">{payment.paymentId}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Payment Date</p>
          <p className="font-medium">{formatDateDMY(payment.paymentDate)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Amount</p>
          <p className="font-medium">{formatCurrency(payment.amount)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Payment Method</p>
          <p className="font-medium">{payment.paymentMethod}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Reference</p>
          <p className="font-medium">{payment.reference || '—'}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-slate-500">Notes</p>
          <p className="font-medium">{payment.notes || '—'}</p>
        </div>
      </div>
    </Modal>
  )
}
