import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import BranchManager from '../../components/admin/BranchManager'
import SmsGatewaySettings from '../../components/admin/SmsGatewaySettings'
import HolidayCalendarSettings from '../../components/admin/HolidayCalendarSettings'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'

export default function AdminSettings() {
  const { settings, settingsLoading, settingsError, loadSettings, updateSettings, uploadCompanyLogo, removeCompanyLogo } = useApp()
  const { success, error: toastError } = useToast()
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [logoBusy, setLogoBusy] = useState(false)

  useEffect(() => {
    setForm(settings)
  }, [settings])

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormErrors({})
    try {
      const { message } = await updateSettings(form)
      success(message || 'Settings saved.')
    } catch (err) {
      setFormErrors(getApiValidationErrors(err))
      toastError(getApiErrorMessage(err, 'Unable to save settings.'))
    } finally {
      setSaving(false)
    }
  }

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toastError('Logo must be a PNG, JPG, or WEBP image.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toastError('Logo must be 2 MB or smaller.')
      return
    }
    setLogoBusy(true)
    try {
      const { message } = await uploadCompanyLogo(file)
      success(message || 'Logo uploaded.')
    } catch (err) {
      toastError(getApiErrorMessage(err, 'Unable to upload logo.'))
    } finally {
      setLogoBusy(false)
    }
  }

  const handleLogoRemove = async () => {
    setLogoBusy(true)
    try {
      const { message } = await removeCompanyLogo()
      success(message || 'Logo removed.')
    } catch (err) {
      toastError(getApiErrorMessage(err, 'Unable to remove logo.'))
    } finally {
      setLogoBusy(false)
    }
  }

  const fieldError = (key) =>
    formErrors[key] ? <p className="mt-1 text-xs text-red-600">{formErrors[key]}</p> : null

  return (
    <div className="page-shell">
      <PageHeader
        title="Settings"
        subtitle="Company details, currency, invoices and branches"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Settings' }]}
      />

      {settingsError && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-red-200 p-4 text-sm text-red-700">
          <span>{settingsError}</span>
          <button type="button" className="btn-secondary text-sm" onClick={() => loadSettings().catch(() => {})}>
            Retry
          </button>
        </div>
      )}

      {settings.missingClientData?.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>CLIENT DATA REQUIRED:</strong> company name, address, phone and email must be filled in before
          invoices and rental agreements are issued to clients.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <section className="card space-y-4 p-5">
          <h3 className="font-display text-lg font-semibold">Company Information</h3>
          <fieldset disabled={settingsLoading} className="contents">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Company name</label>
                <input className="input-field" value={form.companyName} onChange={(e) => set('companyName', e.target.value)} maxLength={150} />
                {fieldError('company_name')}
              </div>
              <div>
                <label className="label">Subtitle / tagline</label>
                <input className="input-field" value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} maxLength={150} />
                {fieldError('company_subtitle')}
              </div>
              <div className="md:col-span-2">
                <label className="label">Address</label>
                <textarea className="input-field" rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={500} />
                {fieldError('address')}
              </div>
              <div>
                <label className="label">Tax / VAT number</label>
                <input className="input-field" value={form.taxNumber} onChange={(e) => set('taxNumber', e.target.value)} maxLength={100} />
                {fieldError('tax_number')}
              </div>
              <div>
                <label className="label">Business registration no.</label>
                <input className="input-field" value={form.businessRegistration} onChange={(e) => set('businessRegistration', e.target.value)} maxLength={100} />
                {fieldError('business_registration')}
              </div>
              <div className="md:col-span-2">
                <label className="label">Bank details (shown on invoices)</label>
                <textarea className="input-field" rows={2} value={form.bankDetails} onChange={(e) => set('bankDetails', e.target.value)} maxLength={1000} />
                {fieldError('bank_details')}
              </div>
            </div>
          </fieldset>
          <div>
            <label className="label">Logo</label>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                {settings.logoUrl ? <img src={settings.logoUrl} alt="Company logo" className="h-full w-full object-contain" /> : 'No logo'}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className={`btn-secondary cursor-pointer text-sm ${logoBusy ? 'pointer-events-none opacity-60' : ''}`}>
                  {logoBusy ? 'Working…' : settings.logoUrl ? 'Replace logo' : 'Upload logo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoChange} disabled={logoBusy} />
                </label>
                {settings.logoUrl && (
                  <button type="button" className="btn-secondary text-sm" onClick={handleLogoRemove} disabled={logoBusy}>
                    Remove
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">PNG, JPG or WEBP, up to 2 MB.</p>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <h3 className="font-display text-lg font-semibold">Contact Details</h3>
          <fieldset disabled={settingsLoading} className="contents">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="label">Phone</label>
                <input className="input-field" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={50} />
                {fieldError('phone')}
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input-field" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={150} />
                {fieldError('email')}
              </div>
              <div>
                <label className="label">Website</label>
                <input className="input-field" value={form.website} onChange={(e) => set('website', e.target.value)} maxLength={150} />
                {fieldError('website')}
              </div>
            </div>
          </fieldset>
        </section>

        <section className="card space-y-4 p-5">
          <h3 className="font-display text-lg font-semibold">Currency & Invoice Settings</h3>
          <fieldset disabled={settingsLoading} className="contents">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="label">Currency</label>
                <select className="input-field" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                  <option value="LKR">LKR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="INR">INR</option>
                </select>
              </div>
              <div>
                <label className="label">Default tax rate (%)</label>
                <input className="input-field" type="number" min="0" max="100" step="0.01" value={form.taxRate} onChange={(e) => set('taxRate', Number(e.target.value))} />
                {fieldError('tax_rate')}
              </div>
              <div>
                <label className="label">Invoice prefix</label>
                <input className="input-field" value={form.invoicePrefix} onChange={(e) => set('invoicePrefix', e.target.value)} maxLength={20} />
                {fieldError('invoice_prefix')}
              </div>
              <div className="md:col-span-3">
                <label className="label">Invoice footer</label>
                <textarea className="input-field" rows={2} value={form.invoiceFooter} onChange={(e) => set('invoiceFooter', e.target.value)} maxLength={1000} />
                {fieldError('invoice_footer')}
              </div>
            </div>
          </fieldset>
        </section>

        <section className="card space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold">Notification Settings</h3>
            <Link to="/settings/notifications" className="btn-secondary text-sm">
              Manage Alerts
            </Link>
          </div>
          <fieldset disabled={settingsLoading} className="contents">
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={!!form.emailNotifications} onChange={(e) => set('emailNotifications', e.target.checked)} />
              Email notifications
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={!!form.smsNotifications} onChange={(e) => set('smsNotifications', e.target.checked)} />
              SMS notifications
            </label>
          </fieldset>
          <p className="text-xs text-slate-500">
            Email delivery requires a mail provider to be configured on the server; SMS delivery uses the SMS Gateway
            below. Alert toggles are on the notification settings page.
          </p>
        </section>

        <section className="card space-y-4 p-5">
          <h3 className="font-display text-lg font-semibold">Rental & Stock Settings</h3>
          <fieldset disabled={settingsLoading} className="contents">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Default deposit (%)</label>
                <input className="input-field" type="number" min="0" max="100" value={form.rentalDepositPercent} onChange={(e) => set('rentalDepositPercent', Number(e.target.value))} />
                {fieldError('rental_deposit_percent')}
              </div>
              <div>
                <label className="label">Late fee per day (per unit)</label>
                <input className="input-field" type="number" min="0" value={form.lateFeePerDay} onChange={(e) => set('lateFeePerDay', Number(e.target.value))} />
                {fieldError('late_fee_per_day')}
              </div>
              <div className="md:col-span-2">
                <label className="label">Rental agreement terms (one per line; leave blank for standard terms)</label>
                <textarea className="input-field" rows={4} value={form.rentalTerms} onChange={(e) => set('rentalTerms', e.target.value)} maxLength={5000} />
                {fieldError('rental_terms')}
              </div>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={!!form.lowStockThreshold} onChange={(e) => set('lowStockThreshold', e.target.checked)} />
              Enable low stock alerts
            </label>
          </fieldset>
        </section>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={saving || settingsLoading}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>

      <HolidayCalendarSettings />

      <SmsGatewaySettings />

      <BranchManager />
    </div>
  )
}
