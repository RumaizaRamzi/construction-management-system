import { Filter, RotateCcw } from 'lucide-react'
import SearchBar from '../ui/SearchBar'
import FilterDropdown from '../ui/FilterDropdown'
import DateRangePicker from '../ui/DateRangePicker'
import {
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_STATUSES,
  MAINTENANCE_TECHNICIANS,
  MAINTENANCE_TYPES,
} from '../../utils/maintenanceHelpers'

export default function MaintenanceFilters({
  filters,
  onChange,
  onFilter,
  onReset,
  products = [],
}) {
  const set = (key, value) => onChange?.({ ...filters, [key]: value })

  return (
    <div className="card p-4 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBar
          value={filters.search}
          onChange={(v) => set('search', v)}
          placeholder="Search ID, product, type, technician..."
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
          options={[
            { value: '', label: 'All products' },
            ...products.map((p) => ({ value: p.name, label: p.name })),
          ]}
        />
        <FilterDropdown
          label="Maintenance Type"
          value={filters.maintenanceType}
          onChange={(v) => set('maintenanceType', v)}
          options={[
            { value: '', label: 'All types' },
            ...MAINTENANCE_TYPES.map((t) => ({ value: t, label: t })),
          ]}
        />
        <FilterDropdown
          label="Status"
          value={filters.status}
          onChange={(v) => set('status', v)}
          options={[
            { value: '', label: 'All statuses' },
            ...MAINTENANCE_STATUSES.map((s) => ({ value: s, label: s })),
            { value: 'Overdue', label: 'Overdue' },
          ]}
        />
        <FilterDropdown
          label="Priority"
          value={filters.priority}
          onChange={(v) => set('priority', v)}
          options={[
            { value: '', label: 'All priorities' },
            ...MAINTENANCE_PRIORITIES.map((p) => ({ value: p, label: p })),
          ]}
        />
        <FilterDropdown
          label="Technician"
          value={filters.technician}
          onChange={(v) => set('technician', v)}
          options={[
            { value: '', label: 'All technicians' },
            ...MAINTENANCE_TECHNICIANS.map((t) => ({ value: t, label: t })),
          ]}
        />
        <div className="sm:col-span-2 xl:col-span-3">
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
