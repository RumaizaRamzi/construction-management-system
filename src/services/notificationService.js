import api, { unwrapApiData } from './api'
import { mapNotificationFromApi, mapNotificationToApi } from '../utils/apiMappers'

import fetchAllPages from './fetchAllPages'

export const notificationService = {
  async getNotifications(params) {
    const rows = await fetchAllPages('/notifications', params)
    return rows.map(mapNotificationFromApi).filter(Boolean)
  },

  async getNotification(id) {
    const response = await api.get(`/notifications/${id}`)
    return mapNotificationFromApi(unwrapApiData(response))
  },

  async createNotification(data) {
    const response = await api.post('/notifications', mapNotificationToApi(data))
    return {
      notification: mapNotificationFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Notification created successfully.',
    }
  },

  async updateNotification(id, data) {
    const response = await api.put(`/notifications/${id}`, mapNotificationToApi(data))
    return {
      notification: mapNotificationFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Notification updated successfully.',
    }
  },

  async deleteNotification(id) {
    const response = await api.delete(`/notifications/${id}`)
    return { message: response.data?.message || 'Notification deleted successfully.' }
  },

  async markAsRead(id) {
    const response = await api.post(`/notifications/${id}/read`)
    return {
      notification: mapNotificationFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Notification marked as read.',
    }
  },

  async dismissNotification(id) {
    const response = await api.post(`/notifications/${id}/dismiss`)
    return {
      notification: mapNotificationFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Notification dismissed.',
    }
  },

  async markAllAsRead() {
    const response = await api.post('/notifications/mark-all-read')
    return {
      data: unwrapApiData(response),
      message: response.data?.message || 'All notifications marked as read.',
    }
  },

  async getUnreadCount() {
    try {
      const response = await api.get('/notifications/unread-count')
      const data = unwrapApiData(response)
      return Number(data?.count ?? 0)
    } catch {
      return 0
    }
  },

  async generateAlerts() {
    const response = await api.post('/notifications/generate')
    return {
      data: unwrapApiData(response),
      message: response.data?.message || 'Alerts generated.',
    }
  },
}

export default notificationService
