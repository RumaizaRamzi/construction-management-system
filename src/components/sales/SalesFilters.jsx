import { RotateCcw } from 'lucide-react'
import SearchBar from '../ui/SearchBar'
import FilterDropdown from '../ui/FilterDropdown'
import DateRangePicker from '../ui/DateRangePicker'
import { PAYMENT_STATUSES, PAYMENT_METHODS, SALE_STATUSES } from '../../utils/saleHelpers'

export default function SalesFilters({
  search,
  onSearch,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  paymentStatus,
  onPaymentStatus,
  saleStatus,
  onSaleStatus,
  paymentMethod,
  onPaymentMethod,
  category,
  onCategory,
  onReset,
  categories = [],
}) {
  return (
    <div className="card p-4 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBar
          value={search}
          onChange={onSearch}
          placeholder="Search by invoice number or customer..."
          className="flex-1"
        />
        <button type="button" className="btn-secondary shrink-0" onClick={onReset}>
          <RotateCcw size={16} />
          Reset Filters
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="xl:col-span-2">
          <label className="label">Date Range</label>
          <DateRangePicker from={dateFrom} to={dateTo} onFromChange={onDateFromChange} onToChange={onDateToChange} />
        </div>
        <FilterDropdown
          label="Payment Status"
          value={paymentStatus}
          onChange={onPaymentStatus}
          options={[
            { value: '', label: 'All statuses' },
            ...PAYMENT_STATUSES.map((s) => ({ value: s, label: s })),
          ]}
        />
        <FilterDropdown
          label="Sale Status"
          value={saleStatus}
          onChange={onSaleStatus}
          options={[
            { value: '', label: 'All statuses' },
            ...SALE_STATUSES.map((s) => ({ value: s, label: s })),
          ]}
        />
        <FilterDropdown
          label="Payment Method"
          value={paymentMethod}
          onChange={onPaymentMethod}
          options={[
            { value: '', label: 'All methods' },
            ...PAYMENT_METHODS.map((m) => ({ value: m, label: m })),
          ]}
        />
        <FilterDropdown
          label="Category"
          value={category}
          onChange={onCategory}
          options={[
            { value: '', label: 'All categories' },
            ...categories.map((c) => ({ value: String(c.id), label: c.name })),
          ]}
        />
      </div>
    </div>
  )
}
