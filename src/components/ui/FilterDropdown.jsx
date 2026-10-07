export default function FilterDropdown({ label, value, onChange, options, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field">
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
