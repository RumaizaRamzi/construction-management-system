import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Loader2, MapPin, UserRound } from 'lucide-react'

// Photon (OpenStreetMap, built for type-ahead) is primary; Nominatim is only a fallback.
const PHOTON_URL = 'https://photon.komoot.io/api/'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const DEBOUNCE_MS = 250
// Nominatim's public API allows at most 1 request per second.
const NOMINATIM_GAP_MS = 1000
const MAX_SAVED = 3

// Photon has no country filter, so results are bounded to the country's box and filtered by country code.
const COUNTRY_BBOX = { lk: '79.4,5.8,82.0,9.95' }

// Shared across instances so repeated queries are answered without a new request.
const resultCache = new Map()
let lastNominatimAt = 0

const normalize = (text) => String(text || '').trim().replace(/\s+/g, ' ').toLowerCase()

const uniqueParts = (parts) => {
  const seen = new Set()
  return parts.filter((part) => {
    const key = normalize(part)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const dedupeItems = (items) => {
  const seen = new Set()
  return items.filter((item) => {
    const key = normalize(item.label)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })

async function searchPhoton(query, { countryCodes, limit, signal }) {
  const params = new URLSearchParams({ q: query, limit: String(limit), lang: 'en' })
  const code = countryCodes.split(',')[0]?.trim().toLowerCase()
  if (COUNTRY_BBOX[code]) params.set('bbox', COUNTRY_BBOX[code])

  const response = await fetch(`${PHOTON_URL}?${params}`, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Photon lookup failed (${response.status})`)
  const data = await response.json()
  const allowed = countryCodes.toUpperCase().split(',').map((c) => c.trim())

  return dedupeItems(
    (data?.features || [])
      .map((feature) => feature?.properties || {})
      .filter((p) => p.name && (!p.countrycode || allowed.includes(String(p.countrycode).toUpperCase())))
      .map((p) => {
        const street = [p.housenumber, p.street].filter(Boolean).join(' ')
        const city = p.city || (['city', 'town', 'village'].includes(p.type) ? p.name : '') || p.locality || ''
        const label = uniqueParts([p.name, street, p.locality, p.district, p.city, p.county, p.state, p.postcode, p.country]).join(', ')
        return { label, city, source: 'map' }
      })
  )
}

async function searchNominatim(query, { countryCodes, limit, signal }) {
  const wait = NOMINATIM_GAP_MS - (Date.now() - lastNominatimAt)
  if (wait > 0) await sleep(wait, signal)
  lastNominatimAt = Date.now()

  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(limit),
    countrycodes: countryCodes,
    'accept-language': 'en',
    q: query,
  })
  const response = await fetch(`${NOMINATIM_URL}?${params}`, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Nominatim lookup failed (${response.status})`)
  const data = await response.json()

  return dedupeItems(
    (Array.isArray(data) ? data : [])
      .filter((row) => row?.display_name)
      .map((row) => ({ label: row.display_name, city: cityFromNominatim(row.address), source: 'map' }))
  )
}

const splitLabel = (label) => {
  const [name, ...rest] = String(label).split(',')
  return { name: name.trim(), detail: rest.map((part) => part.trim()).filter(Boolean).join(', ') }
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function Highlight({ text, query }) {
  if (!query) return text
  const parts = String(text).split(new RegExp(`(${escapeRegExp(query)})`, 'ig'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded-sm bg-brand-100 text-inherit dark:bg-brand-900/60">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

const cityFromNominatim = (address = {}) =>
  address.city || address.town || address.village || address.municipality || address.suburb || ''

/**
 * Free-text address field with live suggestions.
 * Suggestions only help fill the field; any typed value is kept and saved as-is.
 *
 * savedAddresses: strings or { address, city } objects from existing app data.
 * onSelect(item): optional, receives { label, city, source } after a suggestion is picked.
 */
export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  savedAddresses = [],
  rows,
  className = 'input-field',
  placeholder,
  countryCodes = 'lk',
  limit = 8,
  ...inputProps
}) {
  const listId = useId()
  const wrapperRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [remote, setRemote] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const query = String(value || '').trim()

  const savedItems = useMemo(() => {
    if (!query) return []
    const q = normalize(query)
    const seen = new Set()
    const items = []
    for (const entry of savedAddresses) {
      const label = String(typeof entry === 'string' ? entry : entry?.address || '').trim()
      const key = normalize(label)
      if (!label || seen.has(key) || key === q || !key.includes(q)) continue
      seen.add(key)
      items.push({ label, city: typeof entry === 'string' ? '' : entry?.city || '', source: 'saved' })
      if (items.length >= MAX_SAVED) break
    }
    return items
  }, [savedAddresses, query])

  const suggestions = useMemo(() => {
    const seen = new Set(savedItems.map((item) => normalize(item.label)))
    const remoteItems = remote.filter((item) => {
      const key = normalize(item.label)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return [...savedItems, ...remoteItems]
  }, [savedItems, remote])

  useEffect(() => {
    setActiveIndex(-1)
    if (!open || !query) {
      setLoading(false)
      return undefined
    }

    const cacheKey = `${countryCodes}|${limit}|${normalize(query)}`
    if (resultCache.has(cacheKey)) {
      setRemote(resultCache.get(cacheKey))
      setLoading(false)
      setSearched(true)
      return undefined
    }

    // Previous results stay visible until the new ones arrive.
    setLoading(true)
    const controller = new AbortController()
    const options = { countryCodes, limit, signal: controller.signal }

    const timer = setTimeout(async () => {
      try {
        let items
        try {
          items = await searchPhoton(query, options)
        } catch (err) {
          if (err?.name === 'AbortError') throw err
          items = await searchNominatim(query, options)
        }
        resultCache.set(cacheKey, items)
        setRemote(items)
        setSearched(true)
      } catch (err) {
        if (err?.name === 'AbortError') return
        setRemote([])
        setSearched(false)
      }
      setLoading(false)
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, open, countryCodes, limit])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [open])

  const select = (item) => {
    onChange?.(item.label)
    onSelect?.(item)
    setOpen(false)
    setActiveIndex(-1)
  }

  const handleKeyDown = (e) => {
    if (!open || !query) return
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
      e.preventDefault()
      select(suggestions[activeIndex])
    }
  }

  // Failed lookups stay silent unless there are saved matches to show.
  const showDropdown = open && Boolean(query) && (suggestions.length > 0 || loading || searched)

  const fieldProps = {
    ...inputProps,
    className,
    placeholder,
    value: value || '',
    autoComplete: 'off',
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': showDropdown,
    'aria-controls': listId,
    'aria-activedescendant': activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined,
    onChange: (e) => {
      onChange?.(e.target.value)
      setOpen(true)
    },
    onFocus: (e) => {
      setOpen(true)
      inputProps.onFocus?.(e)
    },
    onBlur: (e) => {
      if (!wrapperRef.current?.contains(e.relatedTarget)) setOpen(false)
      inputProps.onBlur?.(e)
    },
    onKeyDown: (e) => {
      handleKeyDown(e)
      inputProps.onKeyDown?.(e)
    },
  }

  return (
    <div ref={wrapperRef} className="relative">
      {rows ? <textarea rows={rows} {...fieldProps} /> : <input type="text" {...fieldProps} />}

      {showDropdown ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {suggestions.map((item, index) => {
            const Icon = item.source === 'saved' ? UserRound : MapPin
            const active = index === activeIndex
            const { name, detail } = splitLabel(item.label)
            return (
              <button
                key={`${item.source}-${item.label}`}
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(item)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex w-full items-start gap-2.5 border-b border-slate-100 px-3 py-2 text-left transition-colors last:border-b-0 dark:border-slate-800 ${
                  active ? 'bg-brand-50 dark:bg-brand-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={15} className="mt-0.5 shrink-0 text-brand-500" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900 dark:text-white">
                    <Highlight text={name} query={query} />
                  </span>
                  {detail || item.source === 'saved' ? (
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      <Highlight text={detail} query={query} />
                      {item.source === 'saved' ? `${detail ? ' · ' : ''}Saved address` : null}
                    </span>
                  ) : null}
                </span>
              </button>
            )
          })}

          {loading ? (
            <p className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
              <Loader2 size={12} className="animate-spin" aria-hidden />
              Searching...
            </p>
          ) : null}

          {!loading && searched && suggestions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">No results</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
