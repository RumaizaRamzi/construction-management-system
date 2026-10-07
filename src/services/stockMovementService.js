import api, { unwrapApiData } from './api'
import fetchAllPages from './fetchAllPages'

function mapStockMovementFromApi(record) {
  if (!record) return null
  return {
    id: record.id,
    productId: record.product_id ?? record.productId,
    product: record.product || record.product_name || '',
    product_serial_number: record.product_serial_number || '',
    type: record.type || record.movement_type || '',
    movementType: record.movement_type || record.movementType || '',
    quantity: Number(record.quantity || 0),
    previousQuantity: Number(record.previous_quantity ?? record.previousQuantity ?? 0),
    newQuantity: Number(record.new_quantity ?? record.newQuantity ?? 0),
    balance: Number(record.balance ?? record.new_quantity ?? record.newQuantity ?? 0),
    reference: record.reference || record.reason || '—',
    reason: record.reason || '',
    user: record.user || 'System',
    date: record.date || (record.created_at ? String(record.created_at).slice(0, 10) : ''),
    createdAt: record.created_at || null,
    referenceNumber: record.reference_number || null,
    relatedSale: record.related_sale
      ? { id: record.related_sale.id, invoiceNumber: record.related_sale.invoice_number }
      : null,
    relatedRental: record.related_rental
      ? { id: record.related_rental.id, rentalNumber: record.related_rental.rental_number }
      : null,
    relatedPurchase: record.related_purchase
      ? { id: record.related_purchase.id, purchaseNumber: record.related_purchase.purchase_number }
      : null,
    notes: record.notes ?? record.reason ?? null,
  }
}

function mapProductStockSummary(record = {}) {
  return {
    productId: Number(record.product_id),
    movementsCount: Number(record.movements_count || 0),
    totalIn: Number(record.total_in || 0),
    totalOut: Number(record.total_out || 0),
    lastMovementAt: record.last_movement_at || null,
  }
}

/** Readable labels for stored movement_type values (the stored values are never changed). */
export const MOVEMENT_TYPE_LABELS = {
  PURCHASE: 'Purchase',
  SALE: 'Sale',
  SALE_ADJUST: 'Sale Adjustment',
  SALE_CANCEL: 'Sale Cancelled',
  SALE_CANCELLED: 'Sale Cancelled',
  RESTOCK: 'Restock',
  RENTAL_OUT: 'Rental Out',
  RENTAL_RETURN: 'Rental Return',
  DAMAGE: 'Damaged',
  MISSING: 'Missing',
  ADJUSTMENT: 'Stock Adjustment',
  MAINTENANCE: 'Maintenance',
  TRANSFER_TO_SALE: 'Transfer to Sale',
  PURCHASE_ADJUST: 'Purchase Edited',
  PURCHASE_CANCEL: 'Purchase Cancelled',
}

export const movementTypeLabel = (type) =>
  MOVEMENT_TYPE_LABELS[type] ||
  String(type || '—')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

export const stockMovementService = {
  async getStockMovements(params) {
    const rows = await fetchAllPages('/stock-movements', params)
    return rows.map(mapStockMovementFromApi).filter(Boolean)
  },

  async getStockMovementsPage(params = {}) {
    const response = await api.get('/stock-movements', { params })
    const payload = unwrapApiData(response)
    const rows = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : []
    return {
      rows: rows.map(mapStockMovementFromApi).filter(Boolean),
      meta: payload?.meta || payload || {},
      message: response.data?.message,
    }
  },

  async getProductSummaries() {
    const response = await api.get('/stock-movements/summary')
    const rows = unwrapApiData(response)
    return (Array.isArray(rows) ? rows : []).map(mapProductStockSummary)
  },

  async getProductStockHistory(productId, params = {}) {
    const response = await api.get(`/products/${productId}/stock-history`, { params })
    const payload = unwrapApiData(response) || {}
    const page = payload.movements || {}
    const p = payload.product || {}
    const s = payload.summary || {}
    return {
      product: {
        id: p.id,
        name: p.name || '',
        serial_number: p.serial_number || '',
        category: p.category || '',
        unit: p.unit || '',
        status: p.status || '',
        quantity: Number(p.quantity || 0),
        available: Number(p.available_quantity || 0),
        rented: Number(p.rented_quantity || 0),
        minStock: Number(p.minimum_stock || 0),
      },
      summary: {
        currentStock: Number(s.current_stock || 0),
        availableStock: Number(s.available_stock || 0),
        rentedStock: Number(s.rented_stock || 0),
        totalIn: Number(s.total_in || 0),
        totalOut: Number(s.total_out || 0),
        movementsCount: Number(s.movements_count || 0),
        lastMovementAt: s.last_movement_at || null,
      },
      movements: (Array.isArray(page.data) ? page.data : []).map(mapStockMovementFromApi).filter(Boolean),
      meta: {
        page: Number(page.current_page || 1),
        totalPages: Number(page.last_page || 1),
        total: Number(page.total || 0),
      },
    }
  },
}

export default stockMovementService
