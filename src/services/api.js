import axios from 'axios'

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL
  if (configured && String(configured).trim()) {
    const url = String(configured).replace(/\/$/, '')
    if (
      import.meta.env.PROD &&
      /localhost|127\.0\.0\.1/i.test(url)
    ) {
      // eslint-disable-next-line no-console
      console.warn(
        'BuildTrack: production build is using a localhost API URL. Set VITE_API_BASE_URL to your HTTPS API before deploying.'
      )
    }
    return url
  }
  // Production builds should set VITE_API_BASE_URL. Fallback assumes same-origin /api proxy.
  if (import.meta.env.PROD) {
    return '/api'
  }
  return 'http://127.0.0.1:8000/api'
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bt_token')
  if (token && token !== 'demo-token-buildtrack') {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('bt_token')
      localStorage.removeItem('bt_user')
      if (typeof window !== 'undefined') {
        const path = window.location.pathname
        if (path !== '/login' && !path.startsWith('/login')) {
          window.location.assign('/login')
        }
      }
    }
    return Promise.reject(error)
  }
)

/**
 * Unwrap Laravel `{ success, message, data }` payloads.
 * Supports both plain arrays and LengthAwarePaginator envelopes.
 */
export function unwrapApiData(response) {
  const body = response?.data
  if (body == null) return null

  const payload = body.data !== undefined ? body.data : body

  if (Array.isArray(payload)) return payload

  if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
    return payload.data
  }

  return payload
}

const STATUS_MESSAGES = {
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested record was not found.',
  422: 'Please check the form and correct the highlighted fields.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'A server error occurred. Please try again later.',
  502: 'The server is temporarily unavailable. Please try again later.',
  503: 'The service is temporarily unavailable. Please try again later.',
}

/**
 * User-friendly API error message. Never exposes stack traces.
 */
export function getApiErrorMessage(error, fallback = 'Unable to complete the request. Please try again.') {
  if (!error) return fallback

  if (error.code === 'ECONNABORTED') {
    return 'The request timed out. Please try again.'
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return "You're offline. Check your connection and try again."
  }

  if (!error?.response) {
    return 'Unable to reach the server. Check that the API is running.'
  }

  const status = error.response.status
  const serverMessage = error.response?.data?.message
  if (typeof serverMessage === 'string' && serverMessage.trim() && status !== 500) {
    if (!/exception|stack|sqlstate|trace/i.test(serverMessage)) {
      return serverMessage.trim()
    }
  }

  return STATUS_MESSAGES[status] || fallback
}

/** Flatten Laravel 422 `errors` object into field => first message. */
export function getApiValidationErrors(error) {
  const errors = error?.response?.data?.errors
  if (!errors || typeof errors !== 'object') return {}
  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages[0] : String(messages),
    ])
  )
}

/** Classify error for UI branching (toast vs field errors vs retry). */
export function getApiErrorKind(error) {
  if (!error?.response) return 'network'
  const status = error.response.status
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 422) return 'validation'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'server'
  return 'unknown'
}

export default api
