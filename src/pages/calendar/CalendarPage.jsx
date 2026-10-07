import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import Calendar from '../../components/ui/Calendar'
import { useApp } from '../../contexts/AppContext'

const SECTIONS = {
  rentals: {
    label: 'Rentals Calendar',
    types: ['rental', 'booking', 'return', 'check', 'maintenance', 'reminder', 'vehicle_rental'],
    tabs: [
      { value: 'all', label: 'All events' },
      { value: 'rental', label: 'Rentals' },
      { value: 'booking', label: 'Bookings' },
      { value: 'return', label: 'Returns' },
      { value: 'check', label: 'Checks' },
      { value: 'vehicle_rental', label: 'Vehicle Rentals', permission: 'vehicles.view' },
    ],
    legend: ['rental', 'booking', 'return', 'overdue', 'check', 'vehicle_rental', 'other'],
  },
  sales: {
    label: 'Sales Calendar',
    types: ['sale', 'payment'],
    tabs: [
      { value: 'all', label: 'All events' },
      { value: 'sale', label: 'Sales' },
      { value: 'payment', label: 'Payments due' },
    ],
    legend: ['sale', 'payment', 'overdue'],
  },
}

const tabClass = (active) =>
  `inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? 'border-slate-200 bg-white text-slate-900 shadow-sm dark:border-white/10 dark:bg-slate-800 dark:text-white'
      : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
  }`

const TAB_GROUP_CLASS =
  'inline-flex flex-wrap gap-1 rounded-xl border border-slate-200/70 bg-slate-100/70 p-1 dark:border-white/10 dark:bg-white/5'

export default function CalendarPage() {
  const {
    calendarEvents,
    bookingsLoading,
    rentalsLoading,
    salesLoading,
    checksLoading,
    maintenanceLoading,
    remindersLoading,
    can,
  } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filter, setFilter] = useState('all')

  const availableSections = useMemo(
    () =>
      Object.keys(SECTIONS).filter((key) =>
        key === 'sales' ? can('sales.view') : can('rentals.view') || can('bookings.view') || can('vehicles.view')
      ),
    [can]
  )
  const requestedSection = searchParams.get('section')
  const section = availableSections.includes(requestedSection) ? requestedSection : availableSections[0] || 'rentals'
  const config = SECTIONS[section]
  const tabs = config.tabs.filter((tab) => !tab.permission || can(tab.permission))
  const legend = config.legend?.filter((key) => key !== 'vehicle_rental' || can('vehicles.view'))

  const selectSection = (key) => {
    setFilter('all')
    setSearchParams(key === 'rentals' ? {} : { section: key }, { replace: true })
  }

  const sectionEvents = useMemo(
    () => calendarEvents.filter((e) => config.types.includes(e.type)),
    [calendarEvents, config]
  )

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return sectionEvents
    return sectionEvents.filter((e) => e.type === filter)
  }, [sectionEvents, filter])

  const sectionCounts = useMemo(() => {
    const result = {}
    Object.entries(SECTIONS).forEach(([key, { types }]) => {
      result[key] = calendarEvents.filter((e) => types.includes(e.type)).length
    })
    return result
  }, [calendarEvents])

  const counts = useMemo(() => {
    const result = { all: sectionEvents.length }
    sectionEvents.forEach((e) => {
      result[e.type] = (result[e.type] || 0) + 1
    })
    return result
  }, [sectionEvents])

  const addEventItems = useMemo(
    () =>
      (section === 'sales'
        ? [can('sales.create') && { label: 'New sale', to: '/sales/new' }]
        : [
            can('rentals.create') && { label: 'New rental', to: '/rentals/new' },
            can('bookings.create') && { label: 'New booking', to: '/bookings' },
            can('checks.manage') && { label: 'Schedule check', to: '/checks' },
            can('maintenance.manage') && { label: 'Schedule maintenance', to: '/maintenance' },
          ]
      ).filter(Boolean),
    [can, section]
  )

  const loading =
    section === 'sales'
      ? salesLoading
      : bookingsLoading || rentalsLoading || checksLoading || maintenanceLoading || remindersLoading

  return (
    <div className="rounded-3xl bg-linear-to-br from-brand-50 via-slate-50 to-blue-50 p-4 sm:p-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="page-shell">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Breadcrumbs items={[{ label: 'Calendar' }]} />
            <h1 className="page-title">Calendar</h1>
            {availableSections.length > 1 && (
              <div className="mt-3">
                <div role="tablist" aria-label="Calendar section" className={TAB_GROUP_CLASS}>
                  {availableSections.map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={section === key}
                      onClick={() => selectSection(key)}
                      className={tabClass(section === key)}
                    >
                      {SECTIONS[key].label}
                      <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">{sectionCounts[key] || 0}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3">
              <div role="tablist" aria-label="Filter events" className={TAB_GROUP_CLASS}>
                {tabs.map((tab) => {
                  const active = filter === tab.value
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilter(tab.value)}
                      className={tabClass(active)}
                    >
                      {tab.label}
                      <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">{counts[tab.value] || 0}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <Link to="/calendar/availability" className="btn-secondary">
            Equipment Availability
          </Link>
        </div>

        {loading && <div className="text-sm text-slate-500">Loading calendar events...</div>}

        <Calendar events={filteredEvents} addEventItems={addEventItems} legend={legend} />
      </div>
    </div>
  )
}
