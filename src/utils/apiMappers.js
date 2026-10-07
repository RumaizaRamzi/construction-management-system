/**
 * Normalize Laravel API records into the field shapes used by the React UI.
 */

const PRODUCT_PLACEHOLDER = '/images/product-1.svg'

const toNumber = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** Branch is optional: omitted key leaves it unchanged, empty value clears it. */
const branchIdToApi = (record) => {
  if (!record || !('branchId' in record)) return record?.branch_id
  return record.branchId != null && record.branchId !== '' ? Number(record.branchId) : null
}

export function mapBranchFromApi(record) {
  if (!record) return null
  return {
    id: record.id,
    name: record.name || '',
    code: record.code || '',
    address: record.address || '',
    phone: record.phone || '',
    status: record.status || 'Active',
  }
}

export function mapBranchToApi(branch) {
  if (!branch) return {}
  return {
    name: branch.name?.trim(),
    code: branch.code?.trim() || null,
    address: branch.address?.trim() || null,
    phone: branch.phone?.trim() || null,
    status: branch.status || 'Active',
  }
}

const optionalNumber = (value) => (value == null || value === '' ? null : toNumber(value, null))
const optionalText = (value) => (typeof value === 'string' ? value.trim() || null : value ?? null)

export function mapVehicleFromApi(record) {
  if (!record) return null
  return {
    id: record.id,
    vehicleCode: record.vehicle_code || '',
    name: record.name || '',
    category: record.category || '',
    registrationNumber: record.registration_number || '',
    brand: record.brand || '',
    model: record.model || '',
    manufactureYear: record.manufacture_year ?? null,
    purchaseDate: record.purchase_date || '',
    purchaseCost: optionalNumber(record.purchase_cost),
    dailyRate: optionalNumber(record.daily_rate),
    weeklyRate: optionalNumber(record.weekly_rate),
    monthlyRate: optionalNumber(record.monthly_rate),
    branchId: record.branch_id ?? null,
    hasPhoto: Boolean(record.has_photo),
    description: record.description || '',
    status: record.status || 'Available',
    createdAt: record.created_at || '',
    updatedAt: record.updated_at || '',
  }
}

export function mapVehicleToApi(vehicle) {
  if (!vehicle) return {}
  return {
    name: vehicle.name?.trim(),
    category: vehicle.category?.trim(),
    registration_number: vehicle.registrationNumber?.trim(),
    brand: optionalText(vehicle.brand),
    model: optionalText(vehicle.model),
    manufacture_year: optionalNumber(vehicle.manufactureYear),
    purchase_date: vehicle.purchaseDate || null,
    purchase_cost: optionalNumber(vehicle.purchaseCost),
    daily_rate: optionalNumber(vehicle.dailyRate),
    weekly_rate: optionalNumber(vehicle.weeklyRate),
    monthly_rate: optionalNumber(vehicle.monthlyRate),
    branch_id: branchIdToApi(vehicle),
    description: optionalText(vehicle.description),
    status: vehicle.status || undefined,
  }
}

export function mapVehicleRentalFromApi(record) {
  if (!record) return null
  return {
    id: record.id,
    rentalNumber: record.rental_number || '',
    vehicleId: record.vehicle_id,
    vehicleName: record.vehicle_name || '',
    vehicleRegistration: record.vehicle_registration || '',
    customerId: record.customer_id,
    customerName: record.customer_name || '',
    customerPhone: record.customer_phone || '',
    startDate: record.start_date || '',
    expectedReturnDate: record.expected_return_date || '',
    actualReturnDate: record.actual_return_date || '',
    rateType: record.rate_type || 'Daily',
    rentalRate: toNumber(record.rental_rate),
    rentalDays: toNumber(record.rental_days, 1),
    billedUnits: toNumber(record.billed_units, 1),
    totalAmount: toNumber(record.total_amount),
    securityDeposit: toNumber(record.security_deposit),
    paidAmount: toNumber(record.paid_amount),
    balance: toNumber(record.balance),
    paymentStatus: record.payment_status || 'Pending',
    status: record.status || 'Active',
    notes: record.notes || '',
    createdAt: record.created_at || '',
  }
}

export function mapVehicleRentalToApi(rental) {
  if (!rental) return {}
  const payload = {
    customer_id: rental.customerId ? Number(rental.customerId) : undefined,
    start_date: rental.startDate || undefined,
    expected_return_date: rental.expectedReturnDate || null,
    rate_type: rental.rateType || 'Daily',
    rental_rate: optionalNumber(rental.rentalRate),
    security_deposit: optionalNumber(rental.securityDeposit) ?? 0,
    paid_amount: optionalNumber(rental.paidAmount) ?? 0,
    notes: optionalText(rental.notes),
  }
  if ('vehicleId' in rental) payload.vehicle_id = rental.vehicleId ? Number(rental.vehicleId) : undefined
  if ('actualReturnDate' in rental) payload.actual_return_date = rental.actualReturnDate || null
  if (rental.status) payload.status = rental.status
  return payload
}

export function mapVehicleMaintenanceFromApi(record) {
  if (!record) return null
  return {
    id: record.id,
    maintenanceNumber: record.maintenance_number || '',
    vehicleId: record.vehicle_id,
    vehicleName: record.vehicle_name || '',
    vehicleRegistration: record.vehicle_registration || '',
    maintenanceDate: record.maintenance_date || '',
    maintenanceType: record.maintenance_type || '',
    description: record.description || '',
    partsCost: toNumber(record.parts_cost),
    labourCost: toNumber(record.labour_cost),
    totalCost: toNumber(record.total_cost),
    nextMaintenanceDate: record.next_maintenance_date || '',
    meterReading: optionalNumber(record.meter_reading),
    meterUnit: record.meter_unit || '',
    serviceProvider: record.service_provider || '',
    hasReceipt: Boolean(record.has_receipt),
    receiptName: record.receipt_name || '',
    notes: record.notes || '',
    status: record.status || 'Scheduled',
    createdAt: record.created_at || '',
  }
}

export function mapVehicleMaintenanceToApi(record) {
  if (!record) return {}
  const payload = {
    maintenance_date: record.maintenanceDate || undefined,
    maintenance_type: record.maintenanceType || undefined,
    description: optionalText(record.description),
    parts_cost: optionalNumber(record.partsCost) ?? 0,
    labour_cost: optionalNumber(record.labourCost) ?? 0,
    next_maintenance_date: record.nextMaintenanceDate || null,
    meter_reading: optionalNumber(record.meterReading),
    meter_unit: record.meterUnit || null,
    service_provider: optionalText(record.serviceProvider),
    notes: optionalText(record.notes),
    status: record.status || undefined,
  }
  if ('vehicleId' in record) payload.vehicle_id = record.vehicleId ? Number(record.vehicleId) : undefined
  return payload
}

export function mapCategoryFromApi(record) {
  if (!record) return null
  return {
    id: record.id,
    name: record.name || '',
    description: record.description || '',
    status: record.status || 'Active',
    productCount: toNumber(record.products_count ?? record.productCount, 0),
  }
}

export function mapCategoryToApi(category) {
  if (!category) return {}
  return {
    name: category.name?.trim(),
    description: category.description?.trim() || null,
    status: category.status || 'Active',
  }
}

export function mapProductFromApi(record) {
  if (!record) return null

  const categoryName =
    (typeof record.category === 'object' && record.category?.name) ||
    (typeof record.category === 'string' ? record.category : '') ||
    ''

  const supplierName =
    (typeof record.supplier === 'object' && record.supplier?.name) ||
    (typeof record.supplier === 'string' ? record.supplier : '') ||
    ''

  const available = toNumber(record.available_quantity ?? record.available, 0)
  const rented = toNumber(record.rented_quantity ?? record.rented, 0)
  const quantity = toNumber(record.quantity, available + rented)
  const minStock = toNumber(record.minimum_stock ?? record.minStock, 0)

  const stockMovements = Array.isArray(record.stock_movements)
    ? record.stock_movements
    : Array.isArray(record.stockMovements)
      ? record.stockMovements
      : []

  return {
    id: record.id,
    serial_number: record.serial_number || '',
    name: record.name || '',
    categoryId: record.category_id ?? record.categoryId ?? null,
    category: categoryName,
    supplierId: record.supplier_id ?? record.supplierId ?? null,
    supplier: supplierName,
    quantity,
    available,
    rented,
    sold: toNumber(record.sold, 0),
    unit: record.unit || '',
    purchaseCost: toNumber(record.purchase_price ?? record.purchaseCost, 0),
    purchaseCostSet: (record.purchase_price ?? record.purchaseCost) != null,
    salePrice: toNumber(record.sale_price ?? record.salePrice, 0),
    rentalPrice: toNumber(record.rental_price ?? record.rentalPrice, 0),
    condition: record.condition || 'Used',
    status: record.status || 'Available',
    listingType: record.listing_type || record.listingType || 'both',
    image: record.image || PRODUCT_PLACEHOLDER,
    description: record.description || '',
    location: record.location || '',
    branchId: record.branch_id ?? null,
    minStock,
    totalRentals: toNumber(record.totalRentals, 0),
    totalSales: toNumber(record.totalSales, 0),
    totalRentalIncome: toNumber(record.totalRentalIncome, 0),
    totalSalesIncome: toNumber(record.totalSalesIncome, 0),
    usageHistory: Array.isArray(record.usageHistory) ? record.usageHistory : [],
    recentActivity: Array.isArray(record.recentActivity) ? record.recentActivity : [],
    stockMovements,
    maintenanceRecords: record.maintenance_records || record.maintenanceRecords || [],
    equipmentChecks: record.equipment_checks || record.equipmentChecks || [],
  }
}

export function mapProductToApi(product) {
  if (!product) return {}
  return {
    name: product.name?.trim(),
    serial_number: product.serial_number || undefined,
    category_id: product.categoryId != null && product.categoryId !== ''
      ? Number(product.categoryId)
      : product.category_id ?? null,
    supplier_id: product.supplierId != null && product.supplierId !== ''
      ? Number(product.supplierId)
      : product.supplier_id ?? undefined,
    description: product.description?.trim() || null,
    image: product.image || null,
    quantity: product.quantity != null ? Number(product.quantity) : undefined,
    available_quantity: product.available != null ? Number(product.available) : undefined,
    minimum_stock: product.minStock != null ? Number(product.minStock) : product.minimum_stock != null ? Number(product.minimum_stock) : undefined,
    purchase_price: 'purchaseCost' in product
      ? product.purchaseCost === '' || product.purchaseCost == null || product.purchaseCostSet === false
        ? null
        : Number(product.purchaseCost)
      : product.purchase_price != null ? Number(product.purchase_price) : undefined,
    sale_price: product.salePrice != null ? Number(product.salePrice) : product.sale_price != null ? Number(product.sale_price) : undefined,
    rental_price: product.rentalPrice != null ? Number(product.rentalPrice) : product.rental_price != null ? Number(product.rental_price) : undefined,
    unit: 'unit' in product ? product.unit || null : undefined,
    condition: product.condition || undefined,
    location: product.location?.trim() || null,
    branch_id: branchIdToApi(product),
    status: product.status || undefined,
    listing_type: product.listingType || undefined,
  }
}

export function mapSupplierFromApi(record) {
  if (!record) return null
  return {
    id: record.id,
    supplierCode: record.supplier_code || record.supplierCode || '',
    name: record.name || '',
    contact: record.contact_person || record.contact || '',
    email: record.email || '',
    phone: record.phone || '',
    address: record.address || '',
    companyName: record.company_name || record.companyName || record.name || '',
    status: record.status || 'Active',
    productsSupplied: record.products_supplied || record.productsSupplied || '',
    purchaseHistory: toNumber(record.purchase_history ?? record.purchaseHistory, 0),
    outstanding: toNumber(record.outstanding, 0),
    notes: record.notes || '',
    productCount: toNumber(record.products_count ?? record.productCount, 0),
  }
}

export function mapSupplierToApi(supplier) {
  if (!supplier) return {}
  return {
    name: supplier.name?.trim(),
    supplier_code: supplier.supplierCode || supplier.supplier_code || undefined,
    phone: supplier.phone?.trim() || null,
    email: supplier.email?.trim() || null,
    address: supplier.address?.trim() || null,
    company_name: supplier.companyName || supplier.company_name || supplier.name?.trim(),
    contact_person: supplier.contact || supplier.contact_person || null,
    products_supplied: supplier.productsSupplied || supplier.products_supplied || null,
    status: supplier.status || 'Active',
    outstanding: supplier.outstanding != null ? Number(supplier.outstanding) : undefined,
    notes: supplier.notes?.trim() || null,
  }
}

export function mapCustomerFromApi(record) {
  if (!record) return null
  return {
    id: record.id,
    customerCode: record.customer_code || record.customerCode || '',
    name: record.name || '',
    companyName: record.company_name || record.companyName || record.name || '',
    phone: record.phone || '',
    email: record.email || '',
    address: record.address || '',
    city: record.city || '',
    customerType: record.customer_type || record.customerType || 'Company',
    status: record.status || 'Active',
    notes: record.notes || '',
    idNumber: record.id_number || record.idNumber || '',
    hasIdPhoto: Boolean(record.has_id_photo ?? record.hasIdPhoto),
    totalPurchases: toNumber(record.total_purchases ?? record.totalPurchases, 0),
    totalRentals: toNumber(record.total_rentals ?? record.totalRentals, 0),
    pendingPayment: toNumber(record.pending_payment ?? record.pendingPayment, 0),
  }
}

export function mapCustomerToApi(customer) {
  if (!customer) return {}
  return {
    customer_code: customer.customerCode || customer.customer_code || undefined,
    name: customer.name?.trim(),
    company_name: customer.companyName || customer.company_name || customer.name?.trim(),
    phone: customer.phone?.trim() || null,

    email: customer.email?.trim() || null,
    address: customer.address?.trim() || null,
    city: customer.city?.trim() || null,
    customer_type: customer.customerType || customer.customer_type || 'Company',
    status: customer.status || 'Active',
    notes: customer.notes?.trim() || null,
    id_number: customer.idNumber?.trim() || null,
  }
}

export function mapSaleItemFromApi(record) {
  if (!record) return null
  const product = typeof record.product === 'object' ? record.product : null
  const productName =
    product?.name ||
    record.product_name ||
    record.productName ||
    (typeof record.product === 'string' ? record.product : '') ||
    ''
  const lineTotal = toNumber(record.subtotal ?? record.total, 0)
  return {
    id: record.id,
    productId: record.product_id ?? record.productId ?? product?.id ?? null,
    productName,
    serial_number: product?.serial_number || record.serial_number || '',
    quantity: toNumber(record.quantity, 0),
    unitPrice: toNumber(record.unit_price ?? record.unitPrice, 0),
    discount: toNumber(record.discount, 0),
    total: lineTotal,
    subtotal: lineTotal,
  }
}

export function mapSaleFromApi(record) {
  if (!record) return null

  const customer = typeof record.customer === 'object' ? record.customer : null
  const items = Array.isArray(record.items)
    ? record.items.map(mapSaleItemFromApi).filter(Boolean)
    : []

  const tax = toNumber(record.tax, 0)
  const subtotal = toNumber(record.subtotal, 0)
  const discount = toNumber(record.discount, 0)
  const taxable = Math.max(0, subtotal - discount)
  const taxRate =
    record.tax_rate != null || record.taxRate != null
      ? toNumber(record.tax_rate ?? record.taxRate, 0)
      : taxable > 0
        ? Math.round((tax / taxable) * 10000) / 100
        : 0

  return {
    id: record.id,
    invoiceNumber: record.invoice_number || record.invoiceNumber || '',
    customerId: record.customer_id ?? record.customerId ?? customer?.id ?? null,
    customer:
      customer?.name ||
      record.customer_name ||
      (typeof record.customer === 'string' ? record.customer : '') ||
      '',
    customerPhone: record.customer_phone || customer?.phone || '',
    customerEmail: record.customer_email || customer?.email || '',
    customerAddress: record.customer_address || customer?.address || '',
    date: record.sale_date || record.date || '',
    items,
    products:
      record.products ||
      items.map((i) => i.productName).filter(Boolean).join(', '),
    quantity: toNumber(
      record.quantity,
      items.reduce((sum, i) => sum + Number(i.quantity || 0), 0)
    ),
    subtotal,
    discount,
    tax,
    taxRate,
    total: toNumber(record.total_amount ?? record.total, 0),
    amountPaid: toNumber(record.paid_amount ?? record.amountPaid ?? record.paidAmount, 0),
    balance: toNumber(record.balance ?? record.balance_amount, 0),
    paymentStatus: record.payment_status || record.paymentStatus || 'Pending',
    paymentMethod: record.payment_method || record.paymentMethod || '',
    paymentDate: record.payment_date || record.paymentDate || '',
    saleStatus: record.sale_status || record.saleStatus || 'Pending',
    notes: record.notes || '',
    branchId: record.branch_id ?? null,
    orderDiscount: toNumber(
      record.order_discount ?? record.orderDiscount,
      Math.max(0, discount - items.reduce((sum, i) => sum + Number(i.discount || 0), 0))
    ),
    payments: Array.isArray(record.payments)
      ? record.payments.map((p) => ({
          id: p.id,
          paymentDate: p.payment_date || '',
          amount: toNumber(p.amount, 0),
          paymentMethod: p.payment_method || '',
          reference: p.reference || '',
          notes: p.notes || '',
        }))
      : [],
    unrecordedPaidAmount: toNumber(record.unrecorded_paid_amount, 0),
  }
}

/** Map UI sale / form payload to Laravel create/update body. */
export function mapSaleToApi(sale) {
  if (!sale) return {}

  const items = Array.isArray(sale.items)
    ? sale.items.map((item) => ({
        product_id: Number(item.productId ?? item.product_id),
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unitPrice ?? item.unit_price ?? 0),
        discount: Number(item.discount || 0),
      }))
    : undefined

  const orderDiscount =
    sale.orderDiscount != null
      ? Number(sale.orderDiscount)
      : sale.formDiscount != null
        ? Number(sale.formDiscount)
        : undefined

  return {
    invoice_number: sale.invoiceNumber || sale.invoice_number || undefined,
    customer_id: sale.customerId != null ? Number(sale.customerId) : undefined,
    sale_date: sale.date || sale.sale_date || sale.saleDate || undefined,
    items,
    discount: orderDiscount,
    tax_rate:
      sale.taxRate != null
        ? Number(sale.taxRate)
        : sale.tax_rate != null
          ? Number(sale.tax_rate)
          : undefined,
    paid_amount:
      sale.amountPaid != null
        ? Number(sale.amountPaid)
        : sale.paid_amount != null
          ? Number(sale.paid_amount)
          : undefined,
    payment_method: sale.paymentMethod || sale.payment_method || undefined,
    payment_date: sale.paymentDate || sale.payment_date || undefined,
    sale_status: sale.saleStatus || sale.sale_status || undefined,
    notes: sale.notes || undefined,
    branch_id: branchIdToApi(sale),
  }
}

export function mapRentalItemFromApi(record) {
  if (!record) return null
  const product = typeof record.product === 'object' ? record.product : null
  return {
    id: record.id,
    rentalId: record.rental_id ?? record.rentalId,
    productId: record.product_id ?? record.productId ?? product?.id,
    product: product?.name || record.product_name || record.product || '',
    product_serial_number: product?.serial_number || record.product_serial_number || '',
    productCategory: product?.category || record.product_category || '',
    productImage: product?.image || record.product_image || '',
    productCondition: product?.condition || record.product_condition || '',
    quantity: toNumber(record.quantity, 0),
    rate: toNumber(record.rental_rate ?? record.rate, 0),
    rentalRate: toNumber(record.rental_rate ?? record.rate, 0),
    rentalDays: toNumber(record.rental_days ?? record.rentalDays, 0),
    subtotal: toNumber(record.subtotal ?? record.total, 0),
    total: toNumber(record.subtotal ?? record.total, 0),
  }
}

export function mapRentalPaymentFromApi(record) {
  if (!record) return null
  return {
    id: record.id,
    rentalId: record.rental_id ?? record.rentalId,
    paymentDate: record.payment_date || record.paymentDate || '',
    amount: toNumber(record.amount, 0),
    paymentMethod: record.payment_method || record.paymentMethod || '',
    referenceNumber: record.reference_number || record.reference || record.referenceNumber || '',
    reference: record.reference || record.reference_number || '',
    notes: record.notes || '',
  }
}

export function mapRentalReturnFromApi(record) {
  if (!record) return null
  return {
    id: record.id,
    rentalId: record.rental_id ?? record.rentalId,
    returnDate: record.return_date || record.returnDate || '',
    returnedQuantity: toNumber(record.returned_quantity ?? record.returnedQty ?? record.returnedQuantity, 0),
    returnedQty: toNumber(record.returned_quantity ?? record.returnedQty ?? record.returnedQuantity, 0),
    damagedQuantity: toNumber(record.damaged_quantity ?? record.damagedQty ?? record.damagedQuantity, 0),
    damagedQty: toNumber(record.damaged_quantity ?? record.damagedQty ?? record.damagedQuantity, 0),
    missingQuantity: toNumber(record.missing_quantity ?? record.missingQty ?? record.missingQuantity, 0),
    missingQty: toNumber(record.missing_quantity ?? record.missingQty ?? record.missingQuantity, 0),
    condition: record.condition || '',
    lateDays: toNumber(record.late_days ?? record.lateDays, 0),
    lateFee: toNumber(record.late_fee ?? record.lateFee, 0),
    damageFee: toNumber(record.damage_fee ?? record.damageFee, 0),
    depositRefund: toNumber(record.deposit_refund ?? record.depositRefund, 0),
    status: record.status || '',
    notes: record.notes || '',
    items: Array.isArray(record.items)
      ? record.items.map((line) => ({
          rentalItemId: line.rental_item_id ?? null,
          productId: line.product_id ?? null,
          productName: line.product_name || '',
          returnedQty: toNumber(line.returned_quantity, 0),
          damagedQty: toNumber(line.damaged_quantity, 0),
          missingQty: toNumber(line.missing_quantity, 0),
        }))
      : [],
  }
}

function buildRentalTimeline(record) {
  if (Array.isArray(record.timeline) && record.timeline.length) return record.timeline

  const start = record.start_date || record.startDate || ''
  const expected = record.expected_return_date || record.expectedReturn || ''
  const actual = record.actual_return_date || record.actualReturnDate || ''
  const status = record.status || record.rental_status || record.rentalStatus || 'Pending'
  const events = [
    { id: 1, event: 'Booking Created', date: start },
  ]

  if (status !== 'Pending') {
    events.push({ id: 2, event: 'Booking Confirmed', date: start })
  }
  if (['Active', 'Overdue', 'Returned', 'Maintenance'].includes(status)) {
    events.push(
      { id: 3, event: 'Equipment Collected / Delivered', date: start },
      { id: 4, event: 'Rental Active', date: start },
      { id: 5, event: 'Return Due', date: expected }
    )
  }
  if (['Returned', 'Maintenance'].includes(status) && actual) {
    events.push(
      { id: 6, event: 'Returned', date: actual },
      { id: 7, event: 'Inspection Completed', date: actual }
    )
  }
  return events
}

export function mapRentalFromApi(record) {
  if (!record) return null

  const customer = typeof record.customer === 'object' ? record.customer : null
  const items = Array.isArray(record.items)
    ? record.items.map(mapRentalItemFromApi).filter(Boolean)
    : []
  const first = items[0] || null
  const payments = Array.isArray(record.payments)
    ? record.payments.map(mapRentalPaymentFromApi).filter(Boolean)
    : []
  const returns = Array.isArray(record.returns)
    ? record.returns.map(mapRentalReturnFromApi).filter(Boolean)
    : []
  const latestReturn = returns.length ? returns[returns.length - 1] : null

  const rentalNumber = record.rental_number || record.rentalNumber || record.rentalId || ''
  const duration = toNumber(
    record.rental_days ?? record.duration ?? first?.rentalDays,
    0
  )

  return {
    id: record.id,
    rentalId: rentalNumber,
    rentalNumber,
    customerId: record.customer_id ?? record.customerId ?? customer?.id ?? null,
    customer:
      customer?.name ||
      record.customer_name ||
      (typeof record.customer === 'string' ? record.customer : '') ||
      '',
    customerPhone: record.customer_phone || customer?.phone || '',
    customerEmail: record.customer_email || customer?.email || '',
    customerAddress: record.customer_address || customer?.address || '',
    productId: record.product_id ?? first?.productId ?? null,
    product: record.product_name || first?.product || '',
    product_serial_number: record.product_serial_number || first?.product_serial_number || '',
    productCategory: record.product_category || first?.productCategory || '',
    productImage: record.product_image || first?.productImage || '',
    productCondition: record.product_condition || first?.productCondition || '',
    quantity: toNumber(record.quantity ?? first?.quantity, 0),
    rate: toNumber(record.rental_rate ?? first?.rate, 0),
    startDate: record.start_date || record.startDate || '',
    expectedReturn: record.expected_return_date || record.expectedReturn || '',
    actualReturnDate: record.actual_return_date || record.actualReturnDate || null,
    duration,
    subtotal: toNumber(record.subtotal, 0),
    discount: toNumber(record.discount, 0),
    deposit: toNumber(record.deposit ?? record.deposit_amount, 0),
    depositRefund: toNumber(record.deposit_refund ?? record.depositRefund, 0),
    lateFee: toNumber(record.late_fee ?? record.lateFee, 0),
    damageFee: toNumber(record.damage_fee ?? record.damageFee, 0),
    total: toNumber(record.total_amount ?? record.total, 0),
    amountPaid: toNumber(record.paid_amount ?? record.amountPaid ?? record.paidAmount, 0),
    balance: toNumber(record.balance ?? record.balance_amount, 0),
    paymentStatus: record.payment_status || record.paymentStatus || 'Pending',
    paymentMethod: record.payment_method || record.paymentMethod || '',
    rentalStatus: record.status || record.rental_status || record.rentalStatus || 'Pending',
    notes: record.notes || '',
    specialInstructions: record.special_instructions || record.specialInstructions || '',
    deliveryNotes: record.delivery_notes || record.deliveryNotes || '',
    branchId: record.branch_id ?? null,
    items,
    payments,
    returns,
    returnInfo: latestReturn,
    timeline: buildRentalTimeline(record),
  }
}

export function mapRentalToApi(rental) {
  if (!rental) return {}

  const items =
    Array.isArray(rental.items) && rental.items.length
      ? rental.items.map((item) => ({
          product_id: Number(item.productId ?? item.product_id),
          quantity: Number(item.quantity || 1),
          rental_rate: Number(item.rentalRate ?? item.rate ?? item.rental_rate ?? 0),
        }))
      : rental.productId
        ? [
            {
              product_id: Number(rental.productId),
              quantity: Number(rental.quantity || 1),
              rental_rate: Number(rental.rate ?? rental.rentalRate ?? 0),
            },
          ]
        : undefined

  return {
    customer_id: Number(rental.customerId || rental.customer_id),
    start_date: rental.startDate || rental.start_date,
    expected_return_date:
      'expectedReturn' in rental
        ? rental.expectedReturn || null
        : rental.expected_return_date,
    items,
    product_id: rental.productId ? Number(rental.productId) : undefined,
    quantity: rental.quantity != null ? Number(rental.quantity) : undefined,
    rental_rate: rental.rate != null ? Number(rental.rate) : undefined,
    discount: Number(rental.discount || 0),
    deposit: Number(rental.deposit ?? rental.depositAmount ?? 0),
    deposit_amount: Number(rental.deposit ?? rental.depositAmount ?? 0),
    payment_amount: Number(rental.amountPaid ?? rental.paymentAmount ?? rental.paid_amount ?? 0),
    amount_paid: Number(rental.amountPaid ?? rental.paymentAmount ?? 0),
    payment_method: rental.paymentMethod || rental.payment_method || undefined,
    payment_date: rental.paymentDate || rental.payment_date || rental.startDate || undefined,
    status: rental.rentalStatus || rental.status || undefined,
    rental_status: rental.rentalStatus || rental.status || undefined,
    notes: rental.notes || undefined,
    branch_id: branchIdToApi(rental),
    rental_number: rental.rentalNumber || rental.rentalId || undefined,
  }
}

export function mapBookingItemFromApi(record) {
  if (!record) return null
  const product = typeof record.product === 'object' ? record.product : null
  return {
    id: record.id,
    bookingId: record.booking_id ?? record.bookingId,
    productId: record.product_id ?? record.productId ?? product?.id,
    product: product?.name || record.product_name || record.product || '',
    product_serial_number: product?.serial_number || record.product_serial_number || '',
    productCategory: product?.category || record.product_category || '',
    productImage: product?.image || record.product_image || '',
    quantity: toNumber(record.quantity, 0),
    rentalRate: toNumber(record.rental_rate ?? record.rate, 0),
    rate: toNumber(record.rental_rate ?? record.rate, 0),
    rentalDays: toNumber(record.rental_days ?? record.rentalDays, 0),
    subtotal: toNumber(record.subtotal ?? record.total, 0),
    total: toNumber(record.subtotal ?? record.total, 0),
  }
}

function buildBookingTimeline(record) {
  if (Array.isArray(record.timeline) && record.timeline.length) return record.timeline
  const bookingDate = record.booking_date || record.bookingDate || ''
  const status = record.status || record.booking_status || 'Pending'
  const events = [
    { id: 1, event: 'Booking Created', date: bookingDate },
    { id: 2, event: 'Availability Checked', date: bookingDate },
  ]
  if (['Confirmed', 'Active', 'Completed'].includes(status)) {
    events.push({ id: 3, event: 'Booking Confirmed', date: bookingDate })
  }
  if (['Active', 'Completed'].includes(status)) {
    events.push({ id: 4, event: 'Rental Started', date: record.start_date || record.startDate || bookingDate })
  }
  if (status === 'Completed') {
    events.push({ id: 5, event: 'Completed', date: record.end_date || record.endDate || bookingDate })
  }
  if (status === 'Cancelled') {
    events.push({ id: 6, event: 'Cancelled', date: bookingDate })
  }
  if (status === 'Rejected') {
    events.push({ id: 7, event: 'Rejected', date: bookingDate })
  }
  return events
}

export function mapBookingFromApi(record) {
  if (!record) return null

  const customer = typeof record.customer === 'object' ? record.customer : null
  const items = Array.isArray(record.items)
    ? record.items.map(mapBookingItemFromApi).filter(Boolean)
    : []
  const first = items[0] || null
  const bookingNumber = record.booking_number || record.bookingNumber || record.bookingId || ''
  const duration = toNumber(record.rental_days ?? record.duration ?? first?.rentalDays, 0)
  const total = toNumber(record.estimated_amount ?? record.total ?? record.total_amount, 0)
  const paid = toNumber(record.paid_amount ?? record.paidAmount, 0)

  return {
    id: record.id,
    bookingNumber,
    bookingId: bookingNumber,
    customerId: record.customer_id ?? record.customerId ?? customer?.id ?? null,
    customer:
      customer?.name ||
      record.customer_name ||
      (typeof record.customer === 'string' ? record.customer : '') ||
      '',
    customerPhone: record.customer_phone || customer?.phone || '',
    customerEmail: record.customer_email || customer?.email || '',
    customerAddress: record.customer_address || customer?.address || '',
    productId: record.product_id ?? first?.productId ?? null,
    product: record.product_name || first?.product || '',
    product_serial_number: record.product_serial_number || first?.product_serial_number || '',
    productCategory: record.product_category || first?.productCategory || '',
    productImage: record.product_image || first?.productImage || '',
    quantity: toNumber(record.quantity ?? first?.quantity, 0),
    rentalRate: toNumber(record.rental_rate ?? first?.rentalRate, 0),
    bookingDate: record.booking_date || record.bookingDate || '',
    startDate: record.start_date || record.startDate || '',
    endDate: record.end_date || record.endDate || '',
    duration,
    discount: toNumber(record.discount, 0),
    subtotal: toNumber(record.subtotal, 0),
    estimatedAmount: total,
    total,
    deposit: toNumber(record.deposit ?? record.deposit_amount, 0),
    amountPaid: paid,
    paidAmount: paid,
    balance: toNumber(record.balance ?? record.balance_amount, Math.max(0, total - paid)),
    paymentStatus: record.payment_status || record.paymentStatus || 'Pending',
    status: record.status || record.booking_status || record.bookingStatus || 'Pending',
    notes: record.notes || '',
    specialInstructions: record.special_instructions || record.specialInstructions || '',
    deliveryMethod: record.delivery_method || record.deliveryMethod || 'Delivery',
    rentalId: record.rental_id ?? record.rentalId ?? null,
    branchId: record.branch_id ?? null,
    items,
    timeline: buildBookingTimeline(record),
  }
}

export function mapBookingToApi(booking) {
  if (!booking) return {}

  const items =
    Array.isArray(booking.items) && booking.items.length
      ? booking.items.map((item) => ({
          product_id: Number(item.productId ?? item.product_id),
          quantity: Number(item.quantity || 1),
          rental_rate: Number(item.rentalRate ?? item.rate ?? item.rental_rate ?? 0),
        }))
      : booking.productId
        ? [
            {
              product_id: Number(booking.productId),
              quantity: Number(booking.quantity || 1),
              rental_rate: Number(booking.rentalRate ?? booking.rate ?? 0),
            },
          ]
        : undefined

  return {
    customer_id: Number(booking.customerId || booking.customer_id),
    booking_date: booking.bookingDate || booking.booking_date || undefined,
    start_date: booking.startDate || booking.start_date,
    end_date: booking.endDate || booking.end_date,
    items,
    product_id: booking.productId ? Number(booking.productId) : undefined,
    quantity: booking.quantity != null ? Number(booking.quantity) : undefined,
    rental_rate: booking.rentalRate != null ? Number(booking.rentalRate) : undefined,
    discount: Number(booking.discount || 0),
    deposit: Number(booking.deposit ?? booking.depositAmount ?? 0),
    deposit_amount: Number(booking.deposit ?? booking.depositAmount ?? 0),
    paid_amount: Number(booking.amountPaid ?? booking.paidAmount ?? booking.deposit ?? 0),
    payment_amount: Number(booking.amountPaid ?? booking.paidAmount ?? booking.deposit ?? 0),
    status: booking.status || booking.bookingStatus || undefined,
    booking_status: booking.status || booking.bookingStatus || undefined,
    notes: booking.notes || undefined,
    branch_id: branchIdToApi(booking),
    booking_number: booking.bookingNumber || booking.bookingId || undefined,
  }
}

export function mapBookingEventFromApi(booking) {
  const mapped = mapBookingFromApi(booking)
  if (!mapped) return null
  return {
    id: `bk-${mapped.id}`,
    type: 'booking',
    title: `${mapped.product || 'Equipment'} Booking`,
    start: mapped.startDate,
    end: mapped.endDate,
    date: mapped.startDate,
    endDate: mapped.endDate,
    status: mapped.status,
    customerId: mapped.customerId,
    referenceId: mapped.id,
    color: '#3b82f6',
    customer: mapped.customer,
    product: mapped.product,
    notes: mapped.notes,
    refId: mapped.id,
    refPath: `/bookings`,
  }
}

export function mapIncomePaymentFromApi(record, incomeId = null, incomeRecordId = null) {
  if (!record) return null
  return {
    id: record.id,
    paymentId: record.payment_id || record.paymentId || `PAY-INC-${record.id}`,
    incomeId: incomeId || record.income_number || record.incomeId || null,
    incomeRecordId: incomeRecordId ?? record.income_id ?? record.incomeRecordId ?? null,
    paymentDate: record.payment_date || record.paymentDate || '',
    amount: toNumber(record.amount, 0),
    paymentMethod: record.payment_method || record.paymentMethod || '',
    reference: record.reference || record.reference_number || record.referenceNumber || '',
    notes: record.notes || '',
  }
}

export function mapIncomePaymentToApi(payment) {
  if (!payment) return {}
  return {
    amount: Number(payment.amount),
    payment_date: payment.paymentDate || payment.payment_date || undefined,
    payment_method: payment.paymentMethod || payment.payment_method || undefined,
    reference: payment.reference || payment.referenceNumber || payment.reference_number || undefined,
    reference_number: payment.reference || payment.referenceNumber || payment.reference_number || undefined,
    notes: payment.notes,
  }
}

export function mapIncomeFromApi(record) {
  if (!record) return null
  const customer = typeof record.customer === 'object' ? record.customer : null
  const amount = toNumber(record.amount, 0)
  const paidAmount = toNumber(record.paid_amount ?? record.paidAmount, 0)
  const remainingAmount = toNumber(
    record.balance ?? record.balance_amount ?? record.remainingAmount,
    Math.max(0, amount - paidAmount)
  )
  const incomeId = record.reference || record.income_number || record.incomeId || ''
  const source = record.source || record.source_type || 'Other'
  const payments = Array.isArray(record.payments)
    ? record.payments.map((p) => mapIncomePaymentFromApi(p, incomeId, record.id)).filter(Boolean)
    : []

  return {
    id: record.id,
    incomeId,
    date: record.date || record.income_date || '',
    source,
    type: source === 'Sale' ? 'Sales' : source,
    customerId: record.customer_id ?? record.customerId ?? customer?.id ?? null,
    customer: customer?.name || record.customer_name || (typeof record.customer === 'string' ? record.customer : '') || '',
    reference: record.related_type && record.related_id
      ? `${record.related_type}-${record.related_id}`
      : '',
    relatedId: record.related_id ?? record.relatedId ?? record.sale_id ?? record.rental_id ?? record.booking_id ?? null,
    relatedType: record.related_type || record.relatedType || null,
    saleId: record.sale_id ?? null,
    rentalId: record.rental_id ?? null,
    bookingId: record.booking_id ?? null,
    description: record.description || '',
    amount,
    paidAmount,
    remainingAmount,
    paymentMethod: record.payment_method || record.paymentMethod || 'Cash',
    paymentStatus: record.payment_status || record.status || record.paymentStatus || 'Pending',
    category: record.category || 'Other Income',
    dueDate: record.due_date || record.dueDate || null,
    notes: record.notes || '',
    branchId: record.branch_id ?? null,
    payments,
  }
}

export function mapIncomeToApi(income) {
  if (!income) return {}
  const relatedType = income.relatedType || income.related_type
  const relatedId = income.relatedId ?? income.related_id
  return {
    reference: income.incomeId || income.reference || undefined,
    income_number: income.incomeId || undefined,
    date: income.date || income.income_date,
    income_date: income.date || income.income_date,
    source: income.source || income.source_type || 'Other',
    source_type: income.source || income.source_type || 'Other',
    category: income.category || 'Other Income',
    customer_id: income.customerId || income.customer_id || null,
    amount: Number(income.amount),
    payment_amount: Number(income.paidAmount ?? income.paymentAmount ?? income.initialPayment ?? 0),
    paid_amount: Number(income.paidAmount ?? income.paymentAmount ?? 0),
    payment_method: income.paymentMethod || income.payment_method || undefined,
    due_date: income.dueDate || income.due_date || undefined,
    related_type: relatedType || undefined,
    related_id: relatedId || undefined,
    sale_id: income.saleId || (relatedType === 'Sale' ? relatedId : undefined),
    rental_id: income.rentalId || (relatedType === 'Rental' ? relatedId : undefined),
    booking_id: income.bookingId || (relatedType === 'Booking' ? relatedId : undefined),
    description: income.description || undefined,
    notes: income.notes || undefined,
    branch_id: branchIdToApi(income),
  }
}

export function mapExpensePaymentFromApi(record, expenseId = null, expenseRecordId = null) {
  if (!record) return null
  return {
    id: record.id,
    paymentId: record.payment_id || record.paymentId || `PAY-EXP-${record.id}`,
    expenseId: expenseId || record.expense_number || record.expenseId || null,
    expenseRecordId: expenseRecordId ?? record.expense_id ?? record.expenseRecordId ?? null,
    paymentDate: record.payment_date || record.paymentDate || '',
    amount: toNumber(record.amount, 0),
    paymentMethod: record.payment_method || record.paymentMethod || '',
    reference: record.reference || record.reference_number || record.referenceNumber || '',
    notes: record.notes || '',
  }
}

export function mapExpensePaymentToApi(payment) {
  if (!payment) return {}
  return {
    amount: Number(payment.amount),
    payment_date: payment.paymentDate || payment.payment_date || undefined,
    payment_method: payment.paymentMethod || payment.payment_method || undefined,
    reference: payment.reference || payment.referenceNumber || payment.reference_number || undefined,
    reference_number: payment.reference || payment.referenceNumber || payment.reference_number || undefined,
    notes: payment.notes,
  }
}

export function mapExpenseFromApi(record) {
  if (!record) return null
  const supplier = typeof record.supplier === 'object' ? record.supplier : null
  const product = typeof record.product === 'object' ? record.product : null
  const amount = toNumber(record.amount, 0)
  const paidAmount = toNumber(record.paid_amount ?? record.paidAmount, 0)
  const remainingAmount = toNumber(
    record.balance ?? record.balance_amount ?? record.remainingAmount,
    Math.max(0, amount - paidAmount)
  )
  const expenseId = record.reference || record.expense_number || record.expenseId || ''
  const payments = Array.isArray(record.payments)
    ? record.payments.map((p) => mapExpensePaymentFromApi(p, expenseId, record.id)).filter(Boolean)
    : []

  return {
    id: record.id,
    expenseId,
    date: record.date || record.expense_date || '',
    category: record.category || 'Other Expense',
    supplierId: record.supplier_id ?? record.supplierId ?? supplier?.id ?? null,
    supplier: supplier?.name || record.supplier_name || (typeof record.supplier === 'string' ? record.supplier : '') || '',
    productId: record.product_id ?? record.productId ?? product?.id ?? null,
    product: product?.name || record.product_name || (typeof record.product === 'string' ? record.product : '') || '',
    maintenanceId: record.maintenance_id ?? record.maintenanceId ?? null,
    description: record.description || '',
    amount,
    paidAmount,
    remainingAmount,
    paymentMethod: record.payment_method || record.paymentMethod || 'Cash',
    paymentStatus: record.payment_status || record.status || record.paymentStatus || 'Pending',
    dueDate: record.due_date || record.dueDate || null,
    notes: record.notes || '',
    branchId: record.branch_id ?? null,
    payments,
  }
}

export function mapExpenseToApi(expense) {
  if (!expense) return {}
  return {
    reference: expense.expenseId || expense.reference || undefined,
    expense_number: expense.expenseId || undefined,
    date: expense.date || expense.expense_date,
    expense_date: expense.date || expense.expense_date,
    category: expense.category || 'Other Expense',
    supplier_id: expense.supplierId || expense.supplier_id || null,
    product_id: expense.productId || expense.product_id || null,
    amount: Number(expense.amount),
    payment_amount: Number(expense.paidAmount ?? expense.paymentAmount ?? expense.initialPayment ?? 0),
    paid_amount: Number(expense.paidAmount ?? expense.paymentAmount ?? 0),
    payment_method: expense.paymentMethod || expense.payment_method || undefined,
    due_date: expense.dueDate || expense.due_date || undefined,
    description: expense.description || undefined,
    notes: expense.notes || undefined,
    branch_id: branchIdToApi(expense),
  }
}

export function mapNotificationFromApi(record) {
  if (!record) return null
  const status = record.status || (record.is_read || record.read ? 'Read' : 'Unread')
  const read = status === 'Read' || status === 'Dismissed' || Boolean(record.is_read || record.read)
  const link = record.action_url || record.actionUrl || record.link || '/notifications'
  const type = record.notification_type || record.type || 'System Alert'

  return {
    id: record.id,
    title: record.title || '',
    message: record.message || '',
    type,
    notificationType: type,
    category: record.category || 'System',
    priority: record.priority || 'Medium',
    status,
    read,
    relatedType: record.related_type || record.relatedType || null,
    relatedId: record.related_id ?? record.relatedId ?? null,
    link,
    actionUrl: link,
    userId: record.user_id ?? record.userId ?? null,
    readAt: record.read_at || record.readAt || null,
    time: record.time || record.created_at || record.createdAt || new Date().toISOString(),
    createdAt: record.created_at || record.createdAt || null,
    updatedAt: record.updated_at || record.updatedAt || null,
  }
}

export function mapNotificationToApi(notification) {
  if (!notification) return {}
  return {
    title: notification.title,
    message: notification.message,
    type: notification.notificationType || notification.type || notification.notification_type,
    notification_type: notification.notificationType || notification.type || notification.notification_type,
    category: notification.category,
    priority: notification.priority,
    status: notification.status,
    related_type: notification.relatedType || notification.related_type,
    related_id: notification.relatedId ?? notification.related_id,
    link: notification.link || notification.actionUrl || notification.action_url,
    action_url: notification.actionUrl || notification.action_url || notification.link,
    user_id: notification.userId ?? notification.user_id,
  }
}

const n = (value, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const arr = (value) => (Array.isArray(value) ? value : [])

export function mapDashboardReportFromApi(data = {}) {
  const summary = data.summary || {}
  const charts = data.charts || {}
  return {
    range: data.range || {},
    summary: {
      totalSales: n(summary.total_sales),
      rentalIncome: n(summary.total_rental_income),
      totalIncome: n(summary.total_income),
      totalExpenses: n(summary.total_expenses),
      netCashFlow: n(summary.net_cash_flow),
      netIncome: n(summary.net_cash_flow),
      outstandingIncome: n(summary.outstanding_income),
      outstandingExpenses: n(summary.outstanding_expenses),
      totalCustomers: n(summary.total_customers),
      totalProducts: n(summary.total_products),
      inventoryValue: n(summary.inventory_value),
      activeRentals: n(summary.active_rentals),
      pendingBookings: n(summary.pending_bookings),
      lowStockCount: n(summary.low_stock_count),
      upcomingChecksCount: n(summary.upcoming_checks),
    },
    lowStock: arr(data.low_stock),
    chartData: {
      salesVsRental: arr(charts.sales_vs_rental),
      monthlyRevenue: arr(charts.monthly_revenue),
      incomeVsExpenses: arr(charts.income_vs_expenses),
      monthlyCashFlow: arr(charts.monthly_cash_flow),
      incomeBySource: arr(charts.income_by_source),
      expensesByCategory: arr(charts.expenses_by_category),
      productUsage: arr(charts.product_usage),
      rentalActivity: arr(charts.rental_activity),
    },
    recentSales: arr(data.recent_sales),
    recentRentals: arr(data.recent_rentals),
    recentActivity: arr(data.recent_activity),
  }
}

export function mapReportSummaryFromApi(data = {}) {
  return {
    range: data.range || {},
    totalSales: n(data.total_sales),
    rentalIncome: n(data.rental_income),
    totalIncome: n(data.total_income),
    totalExpenses: n(data.total_expenses),
    netCashFlow: n(data.net_cash_flow),
    totalTransactions: n(data.total_transactions),
    outstandingPayments: n(data.outstanding_payments),
    outstanding: arr(data.outstanding),
    recentActivity: arr(data.recent_activity),
    summary: data.summary || {},
    preview: data.preview || {},
    charts: {
      monthlyCashFlow: arr(data.charts?.monthly_cash_flow),
      incomeBySource: arr(data.charts?.income_by_source),
      expensesByCategory: arr(data.charts?.expenses_by_category),
    },
  }
}

export function mapSalesReportFromApi(data = {}) {
  const s = data.summary || {}
  return {
    range: data.range || {},
    summary: {
      totalSales: n(s.total_sales),
      salesRevenue: n(s.total_revenue ?? s.sales_revenue),
      paidAmount: n(s.total_paid ?? s.paid_amount),
      outstandingAmount: n(s.total_outstanding ?? s.outstanding_amount),
      itemsSold: n(s.items_sold),
      averageSaleValue: n(s.average_sale_value),
      totalTransactions: n(s.total_transactions ?? s.total_sales),
    },
    transactions: arr(data.transactions),
    byProduct: arr(data.by_product).map((row) => ({
      productId: row.product_id,
      product: row.product || 'Unknown',
      serial_number: row.serial_number || '—',
      quantitySold: n(row.quantity_sold),
      revenue: n(row.revenue),
      numberOfSales: n(row.number_of_sales),
    })),
    byCustomer: arr(data.by_customer).map((row) => ({
      customerId: row.customer_id,
      customer: row.customer || 'Unknown',
      numberOfSales: n(row.transaction_count),
      totalSales: n(row.revenue),
      paid: n(row.paid),
      outstanding: n(row.outstanding),
    })),
    paymentStatus: arr(data.payment_status),
    monthly: arr(data.monthly),
  }
}

export function mapRentalReportFromApi(data = {}) {
  const s = data.summary || {}
  return {
    range: data.range || {},
    summary: {
      totalRentals: n(s.total_rentals),
      totalRentalIncome: n(s.total_rental_income),
      paidRentalIncome: n(s.paid_rental_income),
      outstandingRentalIncome: n(s.outstanding_rental_income),
      activeRentals: n(s.active_rentals),
      overdueRentals: n(s.overdue_rentals),
      completedRentals: n(s.completed_rentals),
    },
    transactions: arr(data.transactions),
    statusSummary: arr(data.status_summary),
    paymentStatus: arr(data.payment_status),
    usage: arr(data.usage).map((row) => ({
      productId: row.product_id,
      product: row.product,
      rentalCount: n(row.rental_count),
      totalRentedQuantity: n(row.total_rented_quantity),
      rentalDays: n(row.rental_days),
      rentalIncome: n(row.rental_income),
    })),
    overdue: arr(data.overdue),
    monthly: arr(data.monthly),
  }
}

export function mapInventoryReportFromApi(data = {}) {
  const s = data.summary || {}
  return {
    summary: {
      totalProducts: n(s.total_products),
      totalQuantity: n(s.total_quantity),
      availableQuantity: n(s.available_quantity),
      rentedQuantity: n(s.rented_quantity),
      soldQuantity: n(s.sold_quantity),
      maintenanceQuantity: n(s.maintenance_quantity),
      lowStockCount: n(s.low_stock_count),
      outOfStockCount: n(s.out_of_stock_count),
    },
    products: arr(data.products).map((row) => ({
      id: row.id,
      product: row.product,
      name: row.product,
      serial_number: row.serial_number,
      category: row.category,
      quantity: n(row.total_quantity),
      available: n(row.available_quantity),
      rented: n(row.rented_quantity),
      maintenance: n(row.maintenance_quantity),
      sold: n(row.sold_quantity),
      status: row.status,
      minStock: n(row.minimum_stock),
    })),
  }
}

export function mapInventoryUsageReportFromApi(data = {}) {
  return {
    range: data.range || {},
    usage: arr(data.usage).map((row) => ({
      productId: row.product_id,
      product: row.product,
      serial_number: row.serial_number,
      salesQuantity: n(row.sales_quantity),
      rentalQuantity: n(row.rental_quantity),
      rentalCount: n(row.rental_count),
      rentalDays: n(row.rental_days),
      totalRevenue: n(row.total_revenue),
      lastUsageDate: row.last_usage_date || null,
    })),
  }
}

export function mapEquipmentReportFromApi(data = {}) {
  return {
    equipment: arr(data.equipment).map((row) => ({
      id: row.id,
      product: row.product,
      serial_number: row.serial_number,
      status: row.status,
      condition: row.condition,
      totalQuantity: n(row.total_quantity),
      availableQuantity: n(row.available_quantity),
      rentalCount: n(row.rental_count),
      rentalIncome: n(row.rental_income),
      maintenanceCount: n(row.maintenance_count),
      maintenanceCost: n(row.maintenance_cost),
      checkCount: n(row.check_count),
      lastMaintenanceDate: row.last_maintenance_date,
      lastCheckDate: row.last_check_date,
    })),
    lifecycle: arr(data.lifecycle),
  }
}

export function mapFinancialReportFromApi(data = {}) {
  const s = data.summary || {}
  return {
    range: data.range || {},
    summary: {
      totalIncome: n(s.total_income),
      totalExpenses: n(s.total_expenses),
      netCashFlow: n(s.net_cash_flow),
      paidIncome: n(s.paid_income),
      outstandingIncome: n(s.outstanding_income),
      paidExpenses: n(s.paid_expenses),
      outstandingExpenses: n(s.outstanding_expenses),
    },
    incomeTransactions: arr(data.income_transactions),
    expenseTransactions: arr(data.expense_transactions),
    incomeBySource: arr(data.income_by_source),
    expensesByCategory: arr(data.expenses_by_category),
    incomePaymentStatus: arr(data.income_payment_status),
    expensePaymentStatus: arr(data.expense_payment_status),
    monthlyCashFlow: arr(data.monthly_cash_flow),
    outstandingIncomeRows: arr(data.outstanding_income),
    outstandingExpenseRows: arr(data.outstanding_expenses),
  }
}

export function mapCustomerReportFromApi(data = {}) {
  const s = data.summary || {}
  return {
    range: data.range || {},
    summary: {
      totalCustomers: n(s.total_customers),
      activeCustomers: n(s.active_customers),
      inactiveCustomers: n(s.inactive_customers),
      individualCustomers: n(s.individual_customers),
      companyCustomers: n(s.company_customers),
    },
    customers: arr(data.customers).map((row) => ({
      id: row.id,
      name: row.name,
      company: row.company,
      customerType: row.customer_type,
      status: row.status,
      phone: row.phone,
      email: row.email,
      salesCount: n(row.sales_count),
      salesRevenue: n(row.sales_revenue),
      rentalCount: n(row.rental_count),
      rentalRevenue: n(row.rental_revenue),
      outstandingBalance: n(row.outstanding_balance),
      lastTransactionDate: row.last_transaction_date,
    })),
  }
}

export function mapCustomerDetailsReportFromApi(data = {}) {
  const s = data.summary || {}
  const c = data.customer || {}
  return {
    range: data.range || {},
    customer: {
      id: c.id,
      name: c.name || '',
      company: c.company || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      status: c.status || '',
      customerType: c.customer_type || '',
    },
    sales: arr(data.sales),
    rentals: arr(data.rentals),
    payments: arr(data.payments),
    activityTimeline: arr(data.activity_timeline),
    summary: {
      salesCount: n(s.sales_count),
      salesRevenue: n(s.sales_revenue),
      rentalCount: n(s.rental_count),
      rentalRevenue: n(s.rental_revenue),
      outstandingBalance: n(s.outstanding_balance),
    },
  }
}

export function mapCheckFromApi(record) {
  if (!record) return null
  const checkNumber = record.checkNumber || record.check_number || record.checkId || record.check_id || ''
  return {
    id: record.id,
    checkId: checkNumber,
    checkNumber,
    check: record.check || record.check_type || record.checkType || record.name || '',
    name: record.name || record.check || record.check_type || '',
    productId: record.productId ?? record.product_id ?? null,
    product: typeof record.product === 'string' ? record.product : record.product?.name || '',
    product_serial_number: record.product_serial_number || '',
    category: record.category || '',
    rentalId: record.rentalId ?? record.rental_id ?? null,
    customerId: record.customerId ?? record.customer_id ?? null,
    customer: typeof record.customer === 'string' ? record.customer : record.customer?.name || '',
    description: record.description || '',
    checkDate: record.checkDate || record.scheduled_date || record.scheduledDate || '',
    scheduledDate: record.scheduledDate || record.scheduled_date || record.checkDate || '',
    frequency: record.frequency || '',
    assignedTo: record.assignedTo || record.assigned_to || '',
    checkedBy: record.checkedBy || record.checked_by || '',
    lastCompleted: record.lastCompleted || record.completed_date || record.completedDate || null,
    completedDate: record.completedDate || record.completed_date || record.lastCompleted || null,
    nextCheck: record.nextCheck || record.next_check_date || record.nextCheckDate || null,
    status: record.status || 'Scheduled',
    priority: record.priority || 'Medium',
    result: record.result || '',
    condition: record.condition || '',
    checklistData: record.checklistData || record.checklist_data || null,
    reminderBefore: record.reminderBefore || record.reminder_before || '1 Day Before',
    reminder: record.reminder !== false,
    notes: record.notes || '',
  }
}

export function mapCheckToApi(check) {
  if (!check) return {}
  return {
    check_number: check.checkNumber || check.checkId || undefined,
    product_id: check.productId ?? check.product_id ?? undefined,
    rental_id: check.rentalId ?? check.rental_id ?? undefined,
    customer_id: check.customerId ?? check.customer_id ?? undefined,
    check_type: check.check || check.check_type || check.checkType || check.name || undefined,
    description: check.description ?? undefined,
    scheduled_date: check.checkDate || check.scheduled_date || check.scheduledDate || undefined,
    completed_date: check.lastCompleted || check.completed_date || check.completedDate || undefined,
    next_check_date: check.nextCheck || check.next_check_date || undefined,
    frequency: check.frequency || undefined,
    status: check.status || undefined,
    priority: check.priority || undefined,
    result: check.result || undefined,
    condition: check.condition || undefined,
    checklist_data: check.checklistData || check.checklist_data || undefined,
    assigned_to: check.assignedTo || check.assigned_to || undefined,
    checked_by: check.checkedBy && Number.isFinite(Number(check.checkedBy)) ? Number(check.checkedBy) : undefined,
    reminder_before: check.reminderBefore || check.reminder_before || undefined,
    notes: check.notes || undefined,
  }
}

export function mapMaintenanceFromApi(record) {
  if (!record) return null
  const number = record.maintenanceId || record.maintenance_number || record.maintenance_id || ''
  return {
    id: record.id,
    maintenanceId: number,
    productId: record.productId ?? record.product_id ?? null,
    product: typeof record.product === 'string' ? record.product : record.product?.name || '',
    product_serial_number: record.product_serial_number || '',
    productCategory: record.productCategory || record.product_category || '',
    productImage: record.productImage || record.product_image || PRODUCT_PLACEHOLDER,
    supplierId: record.supplierId ?? record.supplier_id ?? null,
    supplier: typeof record.supplier === 'string' ? record.supplier : record.supplier?.name || '',
    maintenanceType: record.maintenanceType || record.maintenance_type || '',
    description: record.description || '',
    scheduledDate: record.scheduledDate || record.scheduled_date || record.startDate || record.start_date || '',
    startDate: record.startDate || record.start_date || '',
    startedDate: record.startedDate || record.started_date || null,
    expectedCompletion: record.expectedCompletion || record.expected_completion || '',
    completedDate: record.completedDate || record.completed_date || null,
    technician: record.technician || '',
    cost: toNumber(record.cost, 0),
    estimatedCost: toNumber(record.estimatedCost ?? record.estimated_cost ?? record.cost, 0),
    priority: record.priority || 'Medium',
    status: record.status || 'Scheduled',
    notes: record.notes || '',
    timeline: Array.isArray(record.timeline) ? record.timeline : [],
  }
}

export function mapMaintenanceToApi(record) {
  if (!record) return {}
  return {
    maintenance_number: record.maintenanceId || record.maintenance_number || undefined,
    product_id: record.productId ?? record.product_id ?? undefined,
    supplier_id: record.supplierId ?? record.supplier_id ?? undefined,
    maintenance_type: record.maintenanceType || record.maintenance_type || undefined,
    description: record.description ?? undefined,
    scheduled_date: record.scheduledDate || record.scheduled_date || record.startDate || undefined,
    start_date: record.startDate || record.start_date || undefined,
    started_date: record.startedDate || record.started_date || undefined,
    expected_completion: record.expectedCompletion || record.expected_completion || undefined,
    completed_date: record.completedDate || record.completed_date || undefined,
    cost: record.cost !== undefined && record.cost !== '' ? Number(record.cost) : undefined,
    estimated_cost:
      record.estimatedCost !== undefined && record.estimatedCost !== ''
        ? Number(record.estimatedCost)
        : record.estimated_cost !== undefined
          ? Number(record.estimated_cost)
          : undefined,
    status: record.status || undefined,
    priority: record.priority || undefined,
    technician: record.technician || undefined,
    next_maintenance_date: record.nextMaintenanceDate || record.next_maintenance_date || undefined,
    notes: record.notes || undefined,
  }
}

export function mapReminderFromApi(record) {
  if (!record) return null
  const due = record.dueDate || record.due_date || record.nextReminder || record.next_reminder || ''
  const status = record.status || 'Pending'
  const isRecurring = Boolean(record.isRecurring ?? record.is_recurring)

  // Map API statuses to UI-friendly labels used by ReminderCard / Recurring table
  let uiStatus = 'Unread'
  if (isRecurring) {
    uiStatus = status === 'Dismissed' || status === 'Paused' ? 'Paused' : 'Active'
  } else if (status === 'Completed') {
    uiStatus = 'Completed'
  } else if (status === 'Dismissed') {
    uiStatus = 'Completed'
  }

  return {
    id: record.id,
    reminderNumber: record.reminderNumber || record.reminder_number || '',
    title: record.title || record.reminder || '',
    reminder: record.title || record.reminder || '',
    message: record.message || record.description || '',
    description: record.description || record.message || '',
    reminderType: record.reminderType || record.reminder_type || record.source || 'Manual',
    source: record.source || record.reminderType || record.reminder_type || 'Manual',
    dueDate: due,
    date: due,
    nextReminder: record.nextReminder || record.next_reminder || due,
    lastSent: record.lastSent || record.last_sent || null,
    status: uiStatus,
    apiStatus: status,
    priority: record.priority || 'Medium',
    relatedType: record.relatedType || record.related_type || null,
    relatedId: record.relatedId ?? record.related_id ?? null,
    productId: record.productId ?? record.product_id ?? null,
    product: typeof record.product === 'string' ? record.product : record.product?.name || '',
    frequency: record.frequency || '',
    isRecurring,
    link: record.link || '',
    notes: record.notes || '',
    completedAt: record.completedAt || record.completed_at || null,
    dismissedAt: record.dismissedAt || record.dismissed_at || null,
    read: status !== 'Pending',
    completed: status === 'Completed',
  }
}

export function mapReminderToApi(reminder) {
  if (!reminder) return {}
  let status = reminder.apiStatus || reminder.status
  if (status === 'Unread' || status === 'Read' || status === 'Snoozed' || status === 'Active') {
    status = 'Pending'
  }
  if (status === 'Paused') status = 'Dismissed'

  return {
    title: reminder.title || reminder.reminder || undefined,
    message: reminder.message || reminder.description || undefined,
    description: reminder.description || reminder.message || undefined,
    reminder_type: reminder.reminderType || reminder.reminder_type || reminder.source || undefined,
    due_date: reminder.dueDate || reminder.due_date || reminder.nextReminder || reminder.date || undefined,
    next_reminder: reminder.nextReminder || reminder.next_reminder || undefined,
    last_sent: reminder.lastSent || reminder.last_sent || undefined,
    status: status || undefined,
    priority: reminder.priority || undefined,
    related_type: reminder.relatedType || reminder.related_type || undefined,
    related_id: reminder.relatedId ?? reminder.related_id ?? undefined,
    product_id: reminder.productId ?? reminder.product_id ?? undefined,
    frequency: reminder.frequency || undefined,
    is_recurring: reminder.isRecurring ?? reminder.is_recurring ?? undefined,
    link: reminder.link || undefined,
    notes: reminder.notes || undefined,
  }
}

const optionalAmount = (value) => (value === '' || value == null ? null : Number(value))

export function mapPurchaseItemFromApi(record) {
  if (!record) return null
  return {
    id: record.id,
    productId: record.product_id,
    productName: record.product_name || '',
    serialNumber: record.serial_number || '',
    unit: record.unit || '',
    productListingType: record.product_listing_type || null,
    isNewProduct: Boolean(record.is_new_product),
    quantity: toNumber(record.quantity, 0),
    unitCost: toNumber(record.unit_cost, 0),
    lineTotal: toNumber(record.line_total, 0),
    listingType: record.listing_type || null,
    salePrice: record.sale_price == null ? null : toNumber(record.sale_price, 0),
    rentalPrice: record.rental_price == null ? null : toNumber(record.rental_price, 0),
  }
}

export function mapPurchaseFromApi(record) {
  if (!record) return null
  return {
    id: record.id,
    purchaseNumber: record.purchase_number || '',
    supplierId: record.supplier_id ?? null,
    supplierName: record.supplier_name || '',
    purchaseDate: record.purchase_date || '',
    billNumber: record.bill_number || '',
    notes: record.notes || '',
    branchId: record.branch_id ?? null,
    totalAmount: toNumber(record.total_amount, 0),
    paymentType: record.payment_type || 'Credit',
    paidAmount: toNumber(record.paid_amount, 0),
    balance: toNumber(record.balance, 0),
    paymentStatus: record.payment_status || 'Unpaid',
    status: record.status || 'Completed',
    cancelledAt: record.cancelled_at || null,
    cancelReason: record.cancel_reason || '',
    createdByName: record.created_by_name || '',
    itemsCount: toNumber(record.items_count, 0),
    totalQuantity: toNumber(record.total_quantity, 0),
    productNames: Array.isArray(record.product_names) ? record.product_names : [],
    createdAt: record.created_at || null,
    items: Array.isArray(record.items) ? record.items.map(mapPurchaseItemFromApi).filter(Boolean) : [],
  }
}

export function mapPurchaseToApi(purchase) {
  return {
    supplier_id: purchase.supplierId ? Number(purchase.supplierId) : null,
    purchase_date: purchase.purchaseDate || null,
    bill_number: purchase.billNumber?.trim() || null,
    notes: purchase.notes?.trim() || null,
    branch_id: branchIdToApi(purchase),
    payment_type: purchase.paymentType,
    paid_amount: optionalAmount(purchase.paidAmount),
    items: (purchase.items || []).map((item) => {
      const listing = item.listingType || 'none'
      return {
        mode: item.mode,
        product_id: item.mode === 'existing' && item.productId ? Number(item.productId) : null,
        name: item.mode === 'new' ? item.name?.trim() : undefined,
        serial_number: item.mode === 'new' ? item.serialNumber?.trim().toUpperCase() : undefined,
        category_id: item.mode === 'new' && item.categoryId ? Number(item.categoryId) : undefined,
        quantity: Number(item.quantity),
        unit_cost: optionalAmount(item.unitCost),
        listing_type: listing,
        sale_price: ['sale', 'both'].includes(listing) ? optionalAmount(item.salePrice) : null,
        rental_price: ['rent', 'both'].includes(listing) ? optionalAmount(item.rentalPrice) : null,
      }
    }),
  }
}

export { PRODUCT_PLACEHOLDER }
