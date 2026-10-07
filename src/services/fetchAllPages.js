import api, { unwrapApiData } from './api'

const MAX_PAGES = 20

/**
 * Collect paginated Laravel list responses with a hard page cap
 * to avoid unbounded client memory / request storms.
 */
export default async function fetchAllPages(path, params = {}, { maxPages = MAX_PAGES, perPage = 100 } = {}) {
  const first = await api.get(path, { params: { ...params, per_page: perPage, page: 1 } })
  const body = first.data?.data
  let rows = unwrapApiData(first)

  if (!Array.isArray(rows)) rows = []

  const lastPage = Math.min(Number(body?.last_page || 1), maxPages)
  for (let page = 2; page <= lastPage; page += 1) {
    const res = await api.get(path, { params: { ...params, per_page: perPage, page } })
    const chunk = unwrapApiData(res)
    if (Array.isArray(chunk) && chunk.length) rows = rows.concat(chunk)
  }

  return rows
}
