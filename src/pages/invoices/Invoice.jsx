import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import EmptyState from '../../components/ui/EmptyState'
import { PaymentStatusBadge } from '../../components/sales'
import { useApp } from '../../contexts/AppContext'
import { formatCurrency, formatDate } from '../../utils/helpers'

export default function Invoice() {
  const { sales } = useApp()

  const activeSales = sales.filter((s) => s.saleStatus !== 'Cancelled')

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: 'Invoices' }]} />
        <h1 className="page-title">Sales Invoices</h1>
        <p className="page-subtitle">Browse and open printable invoices for completed sales</p>
      </div>

      {activeSales.length === 0 ? (
        <EmptyState
          title="No invoices available"
          description="Create a sale to generate your first invoice."
          action={
            <Link to="/sales/new" className="btn-primary">
              Create Sale
            </Link>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4">
            <h3 className="font-display font-semibold">All Invoices</h3>
            <p className="text-sm text-slate-500">{activeSales.length} invoice(s)</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {activeSales.map((sale) => (
              <Link
                key={sale.id}
                to={`/sales/${sale.id}/invoice`}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/40">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-600">{sale.invoiceNumber}</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {sale.customer}
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(sale.date)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <PaymentStatusBadge status={sale.paymentStatus} />
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(sale.total ?? 0)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
