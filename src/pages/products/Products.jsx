import { useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { ChevronRight, KeyRound, Plus, ShoppingCart } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Pagination from '../../components/ui/Pagination'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import {
  ProductStats,
  ProductFilters,
  ProductTable,
  ProductCard,
  ProductForm,
  DeleteConfirmation,
  TransferToSaleDialog,
} from '../../components/products'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'
import { paginate } from '../../utils/helpers'
import {
  emptyProductForm,
  getStockStatus,
  isListedForRent,
  isListedForSale,
  validateProductForm,
} from '../../utils/productHelpers'
import { PRODUCT_IMAGES } from '../../data/productsData'

const PAGE_SIZE = 8

const PRODUCT_PURPOSES = [
  { value: 'sale', label: 'For Sale', description: 'Sold to customers — set a sale price.', icon: ShoppingCart },
  { value: 'rent', label: 'For Rent', description: 'Rented out to customers — set a daily rental rate.', icon: KeyRound },
]

const defaultFilters = {
  search: '',
  category: 'all',
  stockStatus: 'all',
  condition: 'all',
  availability: 'all',
  priceRange: 'all',
  sortBy: 'name-asc',
  inventory: 'all',
}

function matchesPriceRange(salePrice, range) {
  const price = Number(salePrice) || 0
  if (range === 'all') return true
  if (range === '0-50000') return price < 50000
  if (range === '50000-100000') return price >= 50000 && price <= 100000
  if (range === '100000-200000') return price > 100000 && price <= 200000
  if (range === '200000+') return price > 200000
  return true
}

function matchesAvailability(product, availability) {
  const status = getStockStatus(product)
  if (availability === 'all') return true
  if (availability === 'in_stock') return status === 'Available'
  if (availability === 'low_stock') return status === 'Low Stock'
  if (availability === 'out_of_stock') return status === 'Out of Stock'
  if (availability === 'rented') return Number(product.rented) > 0
  return true
}

export default function Products() {
  const {
    products,
    categories,
    addProduct,
    updateProduct,
    deleteProduct,
    productsLoading,
    productsError,
    loadProducts,
    categoriesLoading,
    can,
  } = useApp()
  const canEdit = can('products.update')
  const canDelete = can('products.delete')
  const { success, error: toastError } = useToast()
  const [searchParams] = useSearchParams()
  const location = useLocation()

  const [filters, setFilters] = useState(() => ({
    ...defaultFilters,
    search: searchParams.get('q') || '',
  }))
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [purposeChooserOpen, setPurposeChooserOpen] = useState(false)
  const [purpose, setPurpose] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyProductForm(PRODUCT_IMAGES[0]))
  const [errors, setErrors] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [transferTarget, setTransferTarget] = useState(null)

  useEffect(() => {
    const q = searchParams.get('q')
    if (q != null) setFilters((prev) => ({ ...prev, search: q }))
  }, [searchParams])

  useEffect(() => {
    setPage(1)
  }, [filters])

  useEffect(() => {
    const editId = location.state?.editProductId
    if (!editId) return
    const product = products.find((p) => p.id === editId)
    if (product) openEdit(product)
    window.history.replaceState({}, document.title)
  }, [location.state, products])

  useEffect(() => {
    if (!location.state?.createProduct || !can('products.create')) return
    openCreate()
    window.history.replaceState({}, document.title)
  }, [location.state])

  const loading = productsLoading || categoriesLoading
  const filtered = useMemo(() => {
    let list = [...products]
    const q = filters.search.trim().toLowerCase()

    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.serial_number.toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q)
      )
    }

    if (filters.category !== 'all') {
      list = list.filter((p) => String(p.categoryId) === filters.category)
    }

    if (filters.stockStatus !== 'all') {
      list = list.filter((p) => getStockStatus(p) === filters.stockStatus)
    }

    if (filters.condition !== 'all') {
      list = list.filter((p) => p.condition === filters.condition)
    }

    if (filters.inventory === 'rent') list = list.filter(isListedForRent)
    if (filters.inventory === 'sale') list = list.filter(isListedForSale)

    list = list.filter((p) => matchesAvailability(p, filters.availability))
    list = list.filter((p) => matchesPriceRange(p.salePrice, filters.priceRange))

    list.sort((a, b) => {
      switch (filters.sortBy) {
        case 'name-desc':
          return b.name.localeCompare(a.name)
        case 'serial-asc':
          return a.serial_number.localeCompare(b.serial_number)
        case 'qty-desc':
          return b.quantity - a.quantity
        case 'available-asc':
          return a.available - b.available
        case 'sale-desc':
          return b.salePrice - a.salePrice
        case 'rental-desc':
          return b.rentalPrice - a.rentalPrice
        default:
          return a.name.localeCompare(b.name)
      }
    })

    return list
  }, [products, filters])

  const paged = paginate(filtered, page, PAGE_SIZE)

  const openCreate = () => setPurposeChooserOpen(true)

  const startCreate = (nextPurpose) => {
    const emptyForm = emptyProductForm(PRODUCT_IMAGES[0])
    setPurposeChooserOpen(false)
    setPurpose(nextPurpose)
    setEditing(null)
    setForm({
      ...emptyForm,
      salePrice: nextPurpose === 'rent' ? '0' : emptyForm.salePrice,
      rentalPrice: nextPurpose === 'sale' ? '0' : emptyForm.rentalPrice,
    })
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (product) => {
    if (!can('products.update')) return
    setPurpose(null)
    setEditing(product)
    setForm({
      name: product.name,
      serial_number: product.serial_number,
      categoryId: String(product.categoryId),
      category: product.category,
      description: product.description || '',
      unit: product.unit || '',
      quantity: String(product.quantity),
      available: String(product.available),
      minStock: String(product.minStock),
      purchaseCost: product.purchaseCostSet === false ? '' : String(product.purchaseCost),
      salePrice: String(product.salePrice),
      rentalPrice: String(product.rentalPrice),
      condition: product.condition,
      location: product.location || '',
      branchId: product.branchId != null ? String(product.branchId) : '',
      status: getStockStatus(product),
      image: product.image || PRODUCT_IMAGES[0],
    })
    setErrors({})
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nextErrors = validateProductForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    const quantity = Number(form.quantity)
    const payload = {
      name: form.name.trim(),
      serial_number: form.serial_number.trim().toUpperCase(),
      categoryId: Number(form.categoryId),
      category: form.category,
      description: form.description.trim(),
      unit: form.unit || null,
      quantity,
      available: editing
        ? Math.min(quantity, Number(form.available || quantity))
        : quantity,
      minStock: Number(form.minStock),
      purchaseCost: form.purchaseCost === '' ? null : Number(form.purchaseCost),
      salePrice: Number(form.salePrice),
      rentalPrice: Number(form.rentalPrice),
      condition: form.condition,
      location: form.location.trim(),
      branchId: form.branchId || null,
      status: form.status === 'Out of Stock' ? 'Available' : form.status,
      image: form.image,
      ...(!editing && purpose ? { listingType: purpose } : {}),
    }

    try {
      if (editing) {
        const { message } = await updateProduct(editing.id, payload)
        success(message || 'Product updated successfully.')
      } else {
        const { message } = await addProduct(payload)
        success(message || 'Product created successfully.')
      }
      setModalOpen(false)
    } catch (error) {
      const fieldErrors = getApiValidationErrors(error)
      if (Object.keys(fieldErrors).length) {
        const mapped = {}
        if (fieldErrors.name) mapped.name = fieldErrors.name
        if (fieldErrors.serial_number) mapped.serial_number = fieldErrors.serial_number
        if (fieldErrors.category_id) mapped.category = fieldErrors.category_id
        if (fieldErrors.quantity) mapped.quantity = fieldErrors.quantity
        if (fieldErrors.minimum_stock) mapped.minStock = fieldErrors.minimum_stock
        if (fieldErrors.purchase_price) mapped.purchaseCost = fieldErrors.purchase_price
        if (fieldErrors.sale_price) mapped.salePrice = fieldErrors.sale_price
        if (fieldErrors.rental_price) mapped.rentalPrice = fieldErrors.rental_price
        setErrors(mapped)
      }
      toastError(getApiErrorMessage(error, 'Unable to save product.'))
    }
  }

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="page-shell">
      <PageHeader
        title="Products & Inventory"
        subtitle="Manage construction equipment, tools and stock"
        breadcrumbs={[{ label: 'Products' }]}
      />

      <ProductStats products={products} />

      <ProductFilters
        search={filters.search}
        onSearch={(v) => setFilter('search', v)}
        category={filters.category}
        onCategory={(v) => setFilter('category', v)}
        stockStatus={filters.stockStatus}
        onStockStatus={(v) => setFilter('stockStatus', v)}
        condition={filters.condition}
        onCondition={(v) => setFilter('condition', v)}
        availability={filters.availability}
        onAvailability={(v) => setFilter('availability', v)}
        priceRange={filters.priceRange}
        onPriceRange={(v) => setFilter('priceRange', v)}
        sortBy={filters.sortBy}
        onSortBy={(v) => setFilter('sortBy', v)}
        inventory={filters.inventory}
        onInventory={(v) => setFilter('inventory', v)}
        categories={categories}
        onReset={() => setFilters(defaultFilters)}
      />

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <div>
            <h3 className="font-display font-semibold">Product Inventory</h3>
            <p className="text-sm text-slate-500">{filtered.length} products</p>
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading products..." />
        ) : productsError ? (
          <ApiErrorState
            title="Unable to load products. Please try again."
            message={productsError}
            onRetry={loadProducts}
          />
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No products found."
              description="Try adjusting your search or filters, or add a new product."
              action={
                <button type="button" className="btn-primary" onClick={openCreate}>
                  <Plus size={16} /> Add Product
                </button>
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <ProductTable
                products={paged.data}
                onEdit={canEdit ? openEdit : undefined}
                onTransfer={canEdit ? setTransferTarget : undefined}
                onDelete={canDelete ? setDeleteTarget : undefined}
              />
            </div>
            <div className="grid gap-3 p-4 md:hidden">
              {paged.data.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onEdit={canEdit ? openEdit : undefined}
                  onTransfer={canEdit ? setTransferTarget : undefined}
                  onDelete={canDelete ? setDeleteTarget : undefined}
                />
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

      <Modal
        open={purposeChooserOpen}
        onClose={() => setPurposeChooserOpen(false)}
        title="Add Product"
        size="sm"
      >
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Is this product being added for sale or for rent?</p>
        <div className="space-y-2">
          {PRODUCT_PURPOSES.map(({ value, label, description, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => startCreate(value)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-brand-500 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:border-slate-700 dark:hover:bg-brand-950/30"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                <Icon size={18} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-slate-900 dark:text-white">{label}</span>
                <span className="block text-xs text-slate-500">{description}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden />
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Product' : purpose === 'rent' ? 'Add Product for Rent' : purpose === 'sale' ? 'Add Product for Sale' : 'Add Product'}
        size="lg"
      >
        <ProductForm
          form={form}
          errors={errors}
          categories={categories}
          onChange={setForm}
          onCancel={() => setModalOpen(false)}
          onSubmit={handleSubmit}
          submitLabel={editing ? 'Update Product' : 'Save Product'}
          purpose={editing ? undefined : purpose}
        />
      </Modal>

      <TransferToSaleDialog product={transferTarget} onClose={() => setTransferTarget(null)} />

      <DeleteConfirmation
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        productName={deleteTarget?.name}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            const result = await deleteProduct(deleteTarget.id)
            success(result.message || 'Product removed.')
            setDeleteTarget(null)
          } catch (error) {
            toastError(getApiErrorMessage(error, 'Unable to delete product.'))
          }
        }}
      />
    </div>
  )
}
