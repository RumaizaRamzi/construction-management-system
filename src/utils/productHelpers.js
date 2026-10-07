/**
 * Product / inventory helpers for frontend-only stock simulation.
 */

export const getStockStatus = (product) => {
  if (!product) return 'Out of Stock'
  if (product.status === 'Maintenance') return 'Maintenance'
  if (product.status === 'Rented' && product.available === 0) return 'Rented'
  if (Number(product.available) === 0) return 'Out of Stock'
  if (Number(product.available) <= Number(product.minStock || 0)) return 'Low Stock'
  return 'Available'
}

export const deriveProductStatus = (product) => getStockStatus(product)

/** listingType: 'both' (default for existing products), 'rent', 'sale' or 'none' (bought, not listed yet). */
export const LISTING_TYPE_LABELS = {
  both: 'Sale & Rent',
  rent: 'For Rent',
  sale: 'For Sale',
  none: 'Not listed yet',
}

export const getListingLabel = (product) => LISTING_TYPE_LABELS[product?.listingType] || LISTING_TYPE_LABELS.both

export const isListedForRent = (product) => Boolean(product) && !['sale', 'none'].includes(product.listingType)

export const isListedForSale = (product) => Boolean(product) && !['rent', 'none'].includes(product.listingType)

export const canTransferToSale = (product) => Boolean(product) && product.listingType !== 'sale'

export const getProductStats = (products = []) => {
  const totalProducts = products.length
  const totalStockItems = products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0)
  const availableItems = products.reduce((sum, p) => sum + (Number(p.available) || 0), 0)
  const lowStockItems = products.filter((p) => getStockStatus(p) === 'Low Stock').length
  const outOfStockItems = products.filter((p) => getStockStatus(p) === 'Out of Stock').length
  return { totalProducts, totalStockItems, availableItems, lowStockItems, outOfStockItems }
}

export const applySaleToProduct = (product, qty = 1) => {
  const amount = Math.max(1, Number(qty) || 1)
  const available = Math.max(0, (product.available || 0) - amount)
  const sold = (product.sold || 0) + amount
  const updated = {
    ...product,
    available,
    sold,
    totalSales: (product.totalSales || 0) + amount,
    totalSalesIncome: (product.totalSalesIncome || 0) + amount * (product.salePrice || 0),
  }
  return { ...updated, status: getStockStatus(updated) }
}

/** Restore inventory when a sale is deleted, cancelled, or refunded. */
export const restoreSaleToProduct = (product, qty = 1) => {
  const amount = Math.max(1, Number(qty) || 1)
  const sold = Math.max(0, (product.sold || 0) - amount)
  const available = Math.min(product.quantity || 0, (product.available || 0) + amount)
  const updated = {
    ...product,
    available,
    sold,
    totalSales: Math.max(0, (product.totalSales || 0) - amount),
    totalSalesIncome: Math.max(0, (product.totalSalesIncome || 0) - amount * (product.salePrice || 0)),
  }
  return { ...updated, status: getStockStatus(updated) }
}

export const applyRentalToProduct = (product, qty = 1) => {
  const amount = Math.max(1, Number(qty) || 1)
  const available = Math.max(0, (product.available || 0) - amount)
  const rented = (product.rented || 0) + amount
  const updated = {
    ...product,
    available,
    rented,
    totalRentals: (product.totalRentals || 0) + 1,
    totalRentalIncome: (product.totalRentalIncome || 0) + amount * (product.rentalPrice || 0),
  }
  return { ...updated, status: getStockStatus(updated) }
}

/** Restore inventory when rental is cancelled/deleted without completing a return. */
export const restoreRentalToProduct = (product, qty = 1) => {
  const amount = Math.max(1, Number(qty) || 1)
  const rented = Math.max(0, (product.rented || 0) - amount)
  const available = Math.min(product.quantity || 0, (product.available || 0) + amount)
  const updated = {
    ...product,
    available,
    rented,
    totalRentals: Math.max(0, (product.totalRentals || 0) - 1),
  }
  return { ...updated, status: getStockStatus(updated) }
}

export const applyReturnToProduct = (product, qty = 1) => {
  const amount = Math.max(1, Number(qty) || 1)
  const rented = Math.max(0, (product.rented || 0) - amount)
  const available = Math.min(product.quantity || 0, (product.available || 0) + amount)
  const updated = { ...product, available, rented }
  return { ...updated, status: getStockStatus(updated) }
}

export const emptyProductForm = (defaultImage) => ({
  name: '',
  serial_number: '',
  categoryId: '',
  category: '',
  description: '',
  unit: 'Unit',
  quantity: '',
  available: '',
  minStock: '',
  purchaseCost: '',
  salePrice: '',
  rentalPrice: '',
  condition: 'New',
  location: '',
  branchId: '',
  status: 'Available',
  image: defaultImage || '',
})

export const validateProductForm = (form) => {
  const errors = {}
  if (!form.name?.trim()) errors.name = 'Product name is required'
  if (!form.serial_number?.trim()) errors.serial_number = 'Serial number is required'
  if (!form.categoryId && !form.category) errors.category = 'Category is required'
  if (form.quantity === '' || Number(form.quantity) < 0) errors.quantity = 'Valid quantity is required'
  if (form.minStock === '' || Number(form.minStock) < 0) errors.minStock = 'Minimum stock is required'
  if (form.purchaseCost !== '' && form.purchaseCost != null && Number(form.purchaseCost) < 0) {
    errors.purchaseCost = 'Purchase cost cannot be negative'
  }
  if (form.salePrice !== '' && form.salePrice != null && Number(form.salePrice) < 0) {
    errors.salePrice = 'Sale price cannot be negative'
  }
  if (form.rentalPrice !== '' && form.rentalPrice != null && Number(form.rentalPrice) < 0) {
    errors.rentalPrice = 'Rental price cannot be negative'
  }
  if (!form.condition) errors.condition = 'Condition is required'
  if (!form.status) errors.status = 'Status is required'
  return errors
}

export const USAGE_TIMELINE = ['Purchased', 'Available', 'Rented', 'Returned', 'Maintenance', 'Available']
