import api from './api'
import fetchAllPages from './fetchAllPages'
import { mapPurchaseFromApi, mapPurchaseToApi } from '../utils/apiMappers'

export const PURCHASE_PAYMENT_TYPES = ['Paid', 'Credit', 'Cheque']
export const PURCHASE_PAYMENT_STATUSES = ['Paid', 'Partial', 'Unpaid']

export const purchaseService = {
  async getPurchases(params) {
    const rows = await fetchAllPages('/purchases', params)
    return rows.map(mapPurchaseFromApi).filter(Boolean)
  },

  async getPurchase(id) {
    const response = await api.get(`/purchases/${id}`)
    const payload = response.data?.data || {}
    return {
      purchase: mapPurchaseFromApi(payload),
      cancelBlockers: Array.isArray(payload.cancel_blockers) ? payload.cancel_blockers : [],
      activity: Array.isArray(payload.activity) ? payload.activity : [],
    }
  },

  async createPurchase(data) {
    const response = await api.post('/purchases', mapPurchaseToApi(data))
    return {
      purchase: mapPurchaseFromApi(response.data?.data),
      message: response.data?.message || 'Purchase saved and stock updated.',
    }
  },

  async updatePurchase(id, data) {
    const response = await api.put(`/purchases/${id}`, mapPurchaseToApi(data))
    return {
      purchase: mapPurchaseFromApi(response.data?.data),
      message: response.data?.message || 'Purchase updated and stock adjusted.',
    }
  },

  async cancelPurchase(id, reason) {
    const response = await api.post(`/purchases/${id}/cancel`, { reason: reason?.trim() || null })
    return {
      purchase: mapPurchaseFromApi(response.data?.data),
      message: response.data?.message || 'Purchase cancelled and stock reversed.',
    }
  },
}

export default purchaseService
