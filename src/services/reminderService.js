import api, { unwrapApiData } from './api'
import { mapReminderFromApi, mapReminderToApi } from '../utils/apiMappers'
import fetchAllPages from './fetchAllPages'

export const reminderService = {
  async getReminders(params) {
    const rows = await fetchAllPages('/reminders', params)
    return rows.map(mapReminderFromApi).filter(Boolean)
  },

  async getRecurringReminders(params) {
    return this.getReminders({ ...params, recurring_only: 1 })
  },

  async getReminderById(id) {
    const response = await api.get(`/reminders/${id}`)
    return mapReminderFromApi(unwrapApiData(response))
  },

  async createReminder(data) {
    const response = await api.post('/reminders', mapReminderToApi(data))
    return {
      reminder: mapReminderFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Reminder created successfully.',
    }
  },

  async updateReminder(id, data) {
    const response = await api.put(`/reminders/${id}`, mapReminderToApi(data))
    return {
      reminder: mapReminderFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Reminder updated successfully.',
    }
  },

  async completeReminder(id) {
    const response = await api.post(`/reminders/${id}/complete`)
    return {
      reminder: mapReminderFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Reminder completed successfully.',
    }
  },

  async dismissReminder(id) {
    const response = await api.post(`/reminders/${id}/dismiss`)
    return {
      reminder: mapReminderFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Reminder dismissed successfully.',
    }
  },

  async deleteReminder(id) {
    const response = await api.delete(`/reminders/${id}`)
    return { message: response.data?.message || 'Reminder deleted successfully.' }
  },
}

export default reminderService
