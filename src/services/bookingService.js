import api, { unwrapApiData } from './api'
import {
  mapBookingFromApi,
  mapBookingToApi,
  mapRentalFromApi,
} from '../utils/apiMappers'

import fetchAllPages from './fetchAllPages'

export const bookingService = {
  async getBookings(params) {
    const rows = await fetchAllPages('/bookings', params)
    return rows.map(mapBookingFromApi).filter(Boolean)
  },

  async getBooking(id) {
    const response = await api.get(`/bookings/${id}`)
    return mapBookingFromApi(unwrapApiData(response))
  },

  async createBooking(data) {
    const response = await api.post('/bookings', mapBookingToApi(data))
    return {
      booking: mapBookingFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Booking created successfully.',
    }
  },

  async updateBooking(id, data) {
    const response = await api.put(`/bookings/${id}`, mapBookingToApi(data))
    return {
      booking: mapBookingFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Booking updated successfully.',
    }
  },

  async deleteBooking(id) {
    const response = await api.delete(`/bookings/${id}`)
    return {
      message: response.data?.message || 'Booking deleted successfully.',
    }
  },

  async updateBookingStatus(id, status) {
    const response = await api.patch(`/bookings/${id}/status`, { status })
    return {
      booking: mapBookingFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Booking status updated successfully.',
    }
  },

  async convertBookingToRental(id, data = {}) {
    const response = await api.post(`/bookings/${id}/convert-to-rental`, {
      payment_method: data.paymentMethod || data.payment_method || undefined,
      rental_status: data.rentalStatus || data.rental_status || undefined,
      start_date: data.startDate || data.start_date || undefined,
      end_date: data.endDate || data.end_date || undefined,
      expected_return_date: data.expectedReturnDate || data.expected_return_date || undefined,
    })
    const payload = unwrapApiData(response)
    return {
      booking: mapBookingFromApi(payload?.booking),
      rental: mapRentalFromApi(payload?.rental),
      message: response.data?.message || 'Booking converted to rental successfully.',
    }
  },

  async checkAvailability(params) {
    const response = await api.get('/bookings/availability', {
      params: {
        product_id: params.productId ?? params.product_id,
        start_date: params.startDate ?? params.start_date,
        end_date: params.endDate ?? params.end_date,
        exclude_booking_id: params.excludeBookingId ?? params.exclude_booking_id,
      },
    })
    const data = unwrapApiData(response) || {}
    return {
      productId: data.product_id ?? data.productId,
      productName: data.product_name || data.productName || '',
      totalQuantity: Number(data.total_quantity ?? data.totalQuantity ?? 0),
      bookedQuantity: Number(data.booked_quantity ?? data.bookedQuantity ?? 0),
      rentedQuantity: Number(data.rented_quantity ?? data.rentedQuantity ?? 0),
      maintenanceQuantity: Number(data.maintenance_quantity ?? data.maintenanceQuantity ?? 0),
      availableQuantity: Number(data.available_quantity ?? data.availableQuantity ?? 0),
      startDate: data.start_date || data.startDate || '',
      endDate: data.end_date || data.endDate || '',
      message: response.data?.message || '',
      raw: data,
    }
  },
}

export default bookingService
