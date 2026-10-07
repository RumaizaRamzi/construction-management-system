import { useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import Modal from './Modal'
import saleService from '../../services/saleService'
import rentalService from '../../services/rentalService'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'

const MAX_LENGTH = 640

const TYPES = {
  sale: { service: saleService, permissions: ['sales.create', 'sales.update'] },
  rental: { service: rentalService, permissions: ['rentals.create', 'rentals.update', 'rentals.return'] },
}

/** "Send via SMS" action for a sale or rental invoice; texts it to the customer through the configured gateway. */
export default function SendInvoiceSmsButton({ type, id, className = 'btn-secondary', label = 'Send via SMS' }) {
  const { canAny } = useApp()
  const { success, error: toastError } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [configured, setConfigured] = useState(true)
  const [reference, setReference] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState({})

  const { service, permissions } = TYPES[type]
  if (!id || !canAny(permissions)) return null

  const openDialog = async () => {
    setOpen(true)
    setLoading(true)
    setErrors({})
    try {
      const preview = await service.getInvoiceSms(id)
      setPhone(preview?.phone || '')
      setMessage(preview?.message || '')
      setReference(preview?.reference || '')
      setConfigured(preview?.configured !== false)
    } catch (err) {
      toastError(getApiErrorMessage(err, 'Unable to prepare the invoice SMS.'))
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    const next = {}
    if (!phone.trim()) next.phone = "Enter the customer's mobile number."
    if (!message.trim()) next.message = 'The message cannot be empty.'
    setErrors(next)
    if (Object.keys(next).length) return

    setSending(true)
    try {
      const result = await service.sendInvoiceSms(id, { phone: phone.trim(), message: message.trim() })
      success(result.message)
      setOpen(false)
    } catch (err) {
      const fieldErrors = getApiValidationErrors(err)
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors)
      toastError(getApiErrorMessage(err, 'Unable to send the invoice SMS.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={openDialog}>
        <MessageSquare size={16} />
        {label}
      </button>

      <Modal
        open={open}
        onClose={() => !sending && setOpen(false)}
        title={reference ? `Send ${reference} via SMS` : 'Send invoice via SMS'}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={sending}>
              Cancel
            </button>
            <button type="submit" form="invoice-sms-form" className="btn-primary" disabled={loading || sending || !configured}>
              <Send size={16} />
              {sending ? 'Sending…' : 'Send SMS'}
            </button>
          </>
        }
      >
        {loading ? (
          <p className="text-sm text-slate-500">Preparing invoice message…</p>
        ) : (
          <form id="invoice-sms-form" onSubmit={handleSend} className="space-y-4">
            {!configured && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                The SMS gateway is not configured. An administrator can set it up under Administration &gt; Settings.
              </div>
            )}
            <div>
              <label className="label" htmlFor="invoice-sms-phone">Customer mobile number</label>
              <input
                id="invoice-sms-phone"
                type="tel"
                className="input-field"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0771234567"
                maxLength={20}
              />
              {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
            </div>
            <div>
              <label className="label" htmlFor="invoice-sms-message">Message</label>
              <textarea
                id="invoice-sms-message"
                className="input-field min-h-[200px] font-mono text-sm"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={MAX_LENGTH}
              />
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>{errors.message ? <span className="text-red-600">{errors.message}</span> : 'You can edit the message before sending.'}</span>
                <span>{message.length}/{MAX_LENGTH}</span>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}
