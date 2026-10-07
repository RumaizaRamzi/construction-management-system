import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Pagination from '../../components/ui/Pagination'
import EmptyState from '../../components/ui/EmptyState'
import {
  RentalStats,
  RentalWidgets,
  RentalFilters,
  RentalTable,
  RentalCard,
  RentalHistory,
  RentalIncomeSummary,
  DeleteRentalDialog,
} from '../../components/rentals'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { paginate } from '../../utils/helpers'

const PAGE_SIZE = 10

const defaultFilters = {
  search: '',
  startDateFrom: '',
  startDateTo: '',
  returnDateFrom: '',
  returnDateTo: '',
  status: '',
  paymentStatus: '',
  category: '',
  sort: 'newest',
}

export default function Rentals() {
  const {
    rentals,
    rentalsLoading,
    rentalsError,
    loadRentals,
    products,
    categories,
    settings,
    deleteRental,
  } = useApp()
  const { success, error: showError } = useToast()

  const [filters, setFilters] = useState(defaultFilters)
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const productMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p])),
    [products]
  )

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    let result = rentals.filter((r) => {
      if (q) {
        const haystack = `${r.rentalId || ''} ${r.rentalNumber || ''} ${r.customer || ''} ${r.product || ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (filters.startDateFrom && r.startDate < filters.startDateFrom) return false
      if (filters.startDateTo && r.startDate > filters.startDateTo) return false
      if (filters.returnDateFrom && r.expectedReturn < filters.returnDateFrom) return false
      if (filters.returnDateTo && r.expectedReturn > filters.returnDateTo) return false
      if (filters.status && r.rentalStatus !== filters.status) return false
      if (filters.paymentStatus && r.paymentStatus !== filters.paymentStatus) return false
      if (filters.category) {
        const product = productMap[r.productId]
        const catMatch =
          String(product?.categoryId) === filters.category ||
          product?.category === categories.find((c) => String(c.id) === filters.category)?.name
        if (!catMatch) return false
      }
      return true
    })

    result = [...result].sort((a, b) => {
      switch (filters.sort) {
        case 'oldest':
          return String(a.startDate).localeCompare(String(b.startDate))
        case 'highest':
          return Number(b.total || 0) - Number(a.total || 0)
        case 'lowest':
          return Number(a.total || 0) - Number(b.total || 0)
        case 'nearest_return':
          return String(a.expectedReturn).localeCompare(String(b.expectedReturn))
        case 'newest':
        default:
          return Number(b.id) - Number(a.id)
      }
    })

    return result
  }, [rentals, filters, productMap, categories])

  const { data: pageData, totalPages, total } = paginate(filtered, page, PAGE_SIZE)

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }))
    setPage(1)
  }

  const handleReset = () => {
    setFilters(defaultFilters)
    setPage(1)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const result = await deleteRental(deleteTarget.id)
      success(result?.message || `Rental ${deleteTarget.rentalId || deleteTarget.rentalNumber} deleted.`)
      setDeleteTarget(null)
    } catch (err) {
      showError(err?.response?.data?.message || 'Unable to delete rental.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Rental Management"
        subtitle="Manage construction equipment rentals, returns and rental income"
        breadcrumbs={[{ label: 'Rental Management' }]}
      />

      {rentalsError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 flex flex-wrap items-center justify-between gap-3">
          <span>{rentalsError}</span>
          <button type="button" className="btn-secondary text-xs" onClick={() => loadRentals().catch(() => {})}>
            Retry
          </button>
        </div>
      )}

      {rentalsLoading && rentals.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">Loading rentals...</div>
      ) : null}

      <RentalStats rentals={rentals} products={products} />

      <RentalWidgets
        rentals={rentals}
        products={products}
        lateFeePerDay={settings?.lateFeePerDay ?? 2500}
      />

      <RentalFilters
        search={filters.search}
        onSearch={(v) => setFilter('search', v)}
        startDateFrom={filters.startDateFrom}
        startDateTo={filters.startDateTo}
        onStartDateFromChange={(v) => setFilter('startDateFrom', v)}
        onStartDateToChange={(v) => setFilter('startDateTo', v)}
        returnDateFrom={filters.returnDateFrom}
        returnDateTo={filters.returnDateTo}
        onReturnDateFromChange={(v) => setFilter('returnDateFrom', v)}
        onReturnDateToChange={(v) => setFilter('returnDateTo', v)}
        status={filters.status}
        onStatus={(v) => setFilter('status', v)}
        paymentStatus={filters.paymentStatus}
        onPaymentStatus={(v) => setFilter('paymentStatus', v)}
        category={filters.category}
        onCategory={(v) => setFilter('category', v)}
        sort={filters.sort}
        onSort={(v) => setFilter('sort', v)}
        categories={categories}
        onReset={handleReset}
      />

      <div className="card">
        {pageData.length === 0 ? (
          <EmptyState
            title="No rentals found"
            description="Adjust filters or create a new rental contract."
            action={
              <Link to="/rentals/new" className="btn-primary">
                <Plus size={16} />
                Create Rental
              </Link>
            }
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <RentalTable rentals={pageData} onDelete={setDeleteTarget} />
            </div>
            <div className="grid gap-4 p-4 lg:hidden">
              {pageData.map((rental) => (
                <RentalCard key={rental.id} rental={rental} onDelete={setDeleteTarget} />
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
          </>
        )}
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Rental History
          </h2>
          <p className="text-sm text-slate-500">Product usage and rental activity by equipment</p>
        </div>
        <RentalHistory rentals={rentals} products={products} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Rental Income Summary
          </h2>
          <p className="text-sm text-slate-500">Revenue trends and rental performance analytics</p>
        </div>
        <RentalIncomeSummary rentals={rentals} products={products} />
      </section>

      <DeleteRentalDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        rental={deleteTarget}
      />
    </div>
  )
}
