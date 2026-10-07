import api, { unwrapApiData } from './api'
import { mapSaleFromApi, mapSaleToApi } from '../utils/apiMappers'
import fetchAllPages from './fetchAllPages'

export const saleService = {
  async getSales(params) {
    const rows = await fetchAllPages('/sales', params)
    return rows.map(mapSaleFromApi).filter(Boolean)
  },

  async getSale(id) {
    const response = await api.get(`/sales/${id}`)
    return mapSaleFromApi(unwrapApiData(response))
  },

  async createSale(data) {
    const response = await api.post('/sales', mapSaleToApi(data))
    return {
      sale: mapSaleFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Sale created successfully.',
    }
  },

  async updateSale(id, data) {
    const response = await api.put(`/sales/${id}`, mapSaleToApi(data))
    return {
      sale: mapSaleFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Sale updated successfully.',
    }
  },

  async deleteSale(id) {
    const response = await api.delete(`/sales/${id}`)
    return {
      sale: mapSaleFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Sale cancelled successfully.',
    }
  },

  async addSalePayment(saleId, data) {
    const response = await api.post(`/sales/${saleId}/payments`, {
      amount: Number(data.amount),
      payment_date: data.paymentDate || data.payment_date || undefined,
      payment_method: data.paymentMethod || data.payment_method || undefined,
      reference: data.reference || undefined,
      notes: data.notes || undefined,
    })
    return {
      sale: mapSaleFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Payment recorded successfully.',
    }
  },

  async getInvoiceSms(saleId) {
    const response = await api.get(`/sales/${saleId}/invoice-sms`)
    return unwrapApiData(response)
  },

  async sendInvoiceSms(saleId, data) {
    const response = await api.post(`/sales/${saleId}/invoice-sms`, data)
    return { message: response.data?.message || 'Invoice sent via SMS.' }
  },
}

export default saleService
