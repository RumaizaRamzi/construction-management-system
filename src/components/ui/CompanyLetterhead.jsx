import { BRAND_LOGO_URL } from './BrandLogo'

const FIELD_LABELS = {
  company_name: 'Company name',
  address: 'Address',
  phone: 'Phone',
  email: 'Email',
}

export function MissingCompanyDataNotice({ settings = {} }) {
  const missing = settings.missingClientData || []
  if (!missing.length) return null
  return (
    <div className="no-print mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <strong>CLIENT DATA REQUIRED:</strong> set{' '}
      {missing.map((key) => FIELD_LABELS[key] || key).join(', ')} in Settings → Company before issuing documents.
    </div>
  )
}

export default function CompanyLetterhead({ settings = {} }) {
  const lines = [
    settings.address,
    [settings.phone, settings.email].filter(Boolean).join(' · '),
    settings.website,
    settings.taxNumber ? `Tax No: ${settings.taxNumber}` : '',
    settings.businessRegistration ? `Reg No: ${settings.businessRegistration}` : '',
  ].filter(Boolean)

  return (
    <div className="flex items-start gap-4">
      <img
        src={settings.logoUrl || BRAND_LOGO_URL}
        alt={settings.companyName || 'Company logo'}
        className="h-20 w-20 shrink-0 rounded-xl object-contain"
      />
      <div>
        {settings.companyName ? <h2 className="font-display text-2xl font-bold">{settings.companyName}</h2> : null}
        {settings.subtitle ? <p className="text-sm text-slate-500">{settings.subtitle}</p> : null}
        {lines.map((line) => (
          <p key={line} className="text-sm text-slate-600 max-w-sm whitespace-pre-line">
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}
