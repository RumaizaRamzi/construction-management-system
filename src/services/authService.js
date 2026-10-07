import api, { unwrapApiData, getApiErrorMessage } from './api'
import fetchAllPages from './fetchAllPages'

const TOKEN_KEY = 'bt_token'
const USER_KEY = 'bt_user'

export function getStoredToken() {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token || token === 'demo-token-buildtrack') return null
  return token
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function persistSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  if (user) {
    // Persist only fields needed for bootstrapping the SPA (permissions refreshed via /auth/me).
    const safe = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      role_id: user.role_id,
      role_slug: user.role_slug,
      status: user.status,
      must_change_password: Boolean(user.must_change_password),
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      phone: user.phone ?? null,
    }
    localStorage.setItem(USER_KEY, JSON.stringify(safe))
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

const authService = {
  async login({ email, password, device_name = 'buildtrack-web' }) {
    const response = await api.post('/auth/login', { email, password, device_name })
    const data = unwrapApiData(response)
    if (!data?.token || !data?.user) {
      throw new Error('Invalid login response from server.')
    }
    persistSession(data.token, data.user)
    return data
  },

  async logout() {
    try {
      await api.post('/auth/logout')
    } catch {
      // Token may already be invalid; still clear local session.
    } finally {
      clearSession()
    }
  },

  async me() {
    const response = await api.get('/auth/me')
    const user = unwrapApiData(response)
    if (user) persistSession(getStoredToken(), user)
    return user
  },

  async updateProfile(payload) {
    const response = await api.put('/auth/profile', payload)
    const user = unwrapApiData(response)
    if (user) persistSession(getStoredToken(), user)
    return {
      user,
      message: response?.data?.message || 'Profile updated successfully.',
    }
  },

  async getUsers(params) {
    return fetchAllPages('/users', params, { maxPages: 10 })
  },

  async getUser(id) {
    const response = await api.get(`/users/${id}`)
    return unwrapApiData(response)
  },

  async createUser(payload) {
    const response = await api.post('/users', payload)
    return {
      user: unwrapApiData(response),
      message: response?.data?.message || 'User created successfully.',
    }
  },

  async updateUser(id, payload) {
    const response = await api.put(`/users/${id}`, payload)
    return {
      user: unwrapApiData(response),
      message: response?.data?.message || 'User updated successfully.',
    }
  },

  async deleteUser(id) {
    const response = await api.delete(`/users/${id}`)
    return {
      message: response?.data?.message || 'User deleted successfully.',
    }
  },

  async getRoles() {
    const response = await api.get('/roles')
    return unwrapApiData(response) || []
  },

  async getPermissions() {
    const response = await api.get('/permissions')
    return unwrapApiData(response) || []
  },

  getApiErrorMessage,
}

export default authService
