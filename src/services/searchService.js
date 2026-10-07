import api, { unwrapApiData } from './api'

/**
 * Global search against Laravel /api/search (permission-filtered).
 */
export const searchService = {
  async search(query, { type, limit = 8, signal } = {}) {
    const q = String(query || '').trim()
    if (q.length < 2) {
      return { query: q, results: [], groups: {}, total: 0 }
    }

    const response = await api.get('/search', {
      params: {
        q,
        ...(type ? { type } : {}),
        limit,
      },
      signal,
    })

    const data = unwrapApiData(response) || {}
    return {
      query: data.query || q,
      results: Array.isArray(data.results) ? data.results : [],
      groups: data.groups && typeof data.groups === 'object' ? data.groups : {},
      total: Number(data.total) || 0,
      message: response.data?.message,
    }
  },
}

export default searchService
