import api from './api'
import { mapBranchFromApi, mapBranchToApi } from '../utils/apiMappers'

const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== 'all'))

const data = (response) => response?.data?.data

/** Admin-only endpoints (/api/admin/*). The server rejects non-admins with 403. */
const adminService = {
  async getUsers(params = {}) {
    const payload = data(await api.get('/admin/users', { params: clean(params) })) || {}
    const page = payload.users || {}
    return {
      rows: Array.isArray(page.data) ? page.data : [],
      page: Number(page.current_page || 1),
      totalPages: Number(page.last_page || 1),
      total: Number(page.total || 0),
      summary: payload.summary || { total: 0, active: 0, admins: 0, must_change_password: 0 },
    }
  },

  async getUserOptions(userId) {
    const payload = data(await api.get('/admin/users/options', { params: clean({ user_id: userId }) })) || {}
    return { roles: payload.roles || [], staff: payload.staff || [] }
  },

  async createUser(payload) {
    const response = await api.post('/admin/users', payload)
    const body = data(response) || {}
    return { user: body.user, generatedPassword: body.generated_password || null, message: response.data?.message || 'User created successfully.' }
  },

  async updateUser(id, payload) {
    const response = await api.put(`/admin/users/${id}`, payload)
    return { user: data(response), message: response.data?.message || 'User updated successfully.' }
  },

  async resetPassword(id, payload) {
    const response = await api.post(`/admin/users/${id}/reset-password`, payload)
    const body = data(response) || {}
    return { user: body.user, generatedPassword: body.generated_password || null, message: response.data?.message || 'Password reset successfully.' }
  },

  async setUserStatus(id, status) {
    const response = await api.patch(`/admin/users/${id}/status`, { status })
    return { user: data(response), message: response.data?.message || 'Login status updated.' }
  },

  async deleteUser(id) {
    const response = await api.delete(`/admin/users/${id}`)
    return { message: response.data?.message || 'User deleted successfully.' }
  },

  async getRoles() {
    return data(await api.get('/admin/roles')) || []
  },

  async getPermissions() {
    return data(await api.get('/admin/permissions')) || []
  },

  async createRole(payload) {
    const response = await api.post('/admin/roles', payload)
    return { role: data(response), message: response.data?.message || 'Role created successfully.' }
  },

  async updateRole(id, payload) {
    const response = await api.put(`/admin/roles/${id}`, payload)
    return { role: data(response), message: response.data?.message || 'Role updated successfully.' }
  },

  async deleteRole(id) {
    const response = await api.delete(`/admin/roles/${id}`)
    return { message: response.data?.message || 'Role deleted successfully.' }
  },

  async getActivity(params = {}, signal) {
    const payload = data(await api.get('/admin/activity-logs', { params: clean(params), signal })) || {}
    return {
      rows: Array.isArray(payload.data) ? payload.data : [],
      meta: payload.meta || { current_page: 1, last_page: 1, total: 0 },
      modules: payload.modules || [],
    }
  },

  async getBranches() {
    const rows = data(await api.get('/admin/branches'))
    return (Array.isArray(rows) ? rows : []).map(mapBranchFromApi).filter(Boolean)
  },

  async createBranch(branch) {
    const response = await api.post('/admin/branches', mapBranchToApi(branch))
    return { branch: mapBranchFromApi(data(response)), message: response.data?.message || 'Branch created successfully.' }
  },

  async updateBranch(id, branch) {
    const response = await api.put(`/admin/branches/${id}`, mapBranchToApi(branch))
    return { branch: mapBranchFromApi(data(response)), message: response.data?.message || 'Branch updated successfully.' }
  },

  async deleteBranch(id) {
    const response = await api.delete(`/admin/branches/${id}`)
    return { message: response.data?.message || 'Branch deleted successfully.' }
  },

  async getSmsGateway() {
    return data(await api.get('/admin/sms-gateway')) || {}
  },

  async updateSmsGateway(payload) {
    const response = await api.put('/admin/sms-gateway', payload)
    return { gateway: data(response) || {}, message: response.data?.message || 'SMS gateway settings saved.' }
  },

  async sendTestSms(payload) {
    const response = await api.post('/admin/sms-gateway/test', payload)
    return { message: response.data?.message || 'SMS sent successfully.' }
  },
}

export default adminService
