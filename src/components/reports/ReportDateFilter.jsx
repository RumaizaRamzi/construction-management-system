import { useEffect, useState } from 'react'
import { CalendarRange, Filter } from 'lucide-react'
import DateRangePicker from '../ui/DateRangePicker'
import {
  REPORT_DATE_PRESETS,
  resolveReportDateRange,
} from '../../utils/reportHelpers'
import { formatDateDMY } from '../../utils/helpers'

export default function ReportDateFilter({
  preset,
  onPresetChange,
  from,
  to,
  onRangeChange,
}) {
  const [customFrom, setCustomFrom] = useState(from)
  const [customTo, setCustomTo] = useState(to)

  useEffect(() => {
    setCustomFrom(from)
    setCustomTo(to)
  }, [from, to])

  const handlePreset = (value) => {
    onPresetChange?.(value)
    if (value !== 'custom') {
      const range = resolveReportDateRange(value)
      onRangeChange?.(range.from, range.to)
    }
  }

  const applyCustom = () => {
    const range = resolveReportDateRange('custom', customFrom, customTo)
    onRangeChange?.(range.from, range.to)
  }

  return (
    <div className="card p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <CalendarRange size={16} className="text-brand-600" />
          <span>
            Showing{' '}
            <strong className="text-slate-900 dark:text-white">
              {formatDateDMY(from)}
            </strong>
            {' — '}
            <strong className="text-slate-900 dark:text-white">
              {formatDateDMY(to)}
            </strong>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {REPORT_DATE_PRESETS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handlePreset(option.value)}
            className={
              preset === option.value
                ? 'btn-primary text-xs !px-3 !py-1.5'
                : 'btn-secondary text-xs !px-3 !py-1.5'
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label">Custom Range</label>
            <DateRangePicker
              from={customFrom}
              to={customTo}
              onFromChange={setCustomFrom}
              onToChange={setCustomTo}
            />
          </div>
          <button type="button" className="btn-primary shrink-0" onClick={applyCustom}>
            <Filter size={16} />
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
