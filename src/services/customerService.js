import api, { unwrapApiData } from './api'
import { mapCustomerFromApi, mapCustomerToApi } from '../utils/apiMappers'

import fetchAllPages from './fetchAllPages'

export const customerService = {
  async getCustomers(params) {
    const rows = await fetchAllPages('/customers', params)
    return rows.map(mapCustomerFromApi).filter(Boolean)
  },

  async getCustomer(id) {
    const response = await api.get(`/customers/${id}`)
    return mapCustomerFromApi(unwrapApiData(response))
  },

  async createCustomer(data) {
    const response = await api.post('/customers', mapCustomerToApi(data))
    return {
      customer: mapCustomerFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Customer created successfully.',
    }
  },

  async updateCustomer(id, data) {
    const response = await api.put(`/customers/${id}`, mapCustomerToApi(data))
    return {
      customer: mapCustomerFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Customer updated successfully.',
    }
  },

  async uploadIdPhoto(id, file) {
    const body = new FormData()
    body.append('id_photo', file)
    const response = await api.post(`/customers/${id}/id-photo`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    })
    return {
      customer: mapCustomerFromApi(unwrapApiData(response)),
      message: response.data?.message || 'ID photo uploaded successfully.',
    }
  },

  async deleteIdPhoto(id) {
    const response = await api.delete(`/customers/${id}/id-photo`)
    return {
      customer: mapCustomerFromApi(unwrapApiData(response)),
      message: response.data?.message || 'ID photo removed successfully.',
    }
  },

  async getIdPhotoBlob(id) {
    const response = await api.get(`/customers/${id}/id-photo`, { responseType: 'blob' })
    return response.data
  },

  async deleteCustomer(id) {
    const response = await api.delete(`/customers/${id}`)
    const payload = unwrapApiData(response)
    return {
      customer: payload ? mapCustomerFromApi(payload) : null,
      deactivated: Boolean(payload && payload.status === 'Inactive'),
      message: response.data?.message || 'Customer deleted successfully.',
    }
  },
}

export default customerService
