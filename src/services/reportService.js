import api, { unwrapApiData } from './api'
import {
  mapDashboardReportFromApi,
  mapSalesReportFromApi,
  mapRentalReportFromApi,
  mapInventoryReportFromApi,
  mapInventoryUsageReportFromApi,
  mapEquipmentReportFromApi,
  mapFinancialReportFromApi,
  mapCustomerReportFromApi,
  mapCustomerDetailsReportFromApi,
  mapReportSummaryFromApi,
} from '../utils/apiMappers'

function withRange(params = {}) {
  const next = { ...params }
  if (next.from) next.from = String(next.from).slice(0, 10)
  if (next.to) next.to = String(next.to).slice(0, 10)
  return next
}

async function getReport(path, params = {}, mapper = (d) => d || {}) {
  const response = await api.get(path, { params: withRange(params) })
  return mapper(unwrapApiData(response) || {})
}

export const reportService = {
  getDashboardReport(params) {
    return getReport('/reports/dashboard', params, mapDashboardReportFromApi)
  },

  getReportSummary(params) {
    return getReport('/reports/summary', params, mapReportSummaryFromApi)
  },

  getSalesReport(params) {
    return getReport('/reports/sales', params, mapSalesReportFromApi)
  },

  getRentalReport(params) {
    return getReport('/reports/rentals', params, mapRentalReportFromApi)
  },

  getInventoryReport(params) {
    return getReport('/reports/inventory', params, mapInventoryReportFromApi)
  },

  getInventoryUsageReport(params) {
    return getReport('/reports/inventory/usage', params, mapInventoryUsageReportFromApi)
  },

  getEquipmentReport(params) {
    return getReport('/reports/equipment', params, mapEquipmentReportFromApi)
  },

  getFinancialReport(params) {
    return getReport('/reports/financial', params, mapFinancialReportFromApi)
  },

  getCustomerReport(params) {
    return getReport('/reports/customers', params, mapCustomerReportFromApi)
  },

  async authorizeExport(report, format) {
    await api.post('/reports/export', { report, format })
  },

  getCustomerDetailsReport(customerId, params) {
    return getReport(`/reports/customers/${customerId}`, params, mapCustomerDetailsReportFromApi)
  },

  getReportWithDateRange(type, params = {}) {
    const map = {
      dashboard: () => this.getDashboardReport(params),
      summary: () => this.getReportSummary(params),
      sales: () => this.getSalesReport(params),
      rentals: () => this.getRentalReport(params),
      inventory: () => this.getInventoryReport(params),
      inventoryUsage: () => this.getInventoryUsageReport(params),
      equipment: () => this.getEquipmentReport(params),
      financial: () => this.getFinancialReport(params),
      customers: () => this.getCustomerReport(params),
    }
    const fn = map[type]
    if (!fn) throw new Error(`Unknown report type: ${type}`)
    return fn()
  },
}

export default reportService
