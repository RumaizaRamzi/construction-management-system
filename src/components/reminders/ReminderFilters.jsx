import { Filter, RotateCcw } from 'lucide-react'
import SearchBar from '../ui/SearchBar'
import FilterDropdown from '../ui/FilterDropdown'
import DateRangePicker from '../ui/DateRangePicker'
import {
  REMINDER_PRIORITIES,
  REMINDER_SOURCES,
  REMINDER_STATUSES,
} from '../../utils/reminderHelpers'

export default function ReminderFilters({ filters, onChange, onFilter, onReset }) {
  const set = (key, value) => onChange?.({ ...filters, [key]: value })

  return (
    <div className="card p-4 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBar
          value={filters.search}
          onChange={(v) => set('search', v)}
          placeholder="Search reminders, products, sources..."
          className="flex-1"
        />
        <div className="flex flex-wrap gap-2 shrink-0">
          <button type="button" className="btn-primary" onClick={onFilter}>
            <Filter size={16} />
            Filter
          </button>
          <button type="button" className="btn-secondary" onClick={onReset}>
            <RotateCcw size={16} />
            Reset
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FilterDropdown
          label="Priority"
          value={filters.priority}
          onChange={(v) => set('priority', v)}
          options={[
            { value: '', label: 'All priorities' },
            ...REMINDER_PRIORITIES.map((p) => ({ value: p, label: p })),
          ]}
        />
        <FilterDropdown
          label="Status"
          value={filters.status}
          onChange={(v) => set('status', v)}
          options={[
            { value: '', label: 'All statuses' },
            ...REMINDER_STATUSES.filter((s) => s !== 'Completed').map((s) => ({
              value: s,
              label: s,
            })),
          ]}
        />
        <FilterDropdown
          label="Source"
          value={filters.source}
          onChange={(v) => set('source', v)}
          options={[
            { value: '', label: 'All sources' },
            ...REMINDER_SOURCES.map((s) => ({ value: s, label: s })),
          ]}
        />
        <div className="sm:col-span-2 xl:col-span-1">
          <label className="label">Date Range</label>
          <DateRangePicker
            from={filters.dateFrom}
            to={filters.dateTo}
            onFromChange={(v) => set('dateFrom', v)}
            onToChange={(v) => set('dateTo', v)}
          />
        </div>
      </div>
    </div>
  )
}
