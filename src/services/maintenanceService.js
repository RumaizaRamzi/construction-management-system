import api, { unwrapApiData } from './api'
import { mapMaintenanceFromApi, mapMaintenanceToApi } from '../utils/apiMappers'
import fetchAllPages from './fetchAllPages'

export const maintenanceService = {
  async getMaintenance(params) {
    const rows = await fetchAllPages('/maintenance', params)
    return rows.map(mapMaintenanceFromApi).filter(Boolean)
  },

  async getMaintenanceById(id) {
    const response = await api.get(`/maintenance/${id}`)
    return mapMaintenanceFromApi(unwrapApiData(response))
  },

  async createMaintenance(data) {
    const response = await api.post('/maintenance', mapMaintenanceToApi(data))
    return {
      maintenance: mapMaintenanceFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Maintenance created successfully.',
    }
  },

  async updateMaintenance(id, data) {
    const response = await api.put(`/maintenance/${id}`, mapMaintenanceToApi(data))
    return {
      maintenance: mapMaintenanceFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Maintenance updated successfully.',
    }
  },

  async completeMaintenance(id, data = {}) {
    const response = await api.post(`/maintenance/${id}/complete`, mapMaintenanceToApi(data))
    return {
      maintenance: mapMaintenanceFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Maintenance completed successfully.',
    }
  },

  async cancelMaintenance(id, data = {}) {
    const response = await api.post(`/maintenance/${id}/cancel`, mapMaintenanceToApi(data))
    return {
      maintenance: mapMaintenanceFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Maintenance cancelled successfully.',
    }
  },

  async deleteMaintenance(id) {
    const response = await api.delete(`/maintenance/${id}`)
    return { message: response.data?.message || 'Maintenance deleted successfully.' }
  },
}

export default maintenanceService
