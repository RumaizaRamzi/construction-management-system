import { useMemo } from 'react'

const MATRIX_COLUMNS = [
  { key: 'view', label: 'View', actions: ['view'] },
  { key: 'create', label: 'Create', actions: ['create'] },
  { key: 'edit', label: 'Edit', actions: ['update', 'edit'] },
  { key: 'delete', label: 'Delete', actions: ['delete'] },
  { key: 'print', label: 'Print', actions: ['print'] },
  { key: 'export', label: 'Export', actions: ['export'] },
]

const MODULE_LABELS = {
  activity: 'Activity History',
  audit: 'Audit Logs',
  branches: 'Branches',
  checks: 'Equipment Checks',
  income: 'Income',
  expenses: 'Expenses',
  payments: 'Payments',
  roles: 'Roles',
}

const titleCase = (value) => String(value || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

/** Groups permission slugs ("module.action") into matrix rows. */
function buildMatrix(permissions) {
  const rows = new Map()
  permissions.forEach((p) => {
    const [module, action = ''] = String(p.slug).split('.')
    if (!rows.has(module)) {
      rows.set(module, { module, label: MODULE_LABELS[module] || titleCase(module), group: p.group, cells: {}, extras: [] })
    }
    const row = rows.get(module)
    const column = MATRIX_COLUMNS.find((c) => c.actions.includes(action))
    if (column && !row.cells[column.key]) row.cells[column.key] = p
    else row.extras.push(p)
  })
  return [...rows.values()].sort((a, b) => a.group?.localeCompare(b.group || '') || a.label.localeCompare(b.label))
}

function Box({ checked, indeterminate = false, disabled, onChange, label }) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate
      }}
      disabled={disabled}
      onChange={onChange}
      aria-label={label}
    />
  )
}

/**
 * Rows = modules, columns = View/Create/Edit/Delete/Print/Export.
 * Only permissions the server actually enforces are selectable; other cells show a dash.
 */
export default function PermissionMatrix({ permissions, selected, onChange, disabled = false }) {
  const rows = useMemo(() => buildMatrix(permissions), [permissions])
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const rowSlugs = (row) => [...Object.values(row.cells), ...row.extras].map((p) => p.slug)
  const columnSlugs = (key) => rows.map((r) => r.cells[key]?.slug).filter(Boolean)
  const allSlugs = permissions.map((p) => p.slug)

  const stateOf = (slugs) => {
    const count = slugs.filter((s) => selectedSet.has(s)).length
    return { checked: slugs.length > 0 && count === slugs.length, indeterminate: count > 0 && count < slugs.length }
  }

  const setMany = (slugs, on) => {
    const next = new Set(selectedSet)
    slugs.forEach((s) => (on ? next.add(s) : next.delete(s)))
    onChange([...next])
  }

  const toggle = (slug) => setMany([slug], !selectedSet.has(slug))
  const all = stateOf(allSlugs)

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-semibold dark:bg-slate-800">
              <label className="flex items-center gap-2">
                <Box {...all} disabled={disabled} onChange={() => setMany(allSlugs, !all.checked)} label="Select all permissions" />
                Module
              </label>
            </th>
            {MATRIX_COLUMNS.map((col) => {
              const slugs = columnSlugs(col.key)
              const st = stateOf(slugs)
              return (
                <th key={col.key} className="px-2 py-2 text-center font-semibold" title={slugs.length ? undefined : `No ${col.label.toLowerCase()} permissions exist in the system yet`}>
                  <div className="flex flex-col items-center gap-1">
                    <span>{col.label}</span>
                    {slugs.length ? (
                      <Box {...st} disabled={disabled} onChange={() => setMany(slugs, !st.checked)} label={`Select all ${col.label} permissions`} />
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </div>
                </th>
              )
            })}
            <th className="px-3 py-2 text-left font-semibold">Other</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row) => {
            const st = stateOf(rowSlugs(row))
            return (
              <tr key={row.module} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 dark:bg-slate-900">
                  <label className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                    <Box {...st} disabled={disabled} onChange={() => setMany(rowSlugs(row), !st.checked)} label={`Select all ${row.label} permissions`} />
                    {row.label}
                  </label>
                </td>
                {MATRIX_COLUMNS.map((col) => {
                  const p = row.cells[col.key]
                  return (
                    <td key={col.key} className="px-2 py-2 text-center">
                      {p ? (
                        <span title={p.name} className="inline-flex">
                          <Box checked={selectedSet.has(p.slug)} disabled={disabled} onChange={() => toggle(p.slug)} label={p.name} />
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                  )
                })}
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {row.extras.map((p) => (
                      <label key={p.slug} className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                        <Box checked={selectedSet.has(p.slug)} disabled={disabled} onChange={() => toggle(p.slug)} label={p.name} />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
