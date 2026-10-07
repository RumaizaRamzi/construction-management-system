import api, { unwrapApiData } from './api'
import {
  mapExpenseFromApi,
  mapExpenseToApi,
  mapExpensePaymentFromApi,
  mapExpensePaymentToApi,
} from '../utils/apiMappers'

import fetchAllPages from './fetchAllPages'

export const expenseService = {
  async getExpenses(params) {
    const rows = await fetchAllPages('/expenses', params)
    return rows.map(mapExpenseFromApi).filter(Boolean)
  },

  async getExpenseById(id) {
    const response = await api.get(`/expenses/${id}`)
    return mapExpenseFromApi(unwrapApiData(response))
  },

  async createExpense(data) {
    const response = await api.post('/expenses', mapExpenseToApi(data))
    return {
      expense: mapExpenseFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Expense created successfully.',
    }
  },

  async updateExpense(id, data) {
    const response = await api.put(`/expenses/${id}`, mapExpenseToApi(data))
    return {
      expense: mapExpenseFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Expense updated successfully.',
    }
  },

  async deleteExpense(id) {
    const response = await api.delete(`/expenses/${id}`)
    return { message: response.data?.message || 'Expense deleted successfully.' }
  },

  async getExpensePayments(expenseId) {
    const response = await api.get(`/expenses/${expenseId}/payments`)
    const rows = unwrapApiData(response)
    return (Array.isArray(rows) ? rows : []).map(mapExpensePaymentFromApi).filter(Boolean)
  },

  async addExpensePayment(expenseId, data) {
    const response = await api.post(`/expenses/${expenseId}/payments`, mapExpensePaymentToApi(data))
    const payload = unwrapApiData(response)
    return {
      payment: mapExpensePaymentFromApi(payload?.payment || payload),
      expense: mapExpenseFromApi(payload?.expense),
      message: response.data?.message || 'Payment recorded successfully.',
    }
  },

  async updateExpensePayment(expenseId, paymentId, data) {
    const response = await api.put(
      `/expenses/${expenseId}/payments/${paymentId}`,
      mapExpensePaymentToApi(data)
    )
    const payload = unwrapApiData(response)
    return {
      payment: mapExpensePaymentFromApi(payload?.payment || payload),
      expense: mapExpenseFromApi(payload?.expense),
      message: response.data?.message || 'Payment updated successfully.',
    }
  },

  async deleteExpensePayment(expenseId, paymentId) {
    const response = await api.delete(`/expenses/${expenseId}/payments/${paymentId}`)
    const payload = unwrapApiData(response)
    return {
      expense: mapExpenseFromApi(payload?.expense),
      message: response.data?.message || 'Payment deleted successfully.',
    }
  },
}

export default expenseService
