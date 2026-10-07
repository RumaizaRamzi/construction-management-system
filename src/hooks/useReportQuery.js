import { useCallback, useEffect, useState } from 'react'
import { getApiErrorMessage } from '../services/api'

/**
 * Load a report from the Laravel API whenever the date range changes.
 * Pages keep existing UI; they just swap in `data` when ready.
 */
export default function useReportQuery(fetcher, { from, to, enabled = true, extraKey = '' } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!enabled || typeof fetcher !== 'function') return null
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher({ from, to })
      setData(result)
      return result
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load report.'))
      throw err
    } finally {
      setLoading(false)
    }
  }, [fetcher, from, to, enabled, extraKey])

  useEffect(() => {
    let cancelled = false
    if (!enabled) {
      setLoading(false)
      return undefined
    }
    setLoading(true)
    setError(null)
    fetcher({ from, to })
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'Unable to load report.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetcher, from, to, enabled, extraKey])

  return { data, loading, error, reload: load }
}
