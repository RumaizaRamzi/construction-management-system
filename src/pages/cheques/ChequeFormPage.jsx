import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Save } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import StatusBadge from '../../components/ui/StatusBadge'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import ChequeStatusModal from '../../components/cheques/ChequeStatusModal'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import chequeService from '../../services/chequeService'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'
import { formatCurrency, formatDateTime } from '../../utils/helpers'
import {
  CHEQUE_REFERENCE_TYPES,
  CHEQUE_STATUSES,
  CHEQUE_TYPES,
  chequeDueText,
  emptyChequeForm,
  mapChequeErrors,
  validateChequeForm,
} from '../../utils/chequeHelpers'

const fromCheque = (c) => ({
  chequeNumber: c.chequeNumber,
  bank: c.bank,
  amount: String(c.amount),
  chequeDate: c.chequeDate,
  type: c.type,
  customerId: c.customerId ? String(c.customerId) : '',
  supplierId: c.supplierId ? String(c.supplierId) : '',
  status: c.status,
  notes: c.notes,
  referenceType: c.referenceType,
  referenceId: c.referenceId ? String(c.referenceId) : '',
  referenceLabel: c.referenceLabel,
})

export default function ChequeFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { can } = useApp()
  const { success, error: toastError } = useToast()
  const readOnly = isEdit ? !can('cheques.update') : !can('cheques.create')

  const [form, setForm] = useState(emptyChequeForm)
  const [cheque, setCheque] = useState(null)
  const [parties, setParties] = useState({ customers: [], suppliers: [] })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [linkSearch, setLinkSearch] = useState('')
  const [linkOptions, setLinkOptions] = useState([])

  useEffect(() => {
    chequeService
      .getSummary()
      .then((s) => setParties({ customers: s.customers, suppliers: s.suppliers }))
      .catch(() => setParties({ customers: [], suppliers: [] }))
  }, [])

  const loadCheque = async () => {
    if (!isEdit) return
    setLoading(true)
    setLoadError(null)
    try {
      const data = await chequeService.getCheque(id)
      setCheque(data)
      setForm(fromCheque(data))
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Unable to load this cheque.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCheque()
  }, [id])

  useEffect(() => {
    if (readOnly || !form.referenceType) return undefined
    const timer = window.setTimeout(() => {
      chequeService.getLinkOptions(form.referenceType, linkSearch.trim()).then(setLinkOptions).catch(() => setLinkOptions([]))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [form.referenceType, linkSearch, readOnly])

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const chooseLink = (value) => {
    const option = linkOptions.find((o) => String(o.id) === value)
    setForm((prev) => ({
      ...prev,
      referenceId: value,
      referenceLabel: option?.label || '',
      customerId: prev.type === 'received' && option?.customer_id ? String(option.customer_id) : prev.customerId,
      supplierId: prev.type === 'issued' && option?.supplier_id ? String(option.supplier_id) : prev.supplierId,
      amount: prev.amount === '' && option?.balance ? String(option.balance) : prev.amount,
    }))
    setErrors((prev) => ({ ...prev, referenceId: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const clientErrors = validateChequeForm(form)
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      toastError('Please fix the highlighted fields.')
      return
    }
    setSaving(true)
    setErrors({})
    try {
      const { cheque: saved, message } = isEdit
        ? await chequeService.updateCheque(id, form)
        : await chequeService.createCheque(form)
      success(message)
      if (isEdit) {
        setCheque(saved)
        setForm(fromCheque(saved))
      } else {
        navigate('/cheques')
      }
    } catch (err) {
      setErrors(mapChequeErrors(getApiValidationErrors(err)))
      toastError(getApiErrorMessage(err, 'Unable to save cheque.'))
    } finally {
      setSaving(false)
    }
  }

  const err = (key) => (errors[key] ? <p className="mt-1 text-xs text-red-600">{errors[key]}</p> : null)
  const title = isEdit ? (readOnly ? 'Cheque Details' : 'Edit Cheque') : 'Add Cheque'
  const linkedToPayment = Boolean(cheque?.paymentId)

  if (loading) return <LoadingState label="Loading cheque..." />
  if (loadError) {
    return (
      <div className="page-shell">
        <div className="card"><ApiErrorState title="Unable to load cheque" message={loadError} onRetry={loadCheque} /></div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <PageHeader
        title={title}
        subtitle={isEdit ? `Cheque ${cheque?.chequeNumber || `#${id}`}` : 'Record a received or issued cheque'}
        breadcrumbs={[{ label: 'Finance' }, { label: 'Cheques', to: '/cheques' }, { label: title }]}
        actions={
          <>
            <Link to="/cheques" className="btn-secondary">
              <ArrowLeft size={16} />
              Back
            </Link>
            {isEdit && can('cheques.update') && (
              <button type="button" className="btn-secondary" onClick={() => setStatusOpen(true)}>
                <RefreshCw size={16} />
                Update Status
              </button>
            )}
          </>
        }
      />

      {isEdit && cheque && (
        <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
          <span className="flex items-center gap-2">
            Status <StatusBadge status={cheque.isOverdue ? 'Overdue' : cheque.status} />
          </span>
          {chequeDueText(cheque) && <span className={cheque.isOverdue ? 'text-red-600' : 'text-amber-600'}>{chequeDueText(cheque)}</span>}
          <span className="text-slate-500">Amount {formatCurrency(cheque.amount)}</span>
          {cheque.statusChangedAt && <span className="text-slate-500">Status changed {formatDateTime(cheque.statusChangedAt)}</span>}
          {linkedToPayment && (
            <span className="text-slate-500">
              Linked to a payment on{' '}
              {cheque.referenceUrl ? (
                <Link to={cheque.referenceUrl} className="text-brand-600 hover:underline">{cheque.referenceLabel}</Link>
              ) : (
                cheque.referenceLabel || 'a record'
              )}
            </span>
          )}
          {cheque.createdByName && <span className="text-slate-500">Recorded by {cheque.createdByName}</span>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-5 p-5">
        <fieldset disabled={readOnly || saving} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="label">Type *</label>
              <div className="flex gap-2">
                {CHEQUE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set('type', t.value)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                      form.type === t.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                        : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {err('type')}
            </div>
            <div>
              <label className="label">Cheque number *</label>
              <input className="input-field" value={form.chequeNumber} onChange={(e) => set('chequeNumber', e.target.value)} maxLength={50} />
              {err('chequeNumber')}
            </div>
            <div>
              <label className="label">Bank *</label>
              <input className="input-field" value={form.bank} onChange={(e) => set('bank', e.target.value)} maxLength={100} placeholder="e.g. Bank of Ceylon" />
              {err('bank')}
            </div>
            <div>
              <label className="label">Amount (LKR) *</label>
              <input
                className="input-field"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                disabled={linkedToPayment && cheque?.status !== 'Pending'}
              />
              {err('amount')}
            </div>
            <div>
              <label className="label">Cheque date *</label>
              <input className="input-field" type="date" value={form.chequeDate} onChange={(e) => set('chequeDate', e.target.value)} />
              {err('chequeDate')}
            </div>
            {form.type === 'received' ? (
              <div>
                <label className="label">Customer</label>
                <select className="input-field" value={form.customerId} onChange={(e) => set('customerId', e.target.value)}>
                  <option value="">— Not specified —</option>
                  {parties.customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {err('customerId')}
              </div>
            ) : (
              <div>
                <label className="label">Supplier</label>
                <select className="input-field" value={form.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
                  <option value="">— Not specified —</option>
                  {parties.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {err('supplierId')}
              </div>
            )}
            {!isEdit && (
              <div>
                <label className="label">Status</label>
                <select className="input-field" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {CHEQUE_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Link to a record (optional)</h3>
            {linkedToPayment ? (
              <p className="text-sm text-slate-500">
                This cheque was linked automatically to a payment on{' '}
                <span className="font-medium text-slate-700 dark:text-slate-200">{cheque.referenceLabel || 'a record'}</span>.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="label">Record type</label>
                  <select
                    className="input-field"
                    value={form.referenceType}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, referenceType: e.target.value, referenceId: '', referenceLabel: '' }))
                      setLinkSearch('')
                      setLinkOptions([])
                    }}
                  >
                    <option value="">— No link —</option>
                    {CHEQUE_REFERENCE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                {form.referenceType && (
                  <>
                    <div>
                      <label className="label">Search</label>
                      <input className="input-field" value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} placeholder="Number or name..." />
                    </div>
                    <div>
                      <label className="label">Record *</label>
                      <select className="input-field" value={form.referenceId} onChange={(e) => chooseLink(e.target.value)}>
                        <option value="">— Choose —</option>
                        {form.referenceId && !linkOptions.some((o) => String(o.id) === form.referenceId) && (
                          <option value={form.referenceId}>{form.referenceLabel || `#${form.referenceId}`}</option>
                        )}
                        {linkOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}{o.balance ? ` (balance ${formatCurrency(o.balance)})` : ''}
                          </option>
                        ))}
                      </select>
                      {err('referenceId')}
                    </div>
                  </>
                )}
              </div>
            )}
            <p className="text-xs text-slate-500">
              Payments recorded with the &ldquo;Cheque&rdquo; method on sales, rentals, income or expenses create or link a
              cheque automatically, using the payment reference as the cheque number.
            </p>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input-field" rows={3} maxLength={2000} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            {err('notes')}
          </div>
        </fieldset>

        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Cheque'}
            </button>
            <Link to="/cheques" className="btn-secondary">Cancel</Link>
          </div>
        )}
      </form>

      {statusOpen && cheque && (
        <ChequeStatusModal
          key={`${cheque.id}-${cheque.status}`}
          cheque={cheque}
          onClose={() => setStatusOpen(false)}
          onSaved={(updated) => {
            setCheque(updated)
            setForm(fromCheque(updated))
          }}
        />
      )}
    </div>
  )
}
