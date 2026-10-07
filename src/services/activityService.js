import api from './api'

const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== 'all'))

const pageOf = (response) => {
  const payload = response?.data?.data || {}
  return {
    rows: Array.isArray(payload.data) ? payload.data : [],
    meta: payload.meta || { current_page: 1, last_page: 1, total: 0 },
    modules: payload.modules || [],
    types: payload.types || [],
  }
}

const activityService = {
  async getActivity(params = {}, signal) {
    return pageOf(await api.get('/activity-logs', { params: clean(params), signal }))
  },

  async getAuditLogs(params = {}, signal) {
    return pageOf(await api.get('/audit-logs', { params: clean(params), signal }))
  },
}

export default activityService
