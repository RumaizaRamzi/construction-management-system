import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns'
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react'
import Modal from './Modal'
import { useApp } from '../../contexts/AppContext'
import { getSriLankaHolidays } from '../../utils/sriLankaHolidays'

export const CALENDAR_TYPE_LABELS = {
  return: 'Return',
  booking: 'Booking',
  rental: 'Rental',
  sale: 'Sale',
  payment: 'Payment',
  check: 'Check',
  maintenance: 'Maintenance',
  reminder: 'Reminder',
  vehicle_rental: 'Vehicle Rental',
}

const VIEWS = [
  { id: 'month', label: 'Month view' },
  { id: 'week', label: 'Week view' },
  { id: 'day', label: 'Day view' },
  { id: 'agenda', label: 'Agenda' },
]

const WEEK_OPTIONS = { weekStartsOn: 1 }
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_PILLS = 3
const MAX_DOTS = 4
const HOURS = Array.from({ length: 24 }, (_, i) => i)

const EVENT_STYLES = {
  rental: {
    label: 'Rental',
    pill: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30',
    dot: 'bg-violet-500',
  },
  booking: {
    label: 'Booking',
    pill: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
    dot: 'bg-blue-500',
  },
  return: {
    label: 'Return',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  overdue: {
    label: 'Overdue',
    pill: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
    dot: 'bg-red-500',
  },
  check: {
    label: 'Check',
    pill: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    dot: 'bg-amber-500',
  },
  sale: {
    label: 'Sale',
    pill: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30',
    dot: 'bg-teal-500',
  },
  payment: {
    label: 'Payment Due',
    pill: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30',
    dot: 'bg-orange-500',
  },
  vehicle_rental: {
    label: 'Vehicle Rental',
    pill: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30',
    dot: 'bg-sky-500',
  },
  other: {
    label: 'Maintenance / Other',
    pill: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30',
    dot: 'bg-slate-400',
  },
}

const LEGEND = ['rental', 'booking', 'return', 'overdue', 'check', 'other']

const HOLIDAY_STYLES = {
  poya: {
    label: 'Poya day',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-400 ring-1 ring-amber-500/40',
    cell: 'bg-amber-50/60 dark:bg-amber-500/[0.06]',
    banner: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  },
  public: {
    label: 'Public holiday',
    text: 'text-rose-600 dark:text-rose-300',
    dot: 'bg-rose-500',
    cell: 'bg-rose-50/50 dark:bg-rose-500/[0.06]',
    banner: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
  },
}

const holidayStyle = (holidays) => HOLIDAY_STYLES[holidays.some((h) => h.kind === 'poya') ? 'poya' : 'public']

const GRID_LINE = 'border-slate-200/70 dark:border-white/10'

const eventStyle = (event) => {
  if (event.status === 'Overdue') return EVENT_STYLES.overdue
  return EVENT_STYLES[event.type] || EVENT_STYLES.other
}

const toDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return value
  const raw = String(value)
  // Support date-only and datetime strings without timezone surprises.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return parseISO(`${raw}T00:00:00`)
  return parseISO(raw)
}

const eventHasTime = (event) => {
  const raw = String(event.startTime || event.time || event.date || '')
  return /T\d{2}:\d{2}/.test(raw) || Boolean(event.startTime || event.time)
}

const eventHour = (event) => {
  if (event.startTime) {
    const [h] = String(event.startTime).split(':')
    return Number(h) || 0
  }
  const d = toDate(event.date)
  if (!d) return 0
  return eventHasTime(event) ? d.getHours() : 0
}

const eventTimeLabel = (event) => {
  const raw = event.startTime || event.time
  if (raw) {
    const [h, m = '00'] = String(raw).split(':')
    const d = new Date()
    d.setHours(Number(h) || 0, Number(m) || 0, 0, 0)
    return format(d, 'h:mm a')
  }
  const d = toDate(event.date)
  if (!d || !/T\d{2}:\d{2}/.test(String(event.date))) return null
  if (d.getHours() === 0 && d.getMinutes() === 0) return null
  return format(d, 'h:mm a')
}

const eventsForDay = (events, day) =>
  events.filter((e) => {
    const start = toDate(e.date)
    if (!start) return false
    if (isSameDay(start, day)) return true
    if (e.endDate) {
      const end = toDate(e.endDate)
      if (end && !isBefore(end, startOfDay(day)) && !isBefore(endOfDay(day), start)) {
        // Multi-day: show on each day in range
        return !isBefore(day, startOfDay(start)) && !isBefore(endOfDay(end), day)
      }
    }
    return false
  })

const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

function EventPill({ event, onClick, size = 'sm' }) {
  const style = eventStyle(event)
  const time = eventTimeLabel(event)
  const fullText = `${style.label === 'Overdue' ? 'Overdue' : CALENDAR_TYPE_LABELS[event.type] || style.label}: ${event.title}${
    time ? ` · ${time}` : ''
  }`
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(event)
      }}
      className={`flex w-full min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-left font-medium transition hover:brightness-95 dark:hover:brightness-125 ${
        size === 'md' ? 'text-xs leading-5' : 'text-[11px] leading-4'
      } ${style.pill}`}
      title={fullText}
    >
      <span className="min-w-0 flex-1 truncate">{event.title}</span>
      {time ? <span className="shrink-0 font-normal opacity-70">{time}</span> : null}
    </button>
  )
}

function HolidayLabels({ holidays, className = '' }) {
  if (!holidays.length) return null
  return (
    <div className={`min-w-0 space-y-0.5 ${className}`}>
      {holidays.map((h) => (
        <p
          key={h.name}
          title={h.name}
          className={`flex min-w-0 items-center gap-1 text-[11px] font-medium leading-4 ${HOLIDAY_STYLES[h.kind].text}`}
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${HOLIDAY_STYLES[h.kind].dot}`} aria-hidden />
          <span className="truncate">{h.name}</span>
        </p>
      ))}
    </div>
  )
}

function HolidayBanner({ holidays }) {
  if (!holidays.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {holidays.map((h) => (
        <span
          key={h.name}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${HOLIDAY_STYLES[h.kind].banner}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${HOLIDAY_STYLES[h.kind].dot}`} aria-hidden />
          {h.name}
        </span>
      ))}
    </div>
  )
}

function EventList({ events, onSelectEvent, emptyText = 'No events on this day.' }) {
  if (!events.length) {
    return <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>
  }
  return (
    <ul className="space-y-1.5">
      {events.map((event) => (
        <li key={event.id}>
          <EventPill event={event} onClick={onSelectEvent} size="md" />
        </li>
      ))}
    </ul>
  )
}

function EventDetailsModal({ selected, onClose, onOpen }) {
  if (!selected) return null
  return (
    <Modal open={!!selected} onClose={onClose} title="Event Details" size="sm">
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-slate-500">Title</p>
          <p className="font-medium text-slate-900 dark:text-white">{selected.title}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-slate-500">Type</p>
            <p className="font-medium text-slate-900 dark:text-white">
              {CALENDAR_TYPE_LABELS[selected.type] || selected.type}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Status</p>
            <p className="font-medium text-slate-900 dark:text-white">{selected.status || '—'}</p>
          </div>
        </div>
        <div>
          <p className="text-slate-500">Date</p>
          <p className="font-medium text-slate-900 dark:text-white">
            {format(toDate(selected.date) || new Date(), 'PPP')}
            {selected.endDate ? ` → ${format(toDate(selected.endDate), 'PPP')}` : ''}
          </p>
        </div>
        {selected.customer ? (
          <div>
            <p className="text-slate-500">Customer / Assignee</p>
            <p className="font-medium text-slate-900 dark:text-white">{selected.customer}</p>
          </div>
        ) : null}
        {selected.product ? (
          <div>
            <p className="text-slate-500">Product</p>
            <p className="font-medium text-slate-900 dark:text-white">{selected.product}</p>
          </div>
        ) : null}
        {selected.notes ? (
          <div>
            <p className="text-slate-500">Notes</p>
            <p className="text-slate-700 dark:text-slate-300">{selected.notes}</p>
          </div>
        ) : null}
        {selected.refPath ? (
          <button type="button" className="btn-primary w-full" onClick={() => onOpen(selected)}>
            Open related record
          </button>
        ) : null}
      </div>
    </Modal>
  )
}

function MonthView({ cursor, events, holidaysFor, selectedDay, onDayClick, onSelectEvent, onShowMore }) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), WEEK_OPTIONS)
    const end = endOfWeek(endOfMonth(cursor), WEEK_OPTIONS)
    return eachDayOfInterval({ start, end })
  }, [cursor])

  const selectedEvents = useMemo(
    () => (selectedDay ? eventsForDay(events, selectedDay) : []),
    [events, selectedDay]
  )

  return (
    <>
      <div className={`grid grid-cols-7 border-b ${GRID_LINE}`}>
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2.5 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = eventsForDay(events, day)
          const dayHolidays = holidaysFor(day)
          const inMonth = isSameMonth(day, cursor)
          const today = isToday(day)
          const selected = selectedDay && isSameDay(day, selectedDay)
          const hidden = dayEvents.length - MAX_PILLS
          return (
            <div
              role="button"
              tabIndex={0}
              aria-label={`${format(day, 'PPPP')}${dayHolidays.map((h) => `, ${h.name}`).join('')}, ${dayEvents.length} event${
                dayEvents.length === 1 ? '' : 's'
              }`}
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onDayClick(day)
                }
              }}
              className={`min-h-[72px] min-w-0 cursor-pointer border-b border-r p-1.5 text-left transition-colors [&:nth-child(7n)]:border-r-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 lg:min-h-[110px] lg:p-2 ${GRID_LINE} ${
                inMonth
                  ? 'hover:bg-slate-50/80 dark:hover:bg-white/5'
                  : 'bg-slate-50/70 hover:bg-slate-100/70 dark:bg-slate-950/40 dark:hover:bg-white/5'
              } ${dayHolidays.length && inMonth && !selected ? holidayStyle(dayHolidays).cell : ''} ${
                selected ? 'max-lg:bg-brand-50/70 max-lg:dark:bg-brand-500/10' : ''
              }`}
            >
              <span className="flex items-center gap-1">
                <span
                  className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium tabular-nums ${
                    today
                      ? 'bg-slate-900 text-white dark:bg-brand-500 dark:text-slate-950'
                      : inMonth
                        ? dayHolidays.length
                          ? `font-semibold ${holidayStyle(dayHolidays).text}`
                          : 'text-slate-700 dark:text-slate-200'
                        : 'text-slate-400 dark:text-slate-600'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                {dayHolidays.length > 0 && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full lg:hidden ${holidayStyle(dayHolidays).dot} ${inMonth ? '' : 'opacity-50'}`}
                    aria-hidden
                  />
                )}
              </span>

              <HolidayLabels holidays={dayHolidays} className={`mt-1 hidden lg:block ${inMonth ? '' : 'opacity-60'}`} />

              <div className="mt-1 hidden space-y-1 lg:block">
                {dayEvents.slice(0, MAX_PILLS).map((event) => (
                  <EventPill key={event.id} event={event} onClick={onSelectEvent} />
                ))}
                {hidden > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onShowMore(day)
                    }}
                    className="px-1.5 text-[11px] font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
                  >
                    +{hidden} more...
                  </button>
                )}
              </div>

              {dayEvents.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-0.5 lg:hidden" aria-hidden>
                  {dayEvents.slice(0, MAX_DOTS).map((event) => (
                    <span key={event.id} className={`h-1.5 w-1.5 rounded-full ${eventStyle(event).dot}`} />
                  ))}
                  {dayEvents.length > MAX_DOTS && (
                    <span className="text-[9px] leading-none text-slate-400">+{dayEvents.length - MAX_DOTS}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {selectedDay && (
        <div className={`border-t px-4 py-4 lg:hidden ${GRID_LINE}`}>
          <h4 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {format(selectedDay, 'EEEE, MMM d')}
          </h4>
          {holidaysFor(selectedDay).length > 0 && (
            <div className="mb-3">
              <HolidayBanner holidays={holidaysFor(selectedDay)} />
            </div>
          )}
          <EventList events={selectedEvents} onSelectEvent={onSelectEvent} />
        </div>
      )}
    </>
  )
}

function WeekView({ cursor, events, holidaysFor, onSelectEvent }) {
  const weekDays = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(cursor, WEEK_OPTIONS), end: endOfWeek(cursor, WEEK_OPTIONS) }),
    [cursor]
  )

  return (
    <>
      <div className={`grid grid-cols-7 border-b ${GRID_LINE}`}>
        {weekDays.map((day) => (
          <div key={day.toISOString()} className="px-1 py-2.5 text-center">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{format(day, 'EEE')}</p>
            <p
              className={`mx-auto mt-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm font-semibold tabular-nums ${
                isToday(day)
                  ? 'bg-slate-900 text-white dark:bg-brand-500 dark:text-slate-950'
                  : 'text-slate-800 dark:text-slate-100'
              }`}
            >
              {format(day, 'd')}
            </p>
            <HolidayLabels holidays={holidaysFor(day)} className="mt-1 hidden text-left lg:block" />
            {holidaysFor(day).length > 0 && (
              <span
                className={`mx-auto mt-1 block h-1.5 w-1.5 rounded-full lg:hidden ${holidayStyle(holidaysFor(day)).dot}`}
                title={holidaysFor(day).map((h) => h.name).join(', ')}
              />
            )}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weekDays.map((day) => {
          const dayEvents = eventsForDay(events, day)
          const timed = dayEvents.filter(eventHasTime)
          const allDay = dayEvents.filter((e) => !eventHasTime(e))
          const dayHolidays = holidaysFor(day)
          return (
            <div
              key={day.toISOString()}
              className={`min-h-[320px] min-w-0 border-r p-1.5 [&:nth-child(7n)]:border-r-0 lg:p-2 ${GRID_LINE} ${
                isToday(day) ? 'bg-brand-50/40 dark:bg-brand-500/5' : dayHolidays.length ? holidayStyle(dayHolidays).cell : ''
              }`}
            >
              {allDay.length > 0 && (
                <div className={`mb-2 space-y-1 border-b border-dashed pb-2 ${GRID_LINE}`}>
                  {allDay.map((event) => (
                    <EventPill key={event.id} event={event} onClick={onSelectEvent} />
                  ))}
                </div>
              )}
              <div className="space-y-1">
                {timed.length === 0 && allDay.length === 0 ? (
                  <p className="text-[11px] text-slate-400">No events</p>
                ) : (
                  timed.map((event) => <EventPill key={event.id} event={event} onClick={onSelectEvent} />)
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function DayView({ cursor, events, holidaysFor, onSelectEvent }) {
  const dayEvents = eventsForDay(events, cursor)
  const allDay = dayEvents.filter((e) => !eventHasTime(e))
  const timed = dayEvents.filter(eventHasTime)
  const dayHolidays = holidaysFor(cursor)

  return (
    <div>
      {dayHolidays.length > 0 && (
        <div className={`border-b px-4 py-3 ${GRID_LINE}`}>
          <HolidayBanner holidays={dayHolidays} />
        </div>
      )}
      {allDay.length > 0 && (
        <div className={`border-b px-4 py-3 ${GRID_LINE}`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">All day</p>
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {allDay.map((event) => (
              <EventPill key={event.id} event={event} onClick={onSelectEvent} size="md" />
            ))}
          </div>
        </div>
      )}
      <div className="divide-y divide-slate-200/70 dark:divide-white/10">
        {HOURS.map((hour) => {
          const slotEvents = timed.filter((e) => eventHour(e) === hour)
          return (
            <div key={hour} className="grid min-h-12 grid-cols-[56px_1fr]">
              <div className="px-2 py-2 text-right text-xs text-slate-400">
                {format(new Date().setHours(hour, 0, 0, 0), 'ha')}
              </div>
              <div className={`min-w-0 space-y-1 border-l px-3 py-2 ${GRID_LINE}`}>
                {slotEvents.map((event) => (
                  <EventPill key={event.id} event={event} onClick={onSelectEvent} size="md" />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {dayEvents.length === 0 && (
        <p className="px-4 py-10 text-center text-sm text-slate-500">No events on this day.</p>
      )}
    </div>
  )
}

function AgendaView({ events, onSelectEvent }) {
  const groups = useMemo(() => {
    const today = startOfDay(new Date())
    const map = new Map()
    ;[...events]
      .filter((e) => {
        const d = toDate(e.date)
        return d && !isBefore(endOfDay(d), today)
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .forEach((event) => {
        const key = format(toDate(event.date), 'yyyy-MM-dd')
        if (!map.has(key)) map.set(key, [])
        map.get(key).push(event)
      })
    return Array.from(map.entries())
  }, [events])

  if (groups.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No upcoming events</p>
        <p className="mt-1 text-xs text-slate-500">Scheduled bookings, rentals, checks, and reminders will appear here.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-slate-200/70 dark:divide-white/10">
      {groups.map(([dateKey, items]) => (
        <div key={dateKey} className="px-5 py-4">
          <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {format(parseISO(`${dateKey}T00:00:00`), 'EEEE, MMM d, yyyy')}
          </h4>
          <EventList events={items} onSelectEvent={onSelectEvent} />
        </div>
      ))}
    </div>
  )
}

function AddEventButton({ items }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!items.length) return null

  if (items.length === 1) {
    return (
      <button type="button" className="btn-primary !py-2" onClick={() => navigate(items[0].to)}>
        <Plus size={16} aria-hidden />
        Add event
      </button>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="btn-primary !py-2"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus size={16} aria-hidden />
        Add event
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1.5 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {items.map((item) => (
            <button
              key={item.to + item.label}
              type="button"
              role="menuitem"
              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => {
                setOpen(false)
                navigate(item.to)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Calendar({ events = [], initialView = 'month', addEventItems = [], legend = LEGEND }) {
  const navigate = useNavigate()
  const { settings } = useApp()
  const holidayOverrides = settings?.holidayOverrides
  const [cursor, setCursor] = useState(new Date())
  const [view, setView] = useState(initialView)
  const [selected, setSelected] = useState(null)
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [moreDay, setMoreDay] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')

  const visibleEvents = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return events
    return events.filter((e) =>
      [e.title, e.customer, e.product, e.status].some((v) => v && String(v).toLowerCase().includes(q))
    )
  }, [events, search])

  const { title, range } = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(cursor, WEEK_OPTIONS)
      const end = endOfWeek(cursor, WEEK_OPTIONS)
      return { title: format(start, 'MMMM yyyy'), range: `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}` }
    }
    if (view === 'day') return { title: format(cursor, 'MMMM yyyy'), range: format(cursor, 'EEEE, MMM d, yyyy') }
    if (view === 'agenda') return { title: 'Upcoming agenda', range: 'All upcoming events' }
    return {
      title: format(cursor, 'MMMM yyyy'),
      range: `${format(startOfMonth(cursor), 'MMM d, yyyy')} – ${format(endOfMonth(cursor), 'MMM d, yyyy')}`,
    }
  }, [cursor, view])

  const moreEvents = useMemo(() => (moreDay ? eventsForDay(visibleEvents, moreDay) : []), [visibleEvents, moreDay])

  const cursorYear = cursor.getFullYear()
  const holidaysByDate = useMemo(() => {
    const overrides = Array.isArray(holidayOverrides) ? holidayOverrides : []
    const map = new Map()
    for (const year of [cursorYear - 1, cursorYear, cursorYear + 1]) {
      getSriLankaHolidays(year, overrides).forEach((h) => {
        if (!map.has(h.date)) map.set(h.date, [])
        map.get(h.date).push(h)
      })
    }
    return map
  }, [cursorYear, holidayOverrides])
  const holidaysFor = (day) => holidaysByDate.get(format(day, 'yyyy-MM-dd')) || []

  const goPrev = () => {
    if (view === 'month') setCursor((d) => subMonths(d, 1))
    else if (view === 'week') setCursor((d) => subWeeks(d, 1))
    else if (view === 'day') setCursor((d) => subDays(d, 1))
  }

  const goNext = () => {
    if (view === 'month') setCursor((d) => addMonths(d, 1))
    else if (view === 'week') setCursor((d) => addWeeks(d, 1))
    else if (view === 'day') setCursor((d) => addDays(d, 1))
  }

  const goToday = () => {
    setCursor(new Date())
    setSelectedDay(new Date())
  }

  const handleDayClick = (day) => {
    if (isDesktop()) {
      setCursor(day)
      setView('day')
    } else {
      setSelectedDay(day)
    }
  }

  const openEvent = (event) => {
    setSelected(null)
    if (event?.refPath) navigate(event.refPath)
  }

  const now = new Date()
  const toolbarButton =
    'inline-flex h-9 items-center justify-center text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5'

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70">
        <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 ${GRID_LINE}`}>
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex w-12 shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-center dark:border-white/10 dark:bg-slate-900/60"
              aria-label={`Today is ${format(now, 'PPP')}`}
            >
              <span className="bg-slate-50 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400">
                {format(now, 'MMM')}
              </span>
              <span className="py-1 font-display text-lg font-bold leading-none text-slate-900 dark:text-white">
                {format(now, 'd')}
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-display text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{range}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {searchOpen ? (
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  autoFocus
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setSearch('')
                      setSearchOpen(false)
                    }
                  }}
                  placeholder="Search events..."
                  aria-label="Search events"
                  className="h-9 w-44 rounded-lg border border-slate-200 bg-white pl-8 pr-8 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setSearchOpen(false)
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Close search"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
                aria-label="Search events"
                title="Search events"
              >
                <Search size={17} />
              </button>
            )}

            {view !== 'agenda' && (
              <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                <button type="button" className={`${toolbarButton} w-9`} onClick={goPrev} aria-label="Previous">
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  className={`${toolbarButton} border-x border-slate-200 px-3 dark:border-white/10`}
                  onClick={goToday}
                >
                  Today
                </button>
                <button type="button" className={`${toolbarButton} w-9`} onClick={goNext} aria-label="Next">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            <div className="relative">
              <select
                value={view}
                onChange={(e) => setView(e.target.value)}
                aria-label="Calendar view"
                className="h-9 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm font-medium text-slate-700 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
              >
                {VIEWS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            </div>

            <AddEventButton items={addEventItems} />
          </div>
        </div>

        {view === 'month' && (
          <MonthView
            cursor={cursor}
            events={visibleEvents}
            holidaysFor={holidaysFor}
            selectedDay={selectedDay}
            onDayClick={handleDayClick}
            onSelectEvent={setSelected}
            onShowMore={setMoreDay}
          />
        )}
        {view === 'week' && (
          <WeekView cursor={cursor} events={visibleEvents} holidaysFor={holidaysFor} onSelectEvent={setSelected} />
        )}
        {view === 'day' && (
          <DayView cursor={cursor} events={visibleEvents} holidaysFor={holidaysFor} onSelectEvent={setSelected} />
        )}
        {view === 'agenda' && <AgendaView events={visibleEvents} onSelectEvent={setSelected} />}

        <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-5 py-3 ${GRID_LINE}`}>
          {legend.map((key) => (
            <span key={key} className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className={`h-2 w-2 rounded-full ${EVENT_STYLES[key].dot}`} aria-hidden />
              {EVENT_STYLES[key].label}
            </span>
          ))}
          {Object.entries(HOLIDAY_STYLES).map(([key, style]) => (
            <span key={key} className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden />
              {style.label}
            </span>
          ))}
          {search.trim() && (
            <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
              {visibleEvents.length} of {events.length} events match “{search.trim()}”
            </span>
          )}
        </div>
      </div>

      <Modal
        open={!!moreDay}
        onClose={() => setMoreDay(null)}
        title={moreDay ? format(moreDay, 'EEEE, MMM d, yyyy') : ''}
        size="sm"
      >
        <EventList
          events={moreEvents}
          onSelectEvent={(event) => {
            setMoreDay(null)
            setSelected(event)
          }}
        />
      </Modal>

      <EventDetailsModal selected={selected} onClose={() => setSelected(null)} onOpen={openEvent} />
    </>
  )
}
