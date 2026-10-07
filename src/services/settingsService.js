import api, { unwrapApiData } from './api'

const FIELD_MAP = {
  companyName: 'company_name',
  subtitle: 'company_subtitle',
  address: 'address',
  phone: 'phone',
  email: 'email',
  website: 'website',
  taxNumber: 'tax_number',
  businessRegistration: 'business_registration',
  bankDetails: 'bank_details',
  currency: 'currency',
  taxRate: 'tax_rate',
  invoicePrefix: 'invoice_prefix',
  invoiceFooter: 'invoice_footer',
  rentalTerms: 'rental_terms',
  rentalDepositPercent: 'rental_deposit_percent',
  lateFeePerDay: 'late_fee_per_day',
  lowStockThreshold: 'low_stock_alerts',
  emailNotifications: 'email_notifications',
  smsNotifications: 'sms_notifications',
  enableNotifications: 'enable_notifications',
  enableRentalReminders: 'enable_rental_reminders',
  enableLowStockAlerts: 'enable_low_stock_alerts',
  enableMaintenanceReminders: 'enable_maintenance_reminders',
  enablePaymentAlerts: 'enable_payment_alerts',
  enableBookingNotifications: 'enable_booking_notifications',
  reminderTiming: 'reminder_timing',
  holidayOverrides: 'holiday_overrides',
}

export const EMPTY_SETTINGS = {
  companyName: '',
  subtitle: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  taxNumber: '',
  businessRegistration: '',
  bankDetails: '',
  logoUrl: null,
  currency: 'LKR',
  taxRate: 0,
  invoicePrefix: 'INV-',
  invoiceFooter: '',
  rentalTerms: '',
  rentalDepositPercent: 20,
  lateFeePerDay: 2500,
  lowStockThreshold: true,
  emailNotifications: true,
  smsNotifications: false,
  enableNotifications: true,
  enableRentalReminders: true,
  enableLowStockAlerts: true,
  enableMaintenanceReminders: true,
  enablePaymentAlerts: true,
  enableBookingNotifications: true,
  reminderTiming: '1 Day Before',
  holidayOverrides: [],
  missingClientData: [],
}

export function mapSettingsFromApi(record = {}) {
  const out = { ...EMPTY_SETTINGS }
  Object.entries(FIELD_MAP).forEach(([camel, snake]) => {
    if (record[snake] !== undefined && record[snake] !== null) out[camel] = record[snake]
  })
  out.logoUrl = record.logo_url || null
  out.missingClientData = Array.isArray(record.missing_client_data) ? record.missing_client_data : []
  out.holidayOverrides = Array.isArray(record.holiday_overrides) ? record.holiday_overrides : []
  return out
}

export function mapSettingsToApi(settings = {}) {
  const payload = {}
  Object.entries(FIELD_MAP).forEach(([camel, snake]) => {
    if (settings[camel] !== undefined) payload[snake] = settings[camel]
  })
  return payload
}

const settingsService = {
  async getSettings() {
    const response = await api.get('/settings')
    return mapSettingsFromApi(unwrapApiData(response))
  },

  async updateSettings(settings) {
    const response = await api.put('/settings', mapSettingsToApi(settings))
    return { settings: mapSettingsFromApi(unwrapApiData(response)), message: response.data?.message }
  },

  async uploadLogo(file) {
    const form = new FormData()
    form.append('logo', file)
    const response = await api.post('/settings/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return { settings: mapSettingsFromApi(unwrapApiData(response)), message: response.data?.message }
  },

  async removeLogo() {
    const response = await api.delete('/settings/logo')
    return { settings: mapSettingsFromApi(unwrapApiData(response)), message: response.data?.message }
  },
}

export default settingsService
