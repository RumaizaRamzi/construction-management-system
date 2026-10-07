import api, { unwrapApiData } from './api'
import {
  mapVehicleFromApi,
  mapVehicleToApi,
  mapVehicleRentalFromApi,
  mapVehicleRentalToApi,
  mapVehicleMaintenanceFromApi,
  mapVehicleMaintenanceToApi,
} from '../utils/apiMappers'

const list = (rows, mapper) => (Array.isArray(rows) ? rows : []).map(mapper).filter(Boolean)

const upload = (url, field, file) => {
  const body = new FormData()
  body.append(field, file)
  return api.post(url, body, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 })
}

export const vehicleService = {
  async getVehicles() {
    const response = await api.get('/vehicles')
    const payload = response.data?.data || {}
    return {
      vehicles: list(payload.data, mapVehicleFromApi),
      options: {
        categories: payload.categories || [],
        statuses: payload.statuses || [],
        maintenanceTypes: payload.maintenance_types || [],
        maintenanceStatuses: payload.maintenance_statuses || [],
        rentalStatuses: payload.rental_statuses || [],
        rateTypes: payload.rate_types || [],
      },
    }
  },

  async getVehicle(id) {
    const response = await api.get(`/vehicles/${id}`)
    const payload = unwrapApiData(response) || {}
    return {
      vehicle: mapVehicleFromApi(payload),
      stats: payload.stats || {},
      currentRental: mapVehicleRentalFromApi(payload.current_rental),
      rentals: list(payload.rentals, mapVehicleRentalFromApi),
      maintenance: list(payload.maintenance, mapVehicleMaintenanceFromApi),
      documents: Array.isArray(payload.documents) ? payload.documents : [],
      activity: Array.isArray(payload.activity) ? payload.activity : [],
    }
  },

  async createVehicle(data) {
    const response = await api.post('/vehicles', mapVehicleToApi(data))
    return {
      vehicle: mapVehicleFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Vehicle added successfully.',
    }
  },

  async updateVehicle(id, data) {
    const response = await api.put(`/vehicles/${id}`, mapVehicleToApi(data))
    return {
      vehicle: mapVehicleFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Vehicle updated successfully.',
    }
  },

  async deleteVehicle(id) {
    const response = await api.delete(`/vehicles/${id}`)
    return { message: response.data?.message || 'Vehicle deleted successfully.' }
  },

  async uploadPhoto(id, file) {
    const response = await upload(`/vehicles/${id}/photo`, 'photo', file)
    return {
      vehicle: mapVehicleFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Vehicle photo uploaded successfully.',
    }
  },

  async deletePhoto(id) {
    const response = await api.delete(`/vehicles/${id}/photo`)
    return {
      vehicle: mapVehicleFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Vehicle photo removed successfully.',
    }
  },

  async getPhotoBlob(id) {
    const response = await api.get(`/vehicles/${id}/photo`, { responseType: 'blob' })
    return response.data
  },

  async getRentals(params) {
    const response = await api.get('/vehicle-rentals', { params })
    return list(unwrapApiData(response), mapVehicleRentalFromApi)
  },

  async createRental(data) {
    const response = await api.post('/vehicle-rentals', mapVehicleRentalToApi(data))
    return {
      rental: mapVehicleRentalFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Vehicle rental created successfully.',
    }
  },

  async updateRental(id, data) {
    const response = await api.put(`/vehicle-rentals/${id}`, mapVehicleRentalToApi(data))
    return {
      rental: mapVehicleRentalFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Vehicle rental updated successfully.',
    }
  },

  async deleteRental(id) {
    const response = await api.delete(`/vehicle-rentals/${id}`)
    return { message: response.data?.message || 'Vehicle rental deleted successfully.' }
  },

  async getMaintenance(params) {
    const response = await api.get('/vehicle-maintenance', { params })
    return list(unwrapApiData(response), mapVehicleMaintenanceFromApi)
  },

  async createMaintenance(data) {
    const response = await api.post('/vehicle-maintenance', mapVehicleMaintenanceToApi(data))
    return {
      record: mapVehicleMaintenanceFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Maintenance record created successfully.',
    }
  },

  async updateMaintenance(id, data) {
    const response = await api.put(`/vehicle-maintenance/${id}`, mapVehicleMaintenanceToApi(data))
    return {
      record: mapVehicleMaintenanceFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Maintenance record updated successfully.',
    }
  },

  async deleteMaintenance(id) {
    const response = await api.delete(`/vehicle-maintenance/${id}`)
    return { message: response.data?.message || 'Maintenance record deleted successfully.' }
  },

  async uploadReceipt(id, file) {
    const response = await upload(`/vehicle-maintenance/${id}/receipt`, 'receipt', file)
    return {
      record: mapVehicleMaintenanceFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Receipt uploaded successfully.',
    }
  },

  async deleteReceipt(id) {
    const response = await api.delete(`/vehicle-maintenance/${id}/receipt`)
    return {
      record: mapVehicleMaintenanceFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Receipt removed successfully.',
    }
  },

  async getReceiptBlob(id) {
    const response = await api.get(`/vehicle-maintenance/${id}/receipt`, { responseType: 'blob' })
    return response.data
  },
}

export default vehicleService
