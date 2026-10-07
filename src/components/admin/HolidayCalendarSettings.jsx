import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage } from '../../services/api'
import { calculateSriLankaHolidays } from '../../utils/sriLankaHolidays'

const KIND_BADGE = {
  poya: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  public: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
}

const sameOverride = (a, b) => a.action === b.action && a.date === b.date && a.name === b.name
const prettyDate = (key) => format(parseISO(`${key}T00:00:00`), 'EEE, d MMM yyyy')

/** Admin corrections for the automatically calculated Sri Lankan Poya days and public holidays. */
export default function HolidayCalendarSettings() {
  const { settings, settingsLoading, updateSettings } = useApp()
  const { success, error: toastError } = useToast()
  const saved = useMemo(() => (Array.isArray(settings.holidayOverrides) ? settings.holidayOverrides : []), [settings.holidayOverrides])
  const [draft, setDraft] = useState(saved)
  const [year, setYear] = useState(new Date().getFullYear())
  const [editing, setEditing] = useState(null)
  const [editDate, setEditDate] = useState('')
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '', kind: 'public' })
  const [saving, setSaving] = useState(false)

  useEffect(() => setDraft(saved), [saved])

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  const rows = useMemo(() => {
    const removed = draft.filter((o) => o.action === 'remove')
    const auto = calculateSriLankaHolidays(year).map((h) => ({
      ...h,
      removed: removed.some((o) => o.date === h.date && o.name === h.name),
    }))
    const custom = draft
      .filter((o) => o.action === 'add' && o.date.startsWith(`${year}-`))
      .map((o) => ({ date: o.date, name: o.name, kind: o.kind === 'poya' ? 'poya' : 'public', source: 'custom', removed: false }))
    return [...auto, ...custom].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
  }, [draft, year])

  const rowKey = (row) => `${row.source}|${row.date}|${row.name}`

  const removeRow = (row) => {
    if (row.source === 'custom') {
      setDraft((prev) => prev.filter((o) => !sameOverride(o, { action: 'add', date: row.date, name: row.name })))
    } else {
      setDraft((prev) => [...prev, { action: 'remove', date: row.date, name: row.name, kind: row.kind }])
    }
  }

  const restoreRow = (row) => {
    setDraft((prev) =>
      prev.filter(
        (o) =>
          !sameOverride(o, { action: 'remove', date: row.date, name: row.name }) &&
          !(o.action === 'add' && o.name === row.name && o.date.startsWith(`${year}-`))
      )
    )
  }

  const startEdit = (row) => {
    setEditing(rowKey(row))
    setEditDate(row.date)
  }

  const applyEdit = (row) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editDate) || editDate === row.date) {
      setEditing(null)
      return
    }
    setDraft((prev) => {
      const next = row.source === 'custom'
        ? prev.filter((o) => !sameOverride(o, { action: 'add', date: row.date, name: row.name }))
        : [...prev, { action: 'remove', date: row.date, name: row.name, kind: row.kind }]
      return [...next, { action: 'add', date: editDate, name: row.name, kind: row.kind }]
    })
    setEditing(null)
  }

  const addHoliday = (e) => {
    e.preventDefault()
    const name = newHoliday.name.trim()
    if (!newHoliday.date || !name) {
      toastError('Enter a date and a name for the holiday.')
      return
    }
    setDraft((prev) => [...prev, { action: 'add', date: newHoliday.date, name: name.slice(0, 100), kind: newHoliday.kind }])
    setYear(Number(newHoliday.date.slice(0, 4)))
    setNewHoliday({ date: '', name: '', kind: newHoliday.kind })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings({ holidayOverrides: draft })
      success('Holiday calendar saved.')
    } catch (err) {
      toastError(getApiErrorMessage(err, 'Unable to save holiday calendar.'))
    } finally {
      setSaving(false)
    }
  }

  const changedThisYear = draft.filter((o) => o.date.startsWith(`${year}-`)).length

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
            <CalendarDays size={18} className="text-brand-600" aria-hidden />
            Calendar Holidays
          </h3>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">
            Poya days and Sri Lankan public holidays are calculated automatically and shown on the calendar. If the
            government gazette announces a different date, change it here.
          </p>
        </div>
        <div className="inline-flex items-center overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <button type="button" className="px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => setYear((y) => y - 1)} aria-label="Previous year">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-16 border-x border-slate-200 px-3 py-1.5 text-center text-sm font-semibold tabular-nums dark:border-slate-700">
            {year}
          </span>
          <button type="button" className="px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => setYear((y) => y + 1)} aria-label="Next year">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/60">
            <tr>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Holiday</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => {
              const key = rowKey(row)
              return (
                <tr key={key} className={row.removed ? 'text-slate-400 dark:text-slate-500' : ''}>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {editing === key ? (
                      <input
                        type="date"
                        className="input-field !py-1"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      <span className={row.removed ? 'line-through' : ''}>{prettyDate(row.date)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={row.removed ? 'line-through' : ''}>{row.name}</span>
                    {row.source === 'custom' && (
                      <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                        Edited
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${KIND_BADGE[row.kind]}`}>
                      {row.kind === 'poya' ? 'Poya' : 'Public'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {editing === key ? (
                      <span className="inline-flex gap-2">
                        <button type="button" className="text-xs font-medium text-brand-600 hover:underline" onClick={() => applyEdit(row)}>
                          Apply
                        </button>
                        <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                      </span>
                    ) : row.removed ? (
                      <button type="button" className="text-xs font-medium text-brand-600 hover:underline" onClick={() => restoreRow(row)}>
                        Restore
                      </button>
                    ) : (
                      <span className="inline-flex gap-3">
                        <button type="button" className="text-xs font-medium text-brand-600 hover:underline" onClick={() => startEdit(row)}>
                          Change date
                        </button>
                        <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => removeRow(row)}>
                          {row.source === 'custom' ? 'Delete' : 'Hide'}
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <form onSubmit={addHoliday} className="grid gap-3 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700 md:grid-cols-[160px_1fr_140px_auto] md:items-end">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input-field" value={newHoliday.date} onChange={(e) => setNewHoliday((p) => ({ ...p, date: e.target.value }))} />
        </div>
        <div>
          <label className="label">Holiday name</label>
          <input
            className="input-field"
            value={newHoliday.name}
            maxLength={100}
            placeholder="e.g. Special Bank Holiday"
            onChange={(e) => setNewHoliday((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input-field" value={newHoliday.kind} onChange={(e) => setNewHoliday((p) => ({ ...p, kind: e.target.value }))}>
            <option value="public">Public holiday</option>
            <option value="poya">Poya day</option>
          </select>
        </div>
        <button type="submit" className="btn-secondary !py-2.5 text-sm">
          <Plus size={15} aria-hidden />
          Add holiday
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={!dirty || saving || settingsLoading} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save Holidays'}
        </button>
        {dirty && (
          <button type="button" className="btn-secondary text-sm" disabled={saving} onClick={() => setDraft(saved)}>
            Discard changes
          </button>
        )}
        <span className="text-xs text-slate-500">
          {dirty ? 'You have unsaved changes.' : changedThisYear ? `${changedThisYear} correction(s) saved for ${year}.` : 'Using calculated dates.'}
        </span>
      </div>
    </section>
  )
}
