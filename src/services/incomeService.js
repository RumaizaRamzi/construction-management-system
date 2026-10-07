import api, { unwrapApiData } from './api'
import {
  mapIncomeFromApi,
  mapIncomeToApi,
  mapIncomePaymentFromApi,
  mapIncomePaymentToApi,
} from '../utils/apiMappers'

import fetchAllPages from './fetchAllPages'

export const incomeService = {
  async getIncome(params) {
    const rows = await fetchAllPages('/income', params)
    return rows.map(mapIncomeFromApi).filter(Boolean)
  },

  async getIncomeById(id) {
    const response = await api.get(`/income/${id}`)
    return mapIncomeFromApi(unwrapApiData(response))
  },

  async createIncome(data) {
    const response = await api.post('/income', mapIncomeToApi(data))
    return {
      income: mapIncomeFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Income created successfully.',
    }
  },

  async updateIncome(id, data) {
    const response = await api.put(`/income/${id}`, mapIncomeToApi(data))
    return {
      income: mapIncomeFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Income updated successfully.',
    }
  },

  async deleteIncome(id) {
    const response = await api.delete(`/income/${id}`)
    return { message: response.data?.message || 'Income deleted successfully.' }
  },

  async getIncomePayments(incomeId) {
    const response = await api.get(`/income/${incomeId}/payments`)
    const rows = unwrapApiData(response)
    return (Array.isArray(rows) ? rows : []).map(mapIncomePaymentFromApi).filter(Boolean)
  },

  async addIncomePayment(incomeId, data) {
    const response = await api.post(`/income/${incomeId}/payments`, mapIncomePaymentToApi(data))
    const payload = unwrapApiData(response)
    return {
      payment: mapIncomePaymentFromApi(payload?.payment || payload),
      income: mapIncomeFromApi(payload?.income),
      message: response.data?.message || 'Payment recorded successfully.',
    }
  },

  async updateIncomePayment(incomeId, paymentId, data) {
    const response = await api.put(
      `/income/${incomeId}/payments/${paymentId}`,
      mapIncomePaymentToApi(data)
    )
    const payload = unwrapApiData(response)
    return {
      payment: mapIncomePaymentFromApi(payload?.payment || payload),
      income: mapIncomeFromApi(payload?.income),
      message: response.data?.message || 'Payment updated successfully.',
    }
  },

  async deleteIncomePayment(incomeId, paymentId) {
    const response = await api.delete(`/income/${incomeId}/payments/${paymentId}`)
    const payload = unwrapApiData(response)
    return {
      income: mapIncomeFromApi(payload?.income),
      message: response.data?.message || 'Payment deleted successfully.',
    }
  },
}

export default incomeService
