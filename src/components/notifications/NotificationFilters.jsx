import { NOTIFICATION_CATEGORIES, NOTIFICATION_PRIORITIES } from '../../utils/notificationHelpers'
import SearchBar from '../ui/SearchBar'
import FilterDropdown from '../ui/FilterDropdown'

export default function NotificationFilters({
  category,
  onCategory,
  search,
  onSearch,
  priority,
  onPriority,
  readStatus,
  onReadStatus,
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {NOTIFICATION_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onCategory?.(cat)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              category === cat
                ? 'bg-brand-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="card p-4 flex flex-col gap-3 lg:flex-row lg:items-end">
        <SearchBar
          value={search}
          onChange={onSearch}
          placeholder="Search notifications..."
          className="flex-1"
        />
        <FilterDropdown
          label="Priority"
          value={priority}
          onChange={onPriority}
          options={[
            { value: '', label: 'All priorities' },
            ...NOTIFICATION_PRIORITIES.map((p) => ({ value: p, label: p })),
          ]}
          className="w-full lg:w-44"
        />
        <FilterDropdown
          label="Read status"
          value={readStatus}
          onChange={onReadStatus}
          options={[
            { value: '', label: 'All' },
            { value: 'unread', label: 'Unread' },
            { value: 'read', label: 'Read' },
          ]}
          className="w-full lg:w-40"
        />
      </div>
    </div>
  )
}
