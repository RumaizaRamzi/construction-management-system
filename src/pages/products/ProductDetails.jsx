import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRightLeft, History, Pencil } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import DataTable from '../../components/ui/DataTable'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import { RentalStatusBadge } from '../../components/rentals'
import { ProductDetailsView, TransferToSaleDialog } from '../../components/products'
import { useApp } from '../../contexts/AppContext'
import { canTransferToSale } from '../../utils/productHelpers'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { getApiErrorMessage } from '../../services/api'

export default function ProductDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { products, rentals, productsLoading, loadProduct, can } = useApp()

  const cached = products.find((p) => String(p.id) === String(id))
  const [product, setProduct] = useState(cached || null)
  const [detailLoading, setDetailLoading] = useState(!cached)
  const [detailError, setDetailError] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (cached) {
      setProduct(cached)
      setDetailLoading(false)
      setDetailError(null)
      setNotFound(false)
      return undefined
    }

    if (productsLoading) {
      setDetailLoading(true)
      return undefined
    }

    ;(async () => {
      setDetailLoading(true)
      setDetailError(null)
      try {
        const row = await loadProduct(id)
        if (cancelled) return
        if (!row) {
          setNotFound(true)
          setProduct(null)
        } else {
          setProduct(row)
          setNotFound(false)
        }
      } catch (error) {
        if (!cancelled) {
          setDetailError(getApiErrorMessage(error, 'Unable to load product details. Please try again.'))
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, cached, productsLoading, loadProduct])

  const productRentals = useMemo(
    () =>
      rentals
        .filter((r) => Number(r.productId) === Number(id))
        .sort((a, b) => Number(b.id) - Number(a.id)),
    [rentals, id]
  )

  if (detailLoading || (productsLoading && !product)) {
    return <LoadingState label="Loading product details..." />
  }

  if (detailError) {
    return (
      <div className="card">
        <ApiErrorState
          title="Unable to load product details."
          message={detailError}
          onRetry={() => {
            setDetailError(null)
            setDetailLoading(true)
            loadProduct(id)
              .then((row) => {
                if (!row) setNotFound(true)
                else setProduct(row)
              })
              .catch((error) => {
                setDetailError(getApiErrorMessage(error, 'Unable to load product details. Please try again.'))
              })
              .finally(() => setDetailLoading(false))
          }}
        />
      </div>
    )
  }

  if (notFound || !product) {
    return <Navigate to="/products" replace />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Products', to: '/products' },
              { label: product.name },
            ]}
          />
          <h1 className="page-title">{product.name}</h1>
          <p className="page-subtitle">
            {product.serial_number} · {product.category}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link to="/products" className="btn-secondary">
            <ArrowLeft size={16} />
            Back
          </Link>
          <Link to={`/stock-history/${product.id}`} className="btn-secondary">
            <History size={16} />
            View Stock History
          </Link>
          {can('products.update') && canTransferToSale(product) && (
            <button type="button" className="btn-secondary" onClick={() => setTransferOpen(true)}>
              <ArrowRightLeft size={16} />
              Transfer to Sale
            </button>
          )}
          {can('products.update') && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate('/products', { state: { editProductId: product.id } })}
            >
              <Pencil size={16} />
              Edit
            </button>
          )}
        </div>
      </div>

      <ProductDetailsView product={product} />

      <div className="card">
        <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <h3 className="font-display font-semibold">Rental History</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Past and active rentals for this product
          </p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-xs text-slate-500">Times Rented</p>
            <p className="mt-1 font-display text-xl font-bold">{productRentals.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Rental Days</p>
            <p className="mt-1 font-display text-xl font-bold">
              {productRentals.reduce((sum, r) => sum + Number(r.duration || 0), 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Rental Income</p>
            <p className="mt-1 font-display text-xl font-bold">
              {formatCurrency(productRentals.reduce((sum, r) => sum + Number(r.total || 0), 0))}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Currently Rented</p>
            <p className="mt-1 font-display text-xl font-bold">
              {productRentals
                .filter((r) => ['Active', 'Overdue', 'Confirmed', 'Maintenance'].includes(r.rentalStatus))
                .reduce((sum, r) => sum + Number(r.quantity || 0), 0)}
            </p>
          </div>
        </div>
        <DataTable
          columns={[
            {
              key: 'rentalId',
              label: 'Rental ID',
              render: (row) => (
                <Link to={`/rentals/${row.id}`} className="font-medium text-brand-600 hover:underline">
                  {row.rentalId}
                </Link>
              ),
            },
            { key: 'customer', label: 'Customer' },
            {
              key: 'startDate',
              label: 'Start',
              render: (row) => formatDate(row.startDate),
            },
            {
              key: 'expectedReturn',
              label: 'Expected Return',
              render: (row) => formatDate(row.expectedReturn),
            },
            {
              key: 'total',
              label: 'Amount',
              render: (row) => formatCurrency(row.total),
            },
            {
              key: 'rentalStatus',
              label: 'Status',
              render: (row) => <RentalStatusBadge status={row.rentalStatus} />,
            },
          ]}
          data={productRentals}
          emptyTitle="No rental history for this product."
        />
      </div>

      <TransferToSaleDialog
        product={transferOpen ? product : null}
        onClose={() => setTransferOpen(false)}
        onTransferred={(updated) =>
          updated &&
          setProduct((prev) => ({
            ...prev,
            listingType: updated.listingType,
            salePrice: updated.salePrice,
            status: updated.status,
          }))
        }
      />
    </div>
  )
}
