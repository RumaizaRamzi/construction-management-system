import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Pagination from '../../components/ui/Pagination'
import LoadingState from '../../components/ui/LoadingState'
import EmptyState from '../../components/ui/EmptyState'
import {
  SalesStats,
  SalesFilters,
  SaleTable,
  SaleCard,
  DeleteSaleDialog,
  SalesCharts,
} from '../../components/sales'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage } from '../../services/api'
import { paginate } from '../../utils/helpers'

const PAGE_SIZE = 8

const defaultFilters = {
  search: '',
  dateFrom: '',
  dateTo: '',
  paymentStatus: '',
  saleStatus: '',
  paymentMethod: '',
  category: '',
}

export default function Sales() {
  const { sales, salesLoading, salesError, products, categories, deleteSale, loadSales } = useApp()
  const { success, error: toastError } = useToast()

  const [filters, setFilters] = useState(defaultFilters)
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [filters])

  const productCategoryMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, String(p.categoryId)])),
    [products]
  )

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return sales.filter((s) => {
      if (q) {
        const haystack = `${s.invoiceNumber} ${s.customer} ${s.products || ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (filters.dateFrom && s.date < filters.dateFrom) return false
      if (filters.dateTo && s.date > filters.dateTo) return false
      if (filters.paymentStatus && s.paymentStatus !== filters.paymentStatus) return false
      if (filters.saleStatus && s.saleStatus !== filters.saleStatus) return false
      if (filters.paymentMethod && s.paymentMethod !== filters.paymentMethod) return false
      if (filters.category) {
        const items = s.items?.length ? s.items : []
        const matchesCategory = items.some(
          (item) => productCategoryMap[item.productId] === filters.category
        )
        if (!matchesCategory) return false
      }
      return true
    })
  }, [sales, filters, productCategoryMap])

  const paged = paginate(filtered, page, PAGE_SIZE)

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { message } = await deleteSale(deleteTarget.id)
      success(message || `Sale ${deleteTarget.invoiceNumber} cancelled successfully.`)
      setDeleteTarget(null)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to cancel sale.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Sales Management"
        subtitle="Manage construction equipment and product sales"
        breadcrumbs={[{ label: 'Sales' }]}
      />

      {salesError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex flex-wrap items-center justify-between gap-3">
          <span>{salesError}</span>
          <button type="button" className="btn-secondary text-xs" onClick={() => loadSales().catch(() => {})}>
            Retry
          </button>
        </div>
      )}

      <SalesStats sales={sales} />

      <SalesFilters
        search={filters.search}
        onSearch={(v) => setFilter('search', v)}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        onDateFromChange={(v) => setFilter('dateFrom', v)}
        onDateToChange={(v) => setFilter('dateTo', v)}
        paymentStatus={filters.paymentStatus}
        onPaymentStatus={(v) => setFilter('paymentStatus', v)}
        saleStatus={filters.saleStatus}
        onSaleStatus={(v) => setFilter('saleStatus', v)}
        paymentMethod={filters.paymentMethod}
        onPaymentMethod={(v) => setFilter('paymentMethod', v)}
        category={filters.category}
        onCategory={(v) => setFilter('category', v)}
        categories={categories}
        onReset={() => setFilters(defaultFilters)}
      />

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <div>
            <h3 className="font-display font-semibold">Sales Records</h3>
            <p className="text-sm text-slate-500">{filtered.length} sales</p>
          </div>
        </div>

        {salesLoading ? (
          <LoadingState label="Loading sales..." />
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No sales found"
              description="Try adjusting your search or filters, or create a new sale."
              action={
                <Link to="/sales/new" className="btn-primary">
                  <Plus size={16} /> Create Sale
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <SaleTable sales={paged.data} onDelete={setDeleteTarget} />
            </div>
            <div className="grid gap-3 p-4 md:hidden">
              {paged.data.map((sale) => (
                <SaleCard key={sale.id} sale={sale} onDelete={setDeleteTarget} />
              ))}
            </div>
            <div className="border-t border-slate-200 dark:border-slate-800 px-4">
              <Pagination
                page={paged.page}
                totalPages={paged.totalPages}
                total={paged.total}
                onChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      <DeleteSaleDialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        sale={deleteTarget}
      />

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Sales Report Preview
          </h2>
          <p className="text-sm text-slate-500">Visual overview of sales performance</p>
        </div>
        <SalesCharts sales={sales} products={products} />
      </section>
    </div>
  )
}
