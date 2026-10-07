import { Filter, RotateCcw } from 'lucide-react'
import SearchBar from '../ui/SearchBar'
import FilterDropdown from '../ui/FilterDropdown'
import DateRangePicker from '../ui/DateRangePicker'
import {
  CHECK_ASSIGNEES,
  CHECK_FREQUENCIES,
  CHECK_PRIORITIES,
  CHECK_STATUSES,
} from '../../utils/checkHelpers'

export default function CheckFilters({
  filters,
  onChange,
  onFilter,
  onReset,
  products = [],
  categories = [],
}) {
  const set = (key, value) => onChange?.({ ...filters, [key]: value })

  const productOptions = [
    { value: '', label: 'All products' },
    ...products.map((p) => ({ value: p.name, label: p.name })),
  ]

  const categoryOptions = [
    { value: '', label: 'All categories' },
    ...categories.map((c) => ({ value: c.name, label: c.name })),
  ]

  return (
    <div className="card p-4 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBar
          value={filters.search}
          onChange={(v) => set('search', v)}
          placeholder="Search check ID, name, product, assignee..."
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
          label="Product"
          value={filters.product}
          onChange={(v) => set('product', v)}
          options={productOptions}
        />
        <FilterDropdown
          label="Category"
          value={filters.category}
          onChange={(v) => set('category', v)}
          options={categoryOptions}
        />
        <FilterDropdown
          label="Status"
          value={filters.status}
          onChange={(v) => set('status', v)}
          options={[
            { value: '', label: 'All statuses' },
            ...CHECK_STATUSES.map((s) => ({ value: s, label: s })),
          ]}
        />
        <FilterDropdown
          label="Priority"
          value={filters.priority}
          onChange={(v) => set('priority', v)}
          options={[
            { value: '', label: 'All priorities' },
            ...CHECK_PRIORITIES.map((p) => ({ value: p, label: p })),
          ]}
        />
        <FilterDropdown
          label="Assigned Person"
          value={filters.assignedTo}
          onChange={(v) => set('assignedTo', v)}
          options={[
            { value: '', label: 'All assignees' },
            ...CHECK_ASSIGNEES.map((a) => ({ value: a, label: a })),
          ]}
        />
        <FilterDropdown
          label="Frequency"
          value={filters.frequency}
          onChange={(v) => set('frequency', v)}
          options={[
            { value: '', label: 'All frequencies' },
            ...CHECK_FREQUENCIES.map((f) => ({ value: f, label: f })),
          ]}
        />
        <div className="sm:col-span-2">
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
