import { ArrowDownUp, Filter, RotateCcw } from 'lucide-react'
import SearchBar from '../ui/SearchBar'
import FilterDropdown from '../ui/FilterDropdown'
import DateRangePicker from '../ui/DateRangePicker'
import {
  INCOME_CATEGORIES,
  INCOME_PAYMENT_METHODS,
  INCOME_PAYMENT_STATUSES,
  INCOME_SOURCES,
} from '../../utils/incomeHelpers'

export default function IncomeFilters({
  filters,
  onChange,
  onFilter,
  onReset,
  customers = [],
  sortBy,
  sortDir,
  onSortChange,
}) {
  const set = (key, value) => onChange?.({ ...filters, [key]: value })

  const customerOptions = [
    { value: '', label: 'All customers' },
    ...[...new Set(customers.filter(Boolean))].map((c) => ({ value: c, label: c })),
  ]

  return (
    <div className="card p-4 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBar
          value={filters.search}
          onChange={(v) => set('search', v)}
          placeholder="Search income ID, customer, reference..."
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
        <div className="sm:col-span-2">
          <label className="label">Date Range</label>
          <DateRangePicker
            from={filters.dateFrom}
            to={filters.dateTo}
            onFromChange={(v) => set('dateFrom', v)}
            onToChange={(v) => set('dateTo', v)}
          />
        </div>
        <FilterDropdown
          label="Income Source"
          value={filters.source}
          onChange={(v) => set('source', v)}
          options={[
            { value: '', label: 'All sources' },
            ...INCOME_SOURCES.map((s) => ({ value: s, label: s })),
          ]}
        />
        <FilterDropdown
          label="Category"
          value={filters.category}
          onChange={(v) => set('category', v)}
          options={[
            { value: '', label: 'All categories' },
            ...INCOME_CATEGORIES.map((c) => ({ value: c, label: c })),
          ]}
        />
        <FilterDropdown
          label="Customer"
          value={filters.customer}
          onChange={(v) => set('customer', v)}
          options={customerOptions}
        />
        <FilterDropdown
          label="Payment Method"
          value={filters.paymentMethod}
          onChange={(v) => set('paymentMethod', v)}
          options={[
            { value: '', label: 'All methods' },
            ...INCOME_PAYMENT_METHODS.map((m) => ({ value: m, label: m })),
          ]}
        />
        <FilterDropdown
          label="Payment Status"
          value={filters.paymentStatus}
          onChange={(v) => set('paymentStatus', v)}
          options={[
            { value: '', label: 'All statuses' },
            ...INCOME_PAYMENT_STATUSES.map((s) => ({ value: s, label: s })),
          ]}
        />
        <div>
          <label className="label">Sort By</label>
          <div className="flex gap-2">
            <select
              className="input-field"
              value={sortBy}
              onChange={(e) => onSortChange?.(e.target.value, sortDir)}
            >
              <option value="date">Date</option>
              <option value="amount">Amount</option>
              <option value="customer">Customer</option>
              <option value="source">Income Source</option>
              <option value="paymentStatus">Payment Status</option>
            </select>
            <button
              type="button"
              className="btn-secondary !px-3"
              title="Toggle sort direction"
              onClick={() => onSortChange?.(sortBy, sortDir === 'asc' ? 'desc' : 'asc')}
            >
              <ArrowDownUp size={16} />
              {sortDir === 'asc' ? 'Asc' : 'Desc'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
