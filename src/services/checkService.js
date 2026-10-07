import api, { unwrapApiData } from './api'
import { mapCheckFromApi, mapCheckToApi } from '../utils/apiMappers'
import fetchAllPages from './fetchAllPages'

export const checkService = {
  async getChecks(params) {
    const rows = await fetchAllPages('/checks', params)
    return rows.map(mapCheckFromApi).filter(Boolean)
  },

  async getCheckById(id) {
    const response = await api.get(`/checks/${id}`)
    return mapCheckFromApi(unwrapApiData(response))
  },

  async createCheck(data) {
    const response = await api.post('/checks', mapCheckToApi(data))
    return {
      check: mapCheckFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Check created successfully.',
    }
  },

  async updateCheck(id, data) {
    const response = await api.put(`/checks/${id}`, mapCheckToApi(data))
    return {
      check: mapCheckFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Check updated successfully.',
    }
  },

  async completeCheck(id, data = {}) {
    const response = await api.post(`/checks/${id}/complete`, mapCheckToApi(data))
    return {
      check: mapCheckFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Check completed successfully.',
    }
  },

  async deleteCheck(id) {
    const response = await api.delete(`/checks/${id}`)
    return { message: response.data?.message || 'Check deleted successfully.' }
  },
}

export default checkService
