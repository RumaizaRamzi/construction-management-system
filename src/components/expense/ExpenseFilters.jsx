import { ArrowDownUp, Filter, RotateCcw } from 'lucide-react'
import SearchBar from '../ui/SearchBar'
import FilterDropdown from '../ui/FilterDropdown'
import DateRangePicker from '../ui/DateRangePicker'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_STATUSES,
} from '../../utils/expenseHelpers'

export default function ExpenseFilters({
  filters,
  onChange,
  onFilter,
  onReset,
  suppliers = [],
  products = [],
  sortBy,
  sortDir,
  onSortChange,
}) {
  const set = (key, value) => onChange?.({ ...filters, [key]: value })

  const supplierOptions = [
    { value: '', label: 'All suppliers' },
    ...[...new Set(suppliers.filter(Boolean))].map((s) => ({ value: s, label: s })),
  ]

  const productOptions = [
    { value: '', label: 'All products' },
    ...[...new Set(products.filter(Boolean))].map((p) => ({ value: p, label: p })),
  ]

  return (
    <div className="card p-4 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBar
          value={filters.search}
          onChange={(v) => set('search', v)}
          placeholder="Search expense ID, supplier, reference..."
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
          label="Expense Category"
          value={filters.category}
          onChange={(v) => set('category', v)}
          options={[
            { value: '', label: 'All categories' },
            ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
          ]}
        />
        <FilterDropdown
          label="Supplier / Payee"
          value={filters.supplier}
          onChange={(v) => set('supplier', v)}
          options={supplierOptions}
        />
        <FilterDropdown
          label="Payment Method"
          value={filters.paymentMethod}
          onChange={(v) => set('paymentMethod', v)}
          options={[
            { value: '', label: 'All methods' },
            ...EXPENSE_PAYMENT_METHODS.map((m) => ({ value: m, label: m })),
          ]}
        />
        <FilterDropdown
          label="Payment Status"
          value={filters.paymentStatus}
          onChange={(v) => set('paymentStatus', v)}
          options={[
            { value: '', label: 'All statuses' },
            ...EXPENSE_PAYMENT_STATUSES.map((s) => ({ value: s, label: s })),
          ]}
        />
        <FilterDropdown
          label="Related Product"
          value={filters.product}
          onChange={(v) => set('product', v)}
          options={productOptions}
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
              <option value="category">Category</option>
              <option value="supplier">Supplier</option>
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
