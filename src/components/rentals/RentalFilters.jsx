import { Filter, RotateCcw } from 'lucide-react'
import SearchBar from '../ui/SearchBar'
import FilterDropdown from '../ui/FilterDropdown'
import DateRangePicker from '../ui/DateRangePicker'
import { RENTAL_STATUSES, RENTAL_PAYMENT_STATUSES } from '../../utils/rentalHelpers'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'highest', label: 'Highest amount' },
  { value: 'lowest', label: 'Lowest amount' },
  { value: 'nearest_return', label: 'Nearest return' },
]

export default function RentalFilters({
  search,
  onSearch,
  startDateFrom,
  startDateTo,
  onStartDateFromChange,
  onStartDateToChange,
  returnDateFrom,
  returnDateTo,
  onReturnDateFromChange,
  onReturnDateToChange,
  status,
  onStatus,
  paymentStatus,
  onPaymentStatus,
  category,
  onCategory,
  sort,
  onSort,
  categories = [],
  onReset,
  onFilter,
  showFilterButton = false,
}) {
  return (
    <div className="card p-4 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBar
          value={search}
          onChange={onSearch}
          placeholder="Search rental ID, customer or product..."
          className="flex-1"
        />
        <div className="flex shrink-0 gap-2">
          {showFilterButton && onFilter && (
            <button type="button" className="btn-secondary" onClick={onFilter}>
              <Filter size={16} />
              Filter
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onReset}>
            <RotateCcw size={16} />
            Reset
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="xl:col-span-2">
          <label className="label">Start Date Range</label>
          <DateRangePicker
            from={startDateFrom}
            to={startDateTo}
            onFromChange={onStartDateFromChange}
            onToChange={onStartDateToChange}
          />
        </div>
        <div className="xl:col-span-2">
          <label className="label">Return Date Range</label>
          <DateRangePicker
            from={returnDateFrom}
            to={returnDateTo}
            onFromChange={onReturnDateFromChange}
            onToChange={onReturnDateToChange}
          />
        </div>
        <FilterDropdown
          label="Rental Status"
          value={status}
          onChange={onStatus}
          options={[
            { value: '', label: 'All statuses' },
            ...RENTAL_STATUSES.map((s) => ({ value: s, label: s })),
          ]}
        />
        <FilterDropdown
          label="Payment Status"
          value={paymentStatus}
          onChange={onPaymentStatus}
          options={[
            { value: '', label: 'All statuses' },
            ...RENTAL_PAYMENT_STATUSES.map((s) => ({ value: s, label: s })),
          ]}
        />
        <FilterDropdown
          label="Category"
          value={category}
          onChange={onCategory}
          options={[
            { value: '', label: 'All categories' },
            ...categories.map((c) => ({ value: String(c.id ?? c.name), label: c.name })),
          ]}
        />
        <FilterDropdown
          label="Sort By"
          value={sort}
          onChange={onSort}
          options={SORT_OPTIONS}
        />
      </div>
    </div>
  )
}
