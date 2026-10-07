import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCheck, Save, Table2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import EmptyState from '../../components/ui/EmptyState'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import staffService from '../../services/staffService'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'
import { formatDate } from '../../utils/helpers'
import { todayISO } from '../../utils/vehicleHelpers'
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_SHORT,
  ATTENDANCE_STATUSES,
  ATTENDANCE_TONES,
  currentMonth,
  isWorkingStatus,
} from '../../utils/staffHelpers'

const entryFromRow = (row) => ({
  status: row.attendance?.status || '',
  checkIn: row.attendance?.checkIn || '',
  checkOut: row.attendance?.checkOut || '',
  notes: row.attendance?.notes || '',
})

function DailySheet({ canMark }) {
  const { success, error: toastError } = useToast()
  const [date, setDate] = useState(todayISO())
  const [rows, setRows] = useState([])
  const [entries, setEntries] = useState({})
  const [rowErrors, setRowErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const load = useCallback(async () => {
    if (!date) return
    setLoading(true)
    setLoadError(null)
    try {
      const result = await staffService.getAttendance(date)
      setRows(result.rows)
      setEntries(Object.fromEntries(result.rows.map((r) => [r.staffId, entryFromRow(r)])))
      setRowErrors({})
      setDirty(false)
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Unable to load attendance.'))
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    load()
  }, [load])

  const update = (staffId, patch) => {
    setEntries((prev) => {
      const next = { ...prev[staffId], ...patch }
      if (!isWorkingStatus(next.status)) {
        next.checkIn = ''
        next.checkOut = ''
      }
      return { ...prev, [staffId]: next }
    })
    setRowErrors((prev) => (prev[staffId] ? { ...prev, [staffId]: undefined } : prev))
    setDirty(true)
  }

  const markAllPresent = () => {
    setEntries((prev) => {
      const next = { ...prev }
      rows.forEach((r) => {
        if (r.staffStatus !== 'Active') return
        next[r.staffId] = { ...next[r.staffId], status: 'present' }
      })
      return next
    })
    setRowErrors({})
    setDirty(true)
  }

  const counts = useMemo(() => {
    const c = { marked: 0 }
    ATTENDANCE_STATUSES.forEach((s) => { c[s] = 0 })
    Object.values(entries).forEach((e) => {
      if (!e.status) return
      c.marked += 1
      c[e.status] += 1
    })
    return c
  }, [entries])

  const handleSave = async () => {
    const records = rows
      .map((r) => ({ staffId: r.staffId, ...entries[r.staffId] }))
      .filter((r) => r.status)
    if (!records.length) {
      toastError('Choose a status for at least one staff member before saving.')
      return
    }

    const localErrors = {}
    records.forEach((r) => {
      if (r.checkIn && r.checkOut && r.checkOut <= r.checkIn) localErrors[r.staffId] = 'Check-out must be after check-in.'
    })
    if (Object.keys(localErrors).length) {
      setRowErrors(localErrors)
      toastError('Please fix the highlighted rows.')
      return
    }

    setSaving(true)
    try {
      const { message } = await staffService.saveAttendance(date, records)
      success(message)
      await load()
    } catch (error) {
      const fieldErrors = getApiValidationErrors(error)
      const mapped = {}
      Object.entries(fieldErrors).forEach(([key, msg]) => {
        const match = key.match(/^records\.(\d+)\./)
        if (match && records[Number(match[1])]) mapped[records[Number(match[1])].staffId] = msg
      })
      setRowErrors(mapped)
      toastError(fieldErrors.date || getApiErrorMessage(error, 'Unable to save attendance.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="sm:w-56">
            <label className="label" htmlFor="attendance-date">Date</label>
            <input
              id="attendance-date"
              type="date"
              className="input-field"
              value={date}
              max={todayISO()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </div>
          {canMark && rows.length > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" className="btn-secondary justify-center" onClick={markAllPresent} disabled={saving}>
                <CheckCheck size={16} />
                Mark all present
              </button>
              <button type="button" className="btn-primary justify-center" onClick={handleSave} disabled={saving || !dirty}>
                <Save size={16} />
                {saving ? 'Saving…' : 'Save Attendance'}
              </button>
            </div>
          )}
        </div>
        {rows.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {counts.marked} of {rows.length} marked
            </span>
            {ATTENDANCE_STATUSES.filter((s) => counts[s] > 0).map((s) => (
              <span key={s} className={`rounded-full px-2 py-0.5 font-medium ${ATTENDANCE_TONES[s]}`}>
                {ATTENDANCE_LABELS[s]}: {counts[s]}
              </span>
            ))}
          </div>
        )}
      </div>

      {loading && rows.length === 0 ? (
        <div className="card"><LoadingState label="Loading attendance..." /></div>
      ) : loadError ? (
        <div className="card"><ApiErrorState title="Unable to load attendance" message={loadError} onRetry={load} /></div>
      ) : rows.length === 0 ? (
        <div className="card p-4">
          <EmptyState title="No active staff." description="Add staff members to start marking attendance." />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-12 md:gap-3 dark:border-slate-800 dark:bg-slate-900/40">
            <span className="col-span-3">Staff</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-2">Check-in</span>
            <span className="col-span-2">Check-out</span>
            <span className="col-span-3">Notes</span>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => {
              const entry = entries[r.staffId] || entryFromRow(r)
              const timesDisabled = !canMark || !entry.status || !isWorkingStatus(entry.status)
              return (
                <li key={r.staffId} className="grid gap-3 px-4 py-3 md:grid-cols-12 md:items-center">
                  <div className="md:col-span-3">
                    <Link to={`/staff/${r.staffId}`} className="font-medium text-slate-900 hover:text-brand-600 dark:text-white">
                      {r.fullName}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {r.staffCode}{r.roleName ? ` · ${r.roleName}` : ''}{r.staffStatus !== 'Active' ? ' · Inactive' : ''}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:col-span-6 md:grid-cols-3">
                    <div className="col-span-2 md:col-span-1">
                      <label className="label md:sr-only" htmlFor={`status-${r.staffId}`}>Status</label>
                      <select
                        id={`status-${r.staffId}`}
                        className="input-field"
                        value={entry.status}
                        disabled={!canMark}
                        onChange={(e) => update(r.staffId, { status: e.target.value })}
                      >
                        <option value="">Not marked</option>
                        {ATTENDANCE_STATUSES.map((s) => (
                          <option key={s} value={s}>{ATTENDANCE_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label md:sr-only" htmlFor={`in-${r.staffId}`}>Check-in</label>
                      <input
                        id={`in-${r.staffId}`}
                        type="time"
                        className="input-field"
                        value={entry.checkIn}
                        disabled={timesDisabled}
                        onChange={(e) => update(r.staffId, { checkIn: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label md:sr-only" htmlFor={`out-${r.staffId}`}>Check-out</label>
                      <input
                        id={`out-${r.staffId}`}
                        type="time"
                        className="input-field"
                        value={entry.checkOut}
                        disabled={timesDisabled}
                        onChange={(e) => update(r.staffId, { checkOut: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    <label className="label md:sr-only" htmlFor={`notes-${r.staffId}`}>Notes</label>
                    <input
                      id={`notes-${r.staffId}`}
                      className="input-field"
                      value={entry.notes}
                      maxLength={500}
                      disabled={!canMark}
                      placeholder="Optional"
                      onChange={(e) => update(r.staffId, { notes: e.target.value })}
                    />
                  </div>
                  {rowErrors[r.staffId] && <p className="text-xs text-red-600 md:col-span-12">{rowErrors[r.staffId]}</p>}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function MonthlyView() {
  const [month, setMonth] = useState(currentMonth())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async () => {
    if (!month) return
    setLoading(true)
    setLoadError(null)
    try {
      setData(await staffService.getMonthlySummary(month))
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Unable to load the monthly summary.'))
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => {
    load()
  }, [load])

  const days = useMemo(() => Array.from({ length: data?.daysInMonth || 0 }, (_, i) => i + 1), [data])
  const dayKey = (d) => `${data.month}-${String(d).padStart(2, '0')}`

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="sm:w-56">
            <label className="label" htmlFor="attendance-month">Month</label>
            <input
              id="attendance-month"
              type="month"
              className="input-field"
              value={month}
              max={currentMonth()}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {ATTENDANCE_STATUSES.map((s) => (
              <span key={s} className={`rounded-full px-2 py-0.5 font-medium ${ATTENDANCE_TONES[s]}`}>
                {ATTENDANCE_SHORT[s]} = {ATTENDANCE_LABELS[s]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="card"><LoadingState label="Loading monthly summary..." /></div>
      ) : loadError ? (
        <div className="card"><ApiErrorState title="Unable to load monthly summary" message={loadError} onRetry={load} /></div>
      ) : !data?.rows.length ? (
        <div className="card p-4">
          <EmptyState title="No attendance for this month." description="Mark attendance on the Daily tab to see the monthly summary." />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/40">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2 text-left font-semibold dark:bg-slate-900">Staff</th>
                  <th className="px-2 py-2 text-center font-semibold">P</th>
                  <th className="px-2 py-2 text-center font-semibold">L</th>
                  <th className="px-2 py-2 text-center font-semibold">H</th>
                  <th className="px-2 py-2 text-center font-semibold">A</th>
                  <th className="px-2 py-2 text-center font-semibold">Lv</th>
                  {days.map((d) => (
                    <th key={d} className="px-1 py-2 text-center font-medium" title={formatDate(dayKey(d))}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.rows.map((r) => (
                  <tr key={r.staffId}>
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-2 dark:bg-slate-900">
                      <Link to={`/staff/${r.staffId}`} className="font-medium text-slate-900 hover:text-brand-600 dark:text-white">{r.fullName}</Link>
                      <span className="block text-xs text-slate-500">{r.roleName || r.staffCode}</span>
                    </td>
                    <td className="px-2 py-2 text-center font-medium text-emerald-600">{r.present}</td>
                    <td className="px-2 py-2 text-center font-medium text-amber-600">{r.late}</td>
                    <td className="px-2 py-2 text-center font-medium text-violet-600">{r.halfDay}</td>
                    <td className="px-2 py-2 text-center font-medium text-red-600">{r.absent}</td>
                    <td className="px-2 py-2 text-center font-medium text-blue-600">{r.leave}</td>
                    {days.map((d) => {
                      const status = r.days[dayKey(d)]
                      return (
                        <td key={d} className="px-0.5 py-2 text-center">
                          {status ? (
                            <span
                              className={`inline-flex h-6 min-w-6 items-center justify-center rounded px-1 text-[11px] font-semibold ${ATTENDANCE_TONES[status] || ''}`}
                              title={`${formatDate(dayKey(d))}: ${ATTENDANCE_LABELS[status] || status}`}
                            >
                              {ATTENDANCE_SHORT[status] || '?'}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Attendance() {
  const { can } = useApp()
  const [tab, setTab] = useState('daily')
  const canMark = can('staff.attendance')

  const tabClass = (key) =>
    `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
      tab === key
        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
    }`

  return (
    <div className="page-shell">
      <PageHeader
        title="Attendance"
        subtitle={canMark ? 'Mark daily attendance and review monthly totals' : 'Daily attendance and monthly totals'}
        breadcrumbs={[{ label: 'Staff', to: '/staff' }, { label: 'Attendance' }]}
      />

      <div className="inline-flex w-full rounded-xl bg-slate-100 p-1 sm:w-auto dark:bg-slate-800" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'daily'} className={`${tabClass('daily')} flex-1 justify-center sm:flex-none`} onClick={() => setTab('daily')}>
          <CalendarDays size={16} />
          Daily
        </button>
        <button type="button" role="tab" aria-selected={tab === 'monthly'} className={`${tabClass('monthly')} flex-1 justify-center sm:flex-none`} onClick={() => setTab('monthly')}>
          <Table2 size={16} />
          Monthly
        </button>
      </div>

      {tab === 'daily' ? <DailySheet canMark={canMark} /> : <MonthlyView />}
    </div>
  )
}
