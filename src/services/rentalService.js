import api, { unwrapApiData } from './api'
import {
  mapRentalFromApi,
  mapRentalToApi,
  mapRentalPaymentFromApi,
  mapRentalReturnFromApi,
} from '../utils/apiMappers'

import fetchAllPages from './fetchAllPages'

export const rentalService = {
  async getRentals(params) {
    const rows = await fetchAllPages('/rentals', params)
    return rows.map(mapRentalFromApi).filter(Boolean)
  },

  async getRental(id) {
    const response = await api.get(`/rentals/${id}`)
    return mapRentalFromApi(unwrapApiData(response))
  },

  async createRental(data) {
    const response = await api.post('/rentals', mapRentalToApi(data))
    return {
      rental: mapRentalFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Rental created successfully.',
    }
  },

  async updateRental(id, data) {
    const response = await api.put(`/rentals/${id}`, mapRentalToApi(data))
    return {
      rental: mapRentalFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Rental updated successfully.',
    }
  },

  async deleteRental(id) {
    const response = await api.delete(`/rentals/${id}`)
    return {
      message: response.data?.message || 'Rental deleted successfully.',
    }
  },

  async getRentalPayments(rentalId) {
    const response = await api.get(`/rentals/${rentalId}/payments`)
    const rows = unwrapApiData(response)
    return (Array.isArray(rows) ? rows : []).map(mapRentalPaymentFromApi).filter(Boolean)
  },

  async addRentalPayment(rentalId, data) {
    const response = await api.post(`/rentals/${rentalId}/payments`, {
      amount: Number(data.amount),
      payment_date: data.paymentDate || data.payment_date || undefined,
      payment_method: data.paymentMethod || data.payment_method || undefined,
      reference: data.referenceNumber || data.reference || data.reference_number || undefined,
      reference_number: data.referenceNumber || data.reference || data.reference_number || undefined,
      notes: data.notes || undefined,
    })
    const payload = unwrapApiData(response)
    return {
      payment: mapRentalPaymentFromApi(payload?.payment || payload),
      rental: mapRentalFromApi(payload?.rental),
      message: response.data?.message || 'Payment recorded successfully.',
    }
  },

  async updateRentalPayment(rentalId, paymentId, data) {
    const response = await api.put(`/rentals/${rentalId}/payments/${paymentId}`, {
      amount: data.amount != null ? Number(data.amount) : undefined,
      payment_date: data.paymentDate || data.payment_date || undefined,
      payment_method: data.paymentMethod || data.payment_method || undefined,
      reference: data.referenceNumber || data.reference || data.reference_number || undefined,
      reference_number: data.referenceNumber || data.reference || data.reference_number || undefined,
      notes: data.notes,
    })
    const payload = unwrapApiData(response)
    return {
      payment: mapRentalPaymentFromApi(payload?.payment || payload),
      rental: mapRentalFromApi(payload?.rental),
      message: response.data?.message || 'Payment updated successfully.',
    }
  },

  async deleteRentalPayment(rentalId, paymentId) {
    const response = await api.delete(`/rentals/${rentalId}/payments/${paymentId}`)
    const payload = unwrapApiData(response)
    return {
      rental: mapRentalFromApi(payload?.rental),
      message: response.data?.message || 'Payment deleted successfully.',
    }
  },

  async returnRental(rentalId, data) {
    const response = await api.post(`/rentals/${rentalId}/return`, {
      return_date: data.returnDate || data.return_date || data.actualReturnDate,
      returned_quantity: Number(data.returnedQuantity ?? data.returnedQty ?? 0),
      damaged_quantity: Number(data.damagedQuantity ?? data.damagedQty ?? 0),
      missing_quantity: Number(data.missingQuantity ?? data.missingQty ?? 0),
      condition: data.condition,
      late_fee: data.lateFee != null ? Number(data.lateFee) : undefined,
      damage_fee: data.damageFee != null ? Number(data.damageFee) : undefined,
      damage_description: data.damageDescription || data.damage_description,
      notes: data.notes,
      send_to_maintenance: Boolean(data.sendToMaintenance || data.send_to_maintenance),
      items: Array.isArray(data.items) && data.items.length ? data.items : undefined,
    })
    return {
      rental: mapRentalFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Rental return processed successfully.',
    }
  },

  async getRentalReturn(rentalId) {
    const response = await api.get(`/rentals/${rentalId}/return`)
    const payload = unwrapApiData(response)
    return {
      rental: mapRentalFromApi(payload?.rental),
      returns: (payload?.returns || []).map(mapRentalReturnFromApi).filter(Boolean),
      returnInfo: mapRentalReturnFromApi(payload?.return),
    }
  },

  async getInvoiceSms(rentalId) {
    const response = await api.get(`/rentals/${rentalId}/invoice-sms`)
    return unwrapApiData(response)
  },

  async sendInvoiceSms(rentalId, data) {
    const response = await api.post(`/rentals/${rentalId}/invoice-sms`, data)
    return { message: response.data?.message || 'Invoice sent via SMS.' }
  },
}

export default rentalService
