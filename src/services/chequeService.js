import api from './api'
import { mapChequeFromApi, mapChequeToApi } from '../utils/chequeHelpers'

const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== 'all'))

const totals = (t) => ({ count: Number(t?.count || 0), amount: Number(t?.amount || 0) })

export const chequeService = {
  /** One server-side page: `{ rows, page, totalPages, total }`. */
  async getCheques(params = {}) {
    const response = await api.get('/cheques', { params: clean(params) })
    const body = response.data?.data || {}
    return {
      rows: (Array.isArray(body.data) ? body.data : []).map(mapChequeFromApi).filter(Boolean),
      page: Number(body.current_page || 1),
      totalPages: Number(body.last_page || 1),
      total: Number(body.total || 0),
    }
  },

  async getSummary() {
    const response = await api.get('/cheques/summary')
    const s = response.data?.data || {}
    return {
      pending: totals(s.pending),
      deposited: totals(s.deposited),
      cleared: totals(s.cleared),
      bounced: totals(s.bounced),
      overdue: totals(s.overdue),
      dueThisWeek: totals(s.due_this_week),
      customers: Array.isArray(s.customers) ? s.customers : [],
      suppliers: Array.isArray(s.suppliers) ? s.suppliers : [],
    }
  },

  async getCheque(id) {
    const response = await api.get(`/cheques/${id}`)
    return mapChequeFromApi(response.data?.data)
  },

  async getLinkOptions(type, search = '') {
    const response = await api.get('/cheques/link-options', { params: clean({ type, search }) })
    return Array.isArray(response.data?.data) ? response.data.data : []
  },

  async createCheque(form) {
    const response = await api.post('/cheques', mapChequeToApi(form))
    return { cheque: mapChequeFromApi(response.data?.data), message: response.data?.message || 'Cheque added successfully.' }
  },

  async updateCheque(id, form) {
    const response = await api.put(`/cheques/${id}`, mapChequeToApi(form))
    return { cheque: mapChequeFromApi(response.data?.data), message: response.data?.message || 'Cheque updated successfully.' }
  },

  async updateStatus(id, status, note = '') {
    const response = await api.patch(`/cheques/${id}/status`, { status, note: note.trim() || null })
    return { cheque: mapChequeFromApi(response.data?.data), message: response.data?.message || 'Cheque status updated.' }
  },

  async deleteCheque(id) {
    const response = await api.delete(`/cheques/${id}`)
    return { message: response.data?.message || 'Cheque deleted successfully.' }
  },

  async getReport(params = {}) {
    const response = await api.get('/reports/cheques', { params: clean(params) })
    const body = response.data?.data || {}
    const s = body.summary || {}
    return {
      summary: Object.fromEntries(
        ['total', 'pending', 'deposited', 'cleared', 'bounced', 'upcoming', 'overdue', 'received', 'issued'].map((k) => [k, totals(s[k])])
      ),
      cheques: (Array.isArray(body.cheques) ? body.cheques : []).map(mapChequeFromApi).filter(Boolean),
    }
  },
}

export default chequeService
