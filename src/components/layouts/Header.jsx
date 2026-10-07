import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  AlarmClock,
  Bell,
  ClipboardCheck,
  KeyRound,
  LogOut,
  Menu,
  Moon,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Sun,
  Truck,
  User,
  Users,
  Wallet,
  Wrench,
  X,
  CalendarCheck,
  Receipt,
} from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import BrandLogo from '../ui/BrandLogo'
import { useTheme } from '../../contexts/ThemeContext'
import {
  NotificationBadge,
  NotificationDropdown,
} from '../notifications'
import searchService from '../../services/searchService'
import { getApiErrorMessage } from '../../services/api'

const TYPE_ICONS = {
  Product: Package,
  Customer: Users,
  Supplier: Truck,
  Sale: ShoppingCart,
  Rental: KeyRound,
  Booking: CalendarCheck,
  Income: Wallet,
  Expense: Receipt,
  Maintenance: Wrench,
  Check: ClipboardCheck,
  Reminder: AlarmClock,
}

const PAGE_ACTIONS = {
  '/products': { label: 'Add Product', permission: 'products.create', to: '/products', state: { createProduct: true } },
  '/sales': { label: 'New Sale', permission: 'sales.create', to: '/sales/new' },
  '/rentals': { label: 'New Rental', permission: 'rentals.create', to: '/rentals/new' },
}

const DEBOUNCE_MS = 300
const MIN_QUERY = 2

function useDebouncedApiSearch(query) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)
  const requestId = useRef(0)

  useEffect(() => {
    const q = query.trim()
    if (q.length < MIN_QUERY) {
      setResults([])
      setLoading(false)
      setError(null)
      if (abortRef.current) abortRef.current.abort()
      return undefined
    }

    setLoading(true)
    setError(null)
    const timer = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const id = ++requestId.current

      try {
        const data = await searchService.search(q, { limit: 8, signal: controller.signal })
        if (id !== requestId.current) return
        setResults(Array.isArray(data.results) ? data.results : [])
        setError(null)
      } catch (err) {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return
        if (id !== requestId.current) return
        setResults([])
        setError(getApiErrorMessage(err, 'Search failed. Please try again.'))
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [query])

  return { results, loading, error }
}

export default function Header({ onMenuClick }) {
  const {
    user,
    logout,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    can,
  } = useApp()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const pageAction = PAGE_ACTIONS[pathname.replace(/\/+$/, '') || '/']
  const showPageAction = pageAction && can(pageAction.permission)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileSearch, setMobileSearch] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const notifRef = useRef(null)
  const profileRef = useRef(null)
  const searchRef = useRef(null)
  const mobileSearchRef = useRef(null)

  const unread = unreadNotificationCount
  const recent = useMemo(() => notifications.slice(0, 5), [notifications])
  const { results, loading, error } = useDebouncedApiSearch(query)

  const groupedResults = useMemo(() => {
    const groups = []
    const byType = new Map()
    results.forEach((item) => {
      const type = item.type || 'Other'
      if (!byType.has(type)) {
        const group = { type, items: [] }
        byType.set(type, group)
        groups.push(group)
      }
      byType.get(type).items.push({
        id: `${item.type_key || type}-${item.id}`,
        type,
        label: item.title,
        meta: [...new Set([item.reference, item.subtitle, item.status].filter((v) => v && v !== item.title))].join(' · '),
        to: item.url,
        icon: TYPE_ICONS[type] || Search,
      })
    })
    return groups
  }, [results])

  const mappedResults = useMemo(() => groupedResults.flatMap((g) => g.items), [groupedResults])

  useEffect(() => {
    const onClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false)
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false)
      const inDesktopSearch = searchRef.current?.contains(e.target)
      const inMobileSearch = mobileSearchRef.current?.contains(e.target)
      if (!inDesktopSearch && !inMobileSearch) {
        setSearchOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const clearSearch = useCallback(() => {
    setQuery('')
    setSearchOpen(false)
    setMobileSearch(false)
    setActiveIndex(-1)
  }, [])

  const goToResult = (item) => {
    if (!item?.to) return
    navigate(item.to)
    clearSearch()
  }

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      setSearchOpen(false)
      setActiveIndex(-1)
      return
    }
    if (!mappedResults.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % mappedResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? mappedResults.length - 1 : i - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      goToResult(mappedResults[activeIndex])
    }
  }

  const showPanel = searchOpen && query.trim().length >= MIN_QUERY

  const searchPanel = showPanel && (
    <div
      role="listbox"
      className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
    >
      {loading ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">Searching…</p>
      ) : error ? (
        <p className="px-4 py-6 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : mappedResults.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">No results found.</p>
      ) : (
        groupedResults.map((group) => (
          <div key={group.type} role="group" aria-label={group.type}>
            <p className="sticky top-0 bg-slate-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {group.type} ({group.items.length})
            </p>
            {group.items.map((item) => {
              const idx = mappedResults.indexOf(item)
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={idx === activeIndex}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${
                    idx === activeIndex ? 'bg-slate-100 dark:bg-slate-800' : ''
                  }`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => goToResult(item)}
                >
                  <Icon size={16} className="shrink-0 text-slate-400" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{item.label}</span>
                    {item.meta ? <span className="block truncate text-xs text-slate-500">{item.meta}</span> : null}
                  </span>
                </button>
              )
            })}
          </div>
        ))
      )}
    </div>
  )

  return (
    <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:h-16 sm:gap-3 sm:px-4 lg:px-6">
      <button
        type="button"
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
      >
        <Menu size={20} />
      </button>
      <BrandLogo className="h-9 w-9 p-0.5 ring-1 ring-slate-200 dark:ring-slate-700 lg:hidden" />

      <div className="relative hidden min-w-0 flex-1 md:block max-w-md" ref={searchRef}>
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSearchOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search products, customers, invoices…"
          className="input-field !pl-9 !pr-9 !py-2"
          aria-label="Global search"
          aria-autocomplete="list"
          aria-expanded={searchOpen}
        />
        {query ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
            onClick={clearSearch}
          >
            <X size={14} />
          </button>
        ) : null}
        {searchPanel}
      </div>

      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        <div className="relative md:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label={mobileSearch ? 'Close search' : 'Open search'}
            onClick={() => {
              setMobileSearch((v) => !v)
              setSearchOpen(true)
            }}
          >
            {mobileSearch ? <X size={18} /> : <Search size={18} />}
          </button>
        </div>

        {showPageAction ? (
          <Link
            to={pageAction.to}
            state={pageAction.state}
            className="btn-primary mr-1 !px-2.5 !py-2 sm:!px-3.5"
            aria-label={pageAction.label}
            title={pageAction.label}
          >
            <Plus size={16} aria-hidden />
            <span className="hidden sm:inline">{pageAction.label}</span>
          </Link>
        ) : null}

        <button
          type="button"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => {
              setShowNotifs((v) => !v)
              setShowProfile(false)
            }}
            aria-label="Notifications"
          >
            <Bell size={18} />
            <NotificationBadge count={unread} />
          </button>
          {showNotifs ? (
            <NotificationDropdown
              open={showNotifs}
              notifications={recent}
              unreadCount={unread}
              onMarkRead={markNotificationRead}
              onClose={() => setShowNotifs(false)}
            />
          ) : null}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 sm:px-2"
            onClick={() => {
              setShowProfile((v) => !v)
              setShowNotifs(false)
            }}
            aria-label="User menu"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              {(user?.name || 'U').charAt(0)}
            </span>
            <span className="hidden text-left text-sm sm:block">
              <span className="block font-medium text-slate-800 dark:text-slate-100">{user?.name}</span>
              <span className="block text-xs text-slate-500">{user?.role}</span>
            </span>
          </button>
          {showProfile ? (
            <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <Link
                to="/settings"
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => setShowProfile(false)}
              >
                <User size={16} /> Profile
              </Link>
              <Link
                to="/settings"
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => setShowProfile(false)}
              >
                <Settings size={16} /> Settings
              </Link>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => {
                  setShowProfile(false)
                  logout()
                }}
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {mobileSearch ? (
        <div
          className="absolute inset-x-0 top-full border-b border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 md:hidden"
          ref={mobileSearchRef}
        >
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSearchOpen(true)
                setActiveIndex(-1)
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search…"
              className="input-field w-full !pl-9 !pr-9 !py-2"
              aria-label="Global search"
              autoFocus
            />
            {query ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400"
                aria-label="Clear search"
                onClick={clearSearch}
              >
                <X size={14} />
              </button>
            ) : null}
            {searchPanel}
          </div>
        </div>
      ) : null}
    </header>
  )
}
