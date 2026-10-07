export default function DateRangePicker({ from, to, onFromChange, onToChange, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className="input-field !w-auto" />
      <span className="text-slate-400 text-sm">to</span>
      <input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className="input-field !w-auto" />
    </div>
  )
}
