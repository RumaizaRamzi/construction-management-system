import EmptyState from './EmptyState'
import { cn } from '../../utils/helpers'

export default function DataTable({
  columns,
  data,
  emptyTitle,
  emptyDescription,
  emptyAction,
  className,
  compact = false,
}) {
  if (!data?.length) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    )
  }

  return (
    <div className={cn(compact ? 'overflow-x-auto sm:overflow-x-visible' : 'table-wrap', className)}>
      <table className={compact ? 'w-full text-sm' : 'min-w-[640px] w-full text-sm'}>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'text-left text-xs font-semibold uppercase tracking-wide text-slate-500',
                  compact ? 'whitespace-nowrap px-3 py-2.5' : 'px-3 py-3 sm:px-4',
                  col.className
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.map((row) => (
            <tr
              key={row.id ?? JSON.stringify(row)}
              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'text-slate-700 dark:text-slate-300',
                    compact ? 'px-3 py-2.5' : 'px-3 py-3 sm:px-4',
                    col.wrap ? 'whitespace-normal break-words max-w-[14rem]' : 'whitespace-nowrap',
                    col.className,
                    col.cellClassName
                  )}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
