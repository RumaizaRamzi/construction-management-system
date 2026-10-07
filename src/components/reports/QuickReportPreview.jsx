import { formatCurrency } from '../../utils/helpers'

const money = (value) => (value == null ? 'Restricted' : formatCurrency(value))

function PreviewBlock({ title, rows }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <h4 className="font-display font-semibold text-slate-900 dark:text-white mb-3">
        {title}
      </h4>
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-slate-500">{row.label}</span>
            <strong className="text-slate-900 dark:text-white tabular-nums">
              {row.value}
            </strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function QuickReportPreview({ preview }) {
  if (!preview) return null

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
          Quick Report Preview
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Compact overview for the selected reporting period.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PreviewBlock
          title="Sales"
          rows={[
            { label: 'Number of sales', value: preview.sales.count },
            { label: 'Sales amount', value: formatCurrency(preview.sales.amount) },
          ]}
        />
        <PreviewBlock
          title="Rentals"
          rows={[
            { label: 'Number of rentals', value: preview.rentals.count },
            { label: 'Rental income', value: formatCurrency(preview.rentals.income) },
          ]}
        />
        <PreviewBlock
          title="Inventory"
          rows={[
            { label: 'Total products', value: preview.inventory.totalProducts },
            { label: 'Available products', value: preview.inventory.availableProducts },
            { label: 'Rented products', value: preview.inventory.rentedProducts },
            { label: 'Low-stock products', value: preview.inventory.lowStockProducts },
          ]}
        />
        <PreviewBlock
          title="Financial"
          rows={[
            { label: 'Total income', value: money(preview.financial.totalIncome) },
            { label: 'Total expenses', value: money(preview.financial.totalExpenses) },
            { label: 'Net cash flow', value: money(preview.financial.netCashFlow) },
            {
              label: 'Outstanding income',
              value: money(preview.financial.outstandingIncome),
            },
            {
              label: 'Outstanding expenses',
              value: money(preview.financial.outstandingExpenses),
            },
          ]}
        />
      </div>
    </section>
  )
}
