import { useEffect, useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import adminService from '../../services/adminService'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'

const range = (n) => Array.from({ length: n }, (_, i) => i + 1)

function SecretInput({ name, value, saved, cleared, onChange, onClear, placeholder }) {
  return (
    <div>
      <input
        type="password"
        autoComplete="new-password"
        className="input-field"
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={saved && !cleared ? '•••••••• saved — leave blank to keep' : placeholder}
      />
      {saved && !value && (
        <button type="button" className="mt-1 text-xs text-red-600 hover:underline" onClick={() => onClear(name)}>
          {cleared ? 'Will be removed on save (undo)' : 'Remove saved value'}
        </button>
      )}
    </div>
  )
}

export default function SmsGatewaySettings() {
  const { success, error: toastError } = useToast()
  const [form, setForm] = useState(null)
  const [meta, setMeta] = useState({ providers: {}, saved_secrets: {}, configured: false, header_count: 3, param_count: 10 })
  const [clear, setClear] = useState([])
  const [loadError, setLoadError] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [testNumber, setTestNumber] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const apply = (gateway) => {
    setForm(gateway.config || {})
    setMeta({
      providers: gateway.providers || {},
      saved_secrets: gateway.saved_secrets || {},
      configured: !!gateway.configured,
      header_count: gateway.header_count || 3,
      param_count: gateway.param_count || 10,
    })
    setClear([])
  }

  const load = async () => {
    setLoadError('')
    try {
      apply(await adminService.getSmsGateway())
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Unable to load SMS gateway settings.'))
    }
  }

  useEffect(() => {
    load()
  }, [])

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (value) setClear((prev) => prev.filter((k) => k !== key))
  }
  const toggleClear = (key) => setClear((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  const isSecret = (key) => key in meta.saved_secrets || /^header_val_/.test(key)
  const err = (key) => (errors[key] ? <p className="mt-1 text-xs text-red-600">{errors[key]}</p> : null)

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const { gateway, message } = await adminService.updateSmsGateway({ ...form, clear_secrets: clear })
      apply(gateway)
      success(message)
    } catch (error) {
      setErrors(getApiValidationErrors(error))
      toastError(getApiErrorMessage(error, 'Unable to save SMS gateway settings.'))
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    setErrors((prev) => ({ ...prev, test_number: undefined, message: undefined }))
    try {
      const { message } = await adminService.sendTestSms({ test_number: testNumber, message: testMessage })
      setTestResult({ ok: true, message })
      success(message)
    } catch (error) {
      const validation = getApiValidationErrors(error)
      setErrors((prev) => ({ ...prev, ...validation }))
      const message = getApiErrorMessage(error, 'Unable to send test SMS.')
      setTestResult({ ok: false, message })
      toastError(message)
    } finally {
      setTesting(false)
    }
  }

  const textInput = (key, label, props = {}) => (
    <div>
      <label className="label">{label}</label>
      {isSecret(key) ? (
        <SecretInput
          name={key}
          value={form[key] || ''}
          saved={!!meta.saved_secrets[key]}
          cleared={clear.includes(key)}
          onChange={set}
          onClear={toggleClear}
          placeholder={props.placeholder}
        />
      ) : (
        <input className="input-field" value={form[key] || ''} onChange={(e) => set(key, e.target.value)} {...props} />
      )}
      {err(key)}
    </div>
  )

  if (loadError) {
    return (
      <section className="card flex flex-wrap items-center justify-between gap-3 p-5 text-sm text-red-700">
        <span>{loadError}</span>
        <button type="button" className="btn-secondary text-sm" onClick={load}>
          Retry
        </button>
      </section>
    )
  }

  if (!form) {
    return <section className="card p-5 text-sm text-slate-500">Loading SMS gateway settings…</section>
  }

  const provider = form.sms_service

  return (
    <form onSubmit={handleSave} className="card space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-brand-600" />
          <h3 className="font-display text-lg font-semibold">SMS Gateway</h3>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            meta.configured
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {meta.configured ? 'Configured' : 'Not configured'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">SMS Service</label>
          <select className="input-field" value={provider} onChange={(e) => set('sms_service', e.target.value)}>
            <option value="">None (disabled)</option>
            {Object.entries(meta.providers).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {err('sms_service')}
        </div>
        {provider && textInput('default_country_code', 'Default country code', { placeholder: '94', maxLength: 5 })}
      </div>
      {provider && (
        <p className="-mt-2 text-xs text-slate-500">
          Local numbers starting with 0 (e.g. 0771234567) are converted using the country code (e.g. 94771234567).
        </p>
      )}

      {provider === 'notifylk' && (
        <div className="grid gap-4 md:grid-cols-3">
          {textInput('notifylk_user_id', 'User ID', { maxLength: 100 })}
          {textInput('notifylk_api_key', 'API Key')}
          {textInput('notifylk_sender_id', 'Sender ID', { maxLength: 11, placeholder: 'e.g. NotifyDEMO' })}
        </div>
      )}

      {provider === 'twilio' && (
        <div className="grid gap-4 md:grid-cols-3">
          {textInput('twilio_sid', 'Account SID', { maxLength: 100 })}
          {textInput('twilio_token', 'Auth Token')}
          {textInput('twilio_from', 'From', { maxLength: 30, placeholder: '+15005550006' })}
        </div>
      )}

      {provider === 'nexmo' && (
        <div className="grid gap-4 md:grid-cols-3">
          {textInput('nexmo_key', 'Nexmo Key', { maxLength: 100 })}
          {textInput('nexmo_secret', 'Nexmo Secret')}
          {textInput('nexmo_from', 'From', { maxLength: 30 })}
        </div>
      )}

      {provider === 'other' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-3">{textInput('url', 'URL', { maxLength: 500, placeholder: 'https://' })}</div>
            {textInput('send_to_param_name', 'Send to parameter name', { maxLength: 100 })}
            <div>
              <label className="label">Send to parameter type</label>
              <select className="input-field" value={form.send_to_param_type} onChange={(e) => set('send_to_param_type', e.target.value)}>
                <option value="string">String</option>
                <option value="array">Array</option>
              </select>
            </div>
            {textInput('msg_param_name', 'Message parameter name', { maxLength: 100 })}
            <div>
              <label className="label">Request Method</label>
              <select className="input-field" value={form.request_method} onChange={(e) => set('request_method', e.target.value)}>
                <option value="get">GET</option>
                <option value="post">POST</option>
              </select>
              {err('request_method')}
            </div>
            <div>
              <label className="label">Data parameter type</label>
              <select
                className="input-field"
                value={form.data_parameter_type}
                onChange={(e) => set('data_parameter_type', e.target.value)}
                disabled={form.request_method === 'get'}
              >
                <option value="form-data">Form data</option>
                <option value="json">JSON</option>
              </select>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Headers</h4>
            <div className="grid gap-3 md:grid-cols-2">
              {range(meta.header_count).map((i) => (
                <div key={`h${i}`} className="contents">
                  {textInput(`header_${i}`, `Header ${i} key`, { maxLength: 100 })}
                  {textInput(`header_val_${i}`, `Header ${i} value`)}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Parameters</h4>
            <div className="grid gap-3 md:grid-cols-2">
              {range(meta.param_count).map((i) => (
                <div key={`p${i}`} className="contents">
                  {textInput(`param_${i}`, `Parameter ${i} key`, { maxLength: 100 })}
                  {textInput(`param_val_${i}`, `Parameter ${i} value`, { maxLength: 1000 })}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Header values, and values of parameters whose name looks like a key, token, secret or password, are stored
              encrypted and hidden after saving.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save SMS Settings'}
        </button>
      </div>

      <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Send test SMS</h4>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label">Test Number</label>
            <input className="input-field" value={testNumber} onChange={(e) => setTestNumber(e.target.value)} placeholder="0771234567" maxLength={20} />
            {err('test_number')}
          </div>
          <div className="md:col-span-2">
            <label className="label">Message (optional)</label>
            <input
              className="input-field"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="This is a test SMS from RN TRADING LANKA PVT. LTD."
              maxLength={480}
            />
            {err('message')}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={handleTest} disabled={testing || !testNumber.trim()}>
            <Send className="h-4 w-4" />
            {testing ? 'Sending…' : 'Send test SMS'}
          </button>
          {!meta.configured && <span className="text-xs text-slate-500">Save a complete configuration first.</span>}
        </div>
        {testResult && (
          <p className={`text-sm ${testResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>{testResult.message}</p>
        )}
      </div>
    </form>
  )
}
