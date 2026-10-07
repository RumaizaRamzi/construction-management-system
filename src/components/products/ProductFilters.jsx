import SearchBar from '../ui/SearchBar'
import FilterDropdown from '../ui/FilterDropdown'
import { RotateCcw } from 'lucide-react'
import { PRODUCT_CONDITIONS, PRODUCT_STATUSES } from '../../data/productsData'

export default function ProductFilters({
  search,
  onSearch,
  category,
  onCategory,
  stockStatus,
  onStockStatus,
  condition,
  onCondition,
  availability,
  onAvailability,
  priceRange,
  onPriceRange,
  sortBy,
  onSortBy,
  inventory,
  onInventory,
  categories = [],
  onReset,
}) {
  return (
    <div className="card p-4 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBar
          value={search}
          onChange={onSearch}
          placeholder="Search products by name, serial number or category..."
          className="flex-1"
        />
        <button type="button" className="btn-secondary shrink-0" onClick={onReset}>
          <RotateCcw size={16} />
          Reset Filters
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {onInventory ? (
          <FilterDropdown
            label="Inventory"
            value={inventory}
            onChange={onInventory}
            options={[
              { value: 'all', label: 'All Inventory' },
              { value: 'rent', label: 'Rental Inventory' },
              { value: 'sale', label: 'Sales Inventory' },
            ]}
          />
        ) : null}
        <FilterDropdown
          label="Category"
          value={category}
          onChange={onCategory}
          options={[
            { value: 'all', label: 'All Categories' },
            ...categories.map((c) => ({ value: String(c.id), label: c.name })),
          ]}
        />
        <FilterDropdown
          label="Stock Status"
          value={stockStatus}
          onChange={onStockStatus}
          options={[
            { value: 'all', label: 'All Statuses' },
            ...PRODUCT_STATUSES.map((s) => ({ value: s, label: s })),
          ]}
        />
        <FilterDropdown
          label="Condition"
          value={condition}
          onChange={onCondition}
          options={[
            { value: 'all', label: 'All Conditions' },
            ...PRODUCT_CONDITIONS.map((c) => ({ value: c, label: c })),
          ]}
        />
        <FilterDropdown
          label="Availability"
          value={availability}
          onChange={onAvailability}
          options={[
            { value: 'all', label: 'All' },
            { value: 'in_stock', label: 'In Stock' },
            { value: 'low_stock', label: 'Low Stock' },
            { value: 'out_of_stock', label: 'Out of Stock' },
            { value: 'rented', label: 'Currently Rented' },
          ]}
        />
        <FilterDropdown
          label="Price Range"
          value={priceRange}
          onChange={onPriceRange}
          options={[
            { value: 'all', label: 'All Prices' },
            { value: '0-50000', label: 'Under LKR 50,000' },
            { value: '50000-100000', label: 'LKR 50,000 – 100,000' },
            { value: '100000-200000', label: 'LKR 100,000 – 200,000' },
            { value: '200000+', label: 'Over LKR 200,000' },
          ]}
        />
        <FilterDropdown
          label="Sort By"
          value={sortBy}
          onChange={onSortBy}
          options={[
            { value: 'name-asc', label: 'Name (A–Z)' },
            { value: 'name-desc', label: 'Name (Z–A)' },
            { value: 'serial-asc', label: 'Serial Number (A–Z)' },
            { value: 'qty-desc', label: 'Quantity (High–Low)' },
            { value: 'available-asc', label: 'Available (Low–High)' },
            { value: 'sale-desc', label: 'Sale Price (High–Low)' },
            { value: 'rental-desc', label: 'Rental Price (High–Low)' },
          ]}
        />
      </div>
    </div>
  )
}
