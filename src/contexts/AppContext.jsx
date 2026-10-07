import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getStockStatus } from '../utils/productHelpers'
import {
  isMaintenanceActive,
  markProductUnderMaintenance,
  productHasActiveMaintenance,
  releaseProductFromMaintenance,
} from '../utils/maintenanceHelpers'
import { categoryService, customerService, productService, supplierService } from '../services'
import branchService from '../services/branchService'
import vehicleService from '../services/vehicleService'
import rentalService from '../services/rentalService'
import saleService from '../services/saleService'
import stockMovementService from '../services/stockMovementService'
import bookingService from '../services/bookingService'
import incomeService from '../services/incomeService'
import expenseService from '../services/expenseService'
import notificationService from '../services/notificationService'
import checkService from '../services/checkService'
import maintenanceService from '../services/maintenanceService'
import reminderService from '../services/reminderService'
import settingsService, { EMPTY_SETTINGS } from '../services/settingsService'
import authService, {
  clearSession,
  getStoredToken,
  getStoredUser,
} from '../services/authService'
import { getApiErrorMessage } from '../services/api'
import { buildCalendarEvents } from '../utils/bookingHelpers'

const AppContext = createContext(null)

function seedProductsWithMaintenance(products, maintenance) {
  const activeIds = new Set(
    maintenance.filter((r) => isMaintenanceActive(r.status)).map((r) => Number(r.productId))
  )
  return products.map((p) =>
    activeIds.has(Number(p.id)) ? { ...p, status: 'Maintenance' } : p
  )
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => (getStoredToken() ? getStoredUser() : null))
  const [authReady, setAuthReady] = useState(!getStoredToken())
  const [permissions, setPermissions] = useState(() =>
    getStoredToken() ? getStoredUser()?.permissions || [] : []
  )
  // Products / categories / suppliers / customers: MySQL via Laravel API
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [sales, setSales] = useState([])
  const [rentals, setRentals] = useState([])
  const [bookings, setBookings] = useState([])
  const [income, setIncome] = useState([])
  const [expenses, setExpenses] = useState([])
  const [incomePayments, setIncomePayments] = useState([])
  const [expensePayments, setExpensePayments] = useState([])
  const [checks, setChecks] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [reminders, setReminders] = useState([])
  const [recurringReminders, setRecurringReminders] = useState([])
  const [reminderOverrides, setReminderOverrides] = useState({})
  const [notifications, setNotifications] = useState([])
  const [notificationsLoading, setNotificationsLoading] = useState(true)
  const [notificationsError, setNotificationsError] = useState(null)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [stockHistory, setStockHistory] = useState([])
  const [stockHistoryLoading, setStockHistoryLoading] = useState(false)
  const [stockHistoryError, setStockHistoryError] = useState(null)
  const [categories, setCategories] = useState([])
  const [branches, setBranches] = useState([])
  const [vehicleRentals, setVehicleRentals] = useState([])
  const [settings, setSettings] = useState(EMPTY_SETTINGS)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsError, setSettingsError] = useState(null)

  const [productsLoading, setProductsLoading] = useState(true)
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [suppliersLoading, setSuppliersLoading] = useState(true)
  const [customersLoading, setCustomersLoading] = useState(true)
  const [salesLoading, setSalesLoading] = useState(true)
  const [salesError, setSalesError] = useState(null)
  const [rentalsLoading, setRentalsLoading] = useState(true)
  const [productsError, setProductsError] = useState(null)
  const [categoriesError, setCategoriesError] = useState(null)
  const [suppliersError, setSuppliersError] = useState(null)
  const [customersError, setCustomersError] = useState(null)
  const [rentalsError, setRentalsError] = useState(null)
  const [bookingsLoading, setBookingsLoading] = useState(true)
  const [bookingsError, setBookingsError] = useState(null)
  const [incomeLoading, setIncomeLoading] = useState(true)
  const [incomeError, setIncomeError] = useState(null)
  const [expensesLoading, setExpensesLoading] = useState(true)
  const [expensesError, setExpensesError] = useState(null)
  const [checksLoading, setChecksLoading] = useState(true)
  const [checksError, setChecksError] = useState(null)
  const [maintenanceLoading, setMaintenanceLoading] = useState(true)
  const [maintenanceError, setMaintenanceError] = useState(null)
  const [remindersLoading, setRemindersLoading] = useState(true)
  const [remindersError, setRemindersError] = useState(null)

  const maintenanceRef = useRef(maintenance)
  maintenanceRef.current = maintenance

  const loadProducts = useCallback(async () => {
    setProductsLoading(true)
    setProductsError(null)
    try {
      const rows = await productService.getProducts()
      setProducts(seedProductsWithMaintenance(rows, maintenanceRef.current))
    } catch (error) {
      setProductsError(getApiErrorMessage(error, 'Unable to load products. Please try again.'))
    } finally {
      setProductsLoading(false)
    }
  }, [])

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true)
    setCategoriesError(null)
    try {
      const rows = await categoryService.getCategories()
      setCategories(rows)
    } catch (error) {
      setCategoriesError(getApiErrorMessage(error, 'Unable to load categories. Please try again.'))
    } finally {
      setCategoriesLoading(false)
    }
  }, [])

  const loadBranches = useCallback(async () => {
    try {
      setBranches(await branchService.getBranches())
    } catch {
      setBranches([])
    }
  }, [])

  const loadVehicleRentals = useCallback(async () => {
    try {
      setVehicleRentals(await vehicleService.getRentals())
    } catch {
      setVehicleRentals([])
    }
  }, [])

  const loadSuppliers = useCallback(async () => {
    setSuppliersLoading(true)
    setSuppliersError(null)
    try {
      const rows = await supplierService.getSuppliers()
      setSuppliers(rows)
    } catch (error) {
      setSuppliersError(getApiErrorMessage(error, 'Unable to load suppliers. Please try again.'))
    } finally {
      setSuppliersLoading(false)
    }
  }, [])

  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true)
    setCustomersError(null)
    try {
      const rows = await customerService.getCustomers()
      setCustomers(rows)
    } catch (error) {
      setCustomersError(getApiErrorMessage(error, 'Unable to load customers. Please try again.'))
    } finally {
      setCustomersLoading(false)
    }
  }, [])

  const loadSales = useCallback(async () => {
    setSalesLoading(true)
    setSalesError(null)
    try {
      const rows = await saleService.getSales()
      setSales(rows)
      return rows
    } catch (error) {
      setSalesError(getApiErrorMessage(error, 'Unable to load sales. Please try again.'))
      throw error
    } finally {
      setSalesLoading(false)
    }
  }, [])

  const loadSale = useCallback(async (id) => {
    const sale = await saleService.getSale(id)
    if (!sale) return null
    setSales((prev) => {
      const exists = prev.some((s) => Number(s.id) === Number(sale.id))
      if (exists) {
        return prev.map((s) => (Number(s.id) === Number(sale.id) ? { ...s, ...sale } : s))
      }
      return [sale, ...prev]
    })
    return sale
  }, [])

  const upsertSaleLocal = (sale) => {
    if (!sale) return
    setSales((prev) => {
      const exists = prev.some((s) => Number(s.id) === Number(sale.id))
      if (exists) {
        return prev.map((s) => (Number(s.id) === Number(sale.id) ? { ...s, ...sale } : s))
      }
      return [sale, ...prev]
    })
  }

  const loadCustomer = useCallback(async (id) => {
    const customer = await customerService.getCustomer(id)
    if (!customer) return null
    setCustomers((prev) => {
      const exists = prev.some((c) => Number(c.id) === Number(customer.id))
      if (exists) {
        return prev.map((c) => (Number(c.id) === Number(customer.id) ? { ...c, ...customer } : c))
      }
      return [...prev, customer]
    })
    return customer
  }, [])

  const loadRentals = useCallback(async () => {
    setRentalsLoading(true)
    setRentalsError(null)
    try {
      const rows = await rentalService.getRentals()
      setRentals(rows)
      return rows
    } catch (error) {
      setRentalsError(getApiErrorMessage(error, 'Unable to load rentals. Please try again.'))
      throw error
    } finally {
      setRentalsLoading(false)
    }
  }, [])


  const loadBookings = useCallback(async () => {
    setBookingsLoading(true)
    setBookingsError(null)
    try {
      const rows = await bookingService.getBookings()
      setBookings(rows)
      return rows
    } catch (error) {
      setBookingsError(getApiErrorMessage(error, 'Unable to load bookings. Please try again.'))
      throw error
    } finally {
      setBookingsLoading(false)
    }
  }, [])

  const loadBooking = useCallback(async (id) => {
    const booking = await bookingService.getBooking(id)
    if (!booking) return null
    setBookings((prev) => {
      const exists = prev.some((b) => Number(b.id) === Number(booking.id))
      if (exists) {
        return prev.map((b) => (Number(b.id) === Number(booking.id) ? { ...b, ...booking } : b))
      }
      return [booking, ...prev]
    })
    return booking
  }, [])

  const upsertBookingLocal = (booking) => {
    if (!booking) return
    setBookings((prev) => {
      const exists = prev.some((b) => Number(b.id) === Number(booking.id))
      if (exists) {
        return prev.map((b) => (Number(b.id) === Number(booking.id) ? { ...b, ...booking } : b))
      }
      return [booking, ...prev]
    })
  }


  const flattenIncomePayments = (rows = []) =>
    rows.flatMap((row) =>
      (row.payments || []).map((p) => ({
        ...p,
        incomeId: p.incomeId || row.incomeId,
        incomeRecordId: p.incomeRecordId ?? row.id,
      }))
    )

  const flattenExpensePayments = (rows = []) =>
    rows.flatMap((row) =>
      (row.payments || []).map((p) => ({
        ...p,
        expenseId: p.expenseId || row.expenseId,
        expenseRecordId: p.expenseRecordId ?? row.id,
      }))
    )

  const loadIncome = useCallback(async () => {
    setIncomeLoading(true)
    setIncomeError(null)
    try {
      const rows = await incomeService.getIncome()
      setIncome(rows)
      setIncomePayments(flattenIncomePayments(rows))
      return rows
    } catch (error) {
      setIncomeError(getApiErrorMessage(error, 'Unable to load income. Please try again.'))
      throw error
    } finally {
      setIncomeLoading(false)
    }
  }, [])

  const loadIncomeRecord = useCallback(async (id) => {
    const record = await incomeService.getIncomeById(id)
    if (!record) return null
    setIncome((prev) => {
      const exists = prev.some((i) => Number(i.id) === Number(record.id))
      return exists
        ? prev.map((i) => (Number(i.id) === Number(record.id) ? { ...i, ...record } : i))
        : [record, ...prev]
    })
    setIncomePayments((prev) => {
      const without = prev.filter((p) => Number(p.incomeRecordId) !== Number(record.id))
      return [...flattenIncomePayments([record]), ...without]
    })
    return record
  }, [])

  const loadExpenses = useCallback(async () => {
    setExpensesLoading(true)
    setExpensesError(null)
    try {
      const rows = await expenseService.getExpenses()
      setExpenses(rows)
      setExpensePayments(flattenExpensePayments(rows))
      return rows
    } catch (error) {
      setExpensesError(getApiErrorMessage(error, 'Unable to load expenses. Please try again.'))
      throw error
    } finally {
      setExpensesLoading(false)
    }
  }, [])

  const loadExpense = useCallback(async (id) => {
    const record = await expenseService.getExpenseById(id)
    if (!record) return null
    setExpenses((prev) => {
      const exists = prev.some((e) => Number(e.id) === Number(record.id))
      return exists
        ? prev.map((e) => (Number(e.id) === Number(record.id) ? { ...e, ...record } : e))
        : [record, ...prev]
    })
    setExpensePayments((prev) => {
      const without = prev.filter((p) => Number(p.expenseRecordId) !== Number(record.id))
      return [...flattenExpensePayments([record]), ...without]
    })
    return record
  }, [])

  const loadRental = useCallback(async (id) => {
    const rental = await rentalService.getRental(id)
    if (!rental) return null
    setRentals((prev) => {
      const exists = prev.some((r) => Number(r.id) === Number(rental.id))
      if (exists) {
        return prev.map((r) => (Number(r.id) === Number(rental.id) ? { ...r, ...rental } : r))
      }
      return [rental, ...prev]
    })
    return rental
  }, [])

  const upsertRentalLocal = (rental) => {
    if (!rental) return
    setRentals((prev) => {
      const exists = prev.some((r) => Number(r.id) === Number(rental.id))
      if (exists) {
        return prev.map((r) => (Number(r.id) === Number(rental.id) ? { ...r, ...rental } : r))
      }
      return [rental, ...prev]
    })
  }

  const loadProduct = useCallback(async (id) => {
    const product = await productService.getProduct(id)
    if (!product) return null
    const normalized = seedProductsWithMaintenance([product], maintenanceRef.current)[0]
    setProducts((prev) => {
      const exists = prev.some((p) => Number(p.id) === Number(normalized.id))
      if (exists) {
        return prev.map((p) => (Number(p.id) === Number(normalized.id) ? { ...p, ...normalized } : p))
      }
      return [...prev, normalized]
    })
    return normalized
  }, [])

  const loadNotifications = useCallback(async ({ generate = false } = {}) => {
    setNotificationsLoading(true)
    setNotificationsError(null)
    try {
      if (generate) {
        try {
          await notificationService.generateAlerts()
        } catch {
          // Alert generation is best-effort; listing must still work.
        }
      }
      const rows = await notificationService.getNotifications()
      setNotifications(rows)
      const count = await notificationService.getUnreadCount()
      setUnreadNotificationCount(count)
      return rows
    } catch (error) {
      setNotificationsError(getApiErrorMessage(error, 'Unable to load notifications.'))
      throw error
    } finally {
      setNotificationsLoading(false)
    }
  }, [])

  const loadStockHistory = useCallback(async (params) => {
    setStockHistoryLoading(true)
    setStockHistoryError(null)
    try {
      const rows = await stockMovementService.getStockMovements(params)
      setStockHistory(rows)
      return rows
    } catch (error) {
      setStockHistoryError(getApiErrorMessage(error, 'Unable to load stock history.'))
      throw error
    } finally {
      setStockHistoryLoading(false)
    }
  }, [])

  const loadChecks = useCallback(async () => {
    setChecksLoading(true)
    setChecksError(null)
    try {
      const rows = await checkService.getChecks()
      setChecks(rows)
      return rows
    } catch (error) {
      setChecksError(getApiErrorMessage(error, 'Unable to load checks. Please try again.'))
      throw error
    } finally {
      setChecksLoading(false)
    }
  }, [])

  const loadMaintenance = useCallback(async () => {
    setMaintenanceLoading(true)
    setMaintenanceError(null)
    try {
      const rows = await maintenanceService.getMaintenance()
      setMaintenance(rows)
      setProducts((prev) => seedProductsWithMaintenance(prev, rows))
      return rows
    } catch (error) {
      setMaintenanceError(getApiErrorMessage(error, 'Unable to load maintenance. Please try again.'))
      throw error
    } finally {
      setMaintenanceLoading(false)
    }
  }, [])

  const loadReminders = useCallback(async () => {
    setRemindersLoading(true)
    setRemindersError(null)
    try {
      const rows = await reminderService.getReminders()
      setReminders(rows.filter((r) => !r.isRecurring))
      setRecurringReminders(rows.filter((r) => r.isRecurring))
      return rows
    } catch (error) {
      setRemindersError(getApiErrorMessage(error, 'Unable to load reminders. Please try again.'))
      throw error
    } finally {
      setRemindersLoading(false)
    }
  }, [])

  const refreshUnreadNotificationCount = useCallback(async () => {
    try {
      const count = await notificationService.getUnreadCount()
      setUnreadNotificationCount(count)
      return count
    } catch {
      return unreadNotificationCount
    }
  }, [unreadNotificationCount])

  const applyUser = useCallback((nextUser) => {
    setUser(nextUser)
    setPermissions(Array.isArray(nextUser?.permissions) ? nextUser.permissions : [])
  }, [])

  useEffect(() => {
    let cancelled = false

    const bootstrapAuth = async () => {
      const token = getStoredToken()
      if (!token) {
        clearSession()
        if (!cancelled) {
          applyUser(null)
          setAuthReady(true)
        }
        return
      }

      try {
        const me = await authService.me()
        if (!cancelled) applyUser(me)
      } catch (error) {
        // Only a rejected token ends the session; a rate limit, timeout or server
        // hiccup keeps the user signed in with the cached profile.
        const storedUser = error?.response?.status === 401 ? null : getStoredUser()
        if (!storedUser) clearSession()
        if (!cancelled) applyUser(storedUser)
      } finally {
        if (!cancelled) setAuthReady(true)
      }
    }

    bootstrapAuth()
    return () => {
      cancelled = true
    }
  }, [applyUser])

  useEffect(() => {
    if (!authReady || !user || user.must_change_password) return undefined

    const perms = Array.isArray(user.permissions) ? user.permissions : []
    const isAdmin = String(user.role || '').toLowerCase() === 'admin'
    const allow = (slug) => isAdmin || perms.includes(slug)

    loadSettings().catch(() => {})
    loadBranches()
    if (allow('vehicles.view')) loadVehicleRentals()
    if (allow('products.view')) loadProducts()
    if (allow('categories.view') || allow('products.view')) loadCategories()
    if (allow('suppliers.view')) loadSuppliers()
    if (allow('customers.view')) loadCustomers()
    if (allow('sales.view')) loadSales().catch(() => {})
    if (allow('rentals.view')) loadRentals().catch(() => {})
    if (allow('bookings.view')) loadBookings().catch(() => {})
    if (allow('income.view')) loadIncome().catch(() => {})
    if (allow('expenses.view')) loadExpenses().catch(() => {})
    if (allow('notifications.view')) loadNotifications({ generate: true }).catch(() => {})
    if (allow('products.view')) loadStockHistory().catch(() => {})
    if (allow('checks.view')) loadChecks().catch(() => {})
    if (allow('maintenance.view')) loadMaintenance().catch(() => {})
    if (allow('reminders.view') || allow('checks.view') || allow('notifications.view')) {
      loadReminders().catch(() => {})
    }

    return undefined
  }, [
    authReady,
    user?.id,
    user?.role,
    user?.permissions,
    user?.must_change_password,
    loadProducts,
    loadCategories,
    loadBranches,
    loadVehicleRentals,
    loadSuppliers,
    loadCustomers,
    loadSales,
    loadRentals,
    loadBookings,
    loadIncome,
    loadExpenses,
    loadNotifications,
    loadStockHistory,
    loadChecks,
    loadMaintenance,
    loadReminders,
  ])

  const login = async ({ email, password }) => {
    const data = await authService.login({ email, password })
    applyUser(data.user)
    return data
  }

  const logout = async () => {
    await authService.logout()
    applyUser(null)
  }

  const refreshUser = async () => {
    const me = await authService.me()
    applyUser(me)
    return me
  }

  const updateProfile = async (payload) => {
    const { user: updated, message } = await authService.updateProfile(payload)
    applyUser(updated)
    return { user: updated, message }
  }

  const can = useCallback(
    (slug) => {
      if (!slug) return true
      if (!user) return false
      if (String(user.role || '').toLowerCase() === 'admin') return true
      return permissions.includes(slug)
    },
    [user, permissions]
  )

  const canAny = useCallback(
    (slugs = []) => {
      if (!slugs.length) return true
      return slugs.some((slug) => can(slug))
    },
    [can]
  )

  const canAll = useCallback(
    (slugs = []) => {
      if (!slugs.length) return true
      return slugs.every((slug) => can(slug))
    },
    [can]
  )

  const syncProductStatus = (product) => ({
    ...product,
    status: product.status === 'Maintenance' ? 'Maintenance' : getStockStatus(product),
  })

  const addProduct = async (product) => {
    const { product: created, message } = await productService.createProduct(product)
    setProducts((prev) => [created, ...prev.filter((p) => Number(p.id) !== Number(created.id))])
    return { product: created, message }
  }

  const updateProduct = async (id, data) => {
    const { product: updated, message } = await productService.updateProduct(id, data)
    setProducts((prev) =>
      prev.map((p) => (Number(p.id) === Number(id) ? syncProductStatus({ ...p, ...updated }) : p))
    )
    return { product: updated, message }
  }

  const transferProductToSale = async (id, salePrice) => {
    const { product: updated, message } = await productService.transferToSale(id, salePrice)
    setProducts((prev) =>
      prev.map((p) => (Number(p.id) === Number(id) ? syncProductStatus({ ...p, ...updated }) : p))
    )
    return { product: updated, message }
  }

  const deleteProduct = async (id) => {
    const result = await productService.deleteProduct(id)
    if (result.deactivated && result.product) {
      setProducts((prev) =>
        prev.map((p) => (Number(p.id) === Number(id) ? { ...p, ...result.product } : p))
      )
    } else {
      setProducts((prev) => prev.filter((p) => Number(p.id) !== Number(id)))
    }
    return result
  }

  const addBranch = async (branch) => {
    const { branch: created, message } = await branchService.createBranch(branch)
    setBranches((prev) =>
      [...prev.filter((b) => Number(b.id) !== Number(created.id)), created].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    )
    return { branch: created, message }
  }

  const addCategory = async (category) => {
    const { category: created, message } = await categoryService.createCategory(category)
    setCategories((prev) => [created, ...prev.filter((c) => Number(c.id) !== Number(created.id))])
    return { category: created, message }
  }

  const updateCategory = async (id, data) => {
    const { category: updated, message } = await categoryService.updateCategory(id, data)
    setCategories((prev) => prev.map((c) => (Number(c.id) === Number(id) ? { ...c, ...updated } : c)))
    return { category: updated, message }
  }

  const deleteCategory = async (id) => {
    const result = await categoryService.deleteCategory(id)
    setCategories((prev) => prev.filter((c) => Number(c.id) !== Number(id)))
    return result
  }

  const addSale = async (sale) => {
    const { sale: created, message } = await saleService.createSale(sale)
    upsertSaleLocal(created)
    await loadProducts()
    return { sale: created, message }
  }

  const updateSale = async (id, data) => {
    const { sale: updated, message } = await saleService.updateSale(id, data)
    upsertSaleLocal(updated)
    await loadProducts()
    return { sale: updated, message }
  }

  const deleteSale = async (id) => {
    const { sale: cancelled, message } = await saleService.deleteSale(id)
    if (cancelled) {
      upsertSaleLocal(cancelled)
    } else {
      setSales((prev) => prev.filter((s) => Number(s.id) !== Number(id)))
    }
    await loadProducts()
    return { sale: cancelled, message }
  }

  const addRental = async (rental) => {
    const { rental: created, message } = await rentalService.createRental(rental)
    upsertRentalLocal(created)
    await loadProducts()
    return { rental: created, message }
  }

  const updateRental = async (id, data) => {
    const { rental: updated, message } = await rentalService.updateRental(id, data)
    upsertRentalLocal(updated)
    await loadProducts()
    return { rental: updated, message }
  }

  const deleteRental = async (id) => {
    const result = await rentalService.deleteRental(id)
    setRentals((prev) => prev.filter((r) => Number(r.id) !== Number(id)))
    await loadProducts()
    return result
  }

  const completeRentalReturn = async (rentalId, returnData) => {
    const { rental: updated, message } = await rentalService.returnRental(rentalId, returnData)
    upsertRentalLocal(updated)
    await loadProducts()
    return { rental: updated, message }
  }

  const addSalePayment = async (saleId, data) => {
    const { sale, message } = await saleService.addSalePayment(saleId, data)
    if (sale) upsertSaleLocal(sale)
    return { sale, message }
  }

  const addRentalPayment = async (rentalId, data) => {
    const { payment, rental, message } = await rentalService.addRentalPayment(rentalId, data)
    if (rental) upsertRentalLocal(rental)
    return { payment, rental, message }
  }

  const updateRentalPayment = async (rentalId, paymentId, data) => {
    const { payment, rental, message } = await rentalService.updateRentalPayment(
      rentalId,
      paymentId,
      data
    )
    if (rental) upsertRentalLocal(rental)
    return { payment, rental, message }
  }

  const deleteRentalPayment = async (rentalId, paymentId) => {
    const { rental, message } = await rentalService.deleteRentalPayment(rentalId, paymentId)
    if (rental) upsertRentalLocal(rental)
    return { rental, message }
  }

  const getRentalReturn = async (rentalId) => rentalService.getRentalReturn(rentalId)

  const addBooking = async (booking) => {
    const { booking: created, message } = await bookingService.createBooking(booking)
    upsertBookingLocal(created)
    return { booking: created, message }
  }

  const updateBooking = async (id, data) => {
    const { booking: updated, message } = await bookingService.updateBooking(id, data)
    upsertBookingLocal(updated)
    return { booking: updated, message }
  }

  const deleteBooking = async (id) => {
    const result = await bookingService.deleteBooking(id)
    setBookings((prev) => prev.filter((b) => Number(b.id) !== Number(id)))
    return result
  }

  const updateBookingStatus = async (id, status) => {
    const { booking, message } = await bookingService.updateBookingStatus(id, status)
    upsertBookingLocal(booking)
    return { booking, message }
  }

  const convertBookingToRental = async (id, data = {}) => {
    const { booking, rental, message } = await bookingService.convertBookingToRental(id, data)
    upsertBookingLocal(booking)
    if (rental) {
      setRentals((prev) => {
        const exists = prev.some((r) => Number(r.id) === Number(rental.id))
        if (exists) {
          return prev.map((r) => (Number(r.id) === Number(rental.id) ? { ...r, ...rental } : r))
        }
        return [rental, ...prev]
      })
      await loadProducts()
    }
    return { booking, rental, message }
  }

  const checkEquipmentAvailability = async (params) => bookingService.checkAvailability(params)

  const returns = useMemo(
    () =>
      rentals
        .flatMap((rental) =>
          (rental.returns || []).map((ret) => ({
            ...ret,
            rentalDbId: rental.id,
            rentalId: rental.rentalId,
            customer: rental.customer,
            product: (ret.items || []).length
              ? ret.items.map((line) => line.productName).filter(Boolean).join(', ')
              : rental.items?.map((i) => i.product).filter(Boolean).join(', ') || rental.product,
            rentedQty: (rental.items || []).reduce((sum, i) => sum + Number(i.quantity || 0), 0) || rental.quantity,
            deposit: rental.deposit,
            returnStatus: ret.status || 'Completed',
          }))
        )
        .sort((a, b) => String(b.returnDate).localeCompare(String(a.returnDate)) || b.id - a.id),
    [rentals]
  )

  const upsertIncomeLocal = (record) => {
    if (!record) return
    setIncome((prev) => {
      const exists = prev.some((i) => Number(i.id) === Number(record.id))
      return exists
        ? prev.map((i) => (Number(i.id) === Number(record.id) ? { ...i, ...record } : i))
        : [record, ...prev]
    })
    setIncomePayments((prev) => {
      const without = prev.filter((p) => Number(p.incomeRecordId) !== Number(record.id))
      return [...flattenIncomePayments([record]), ...without]
    })
  }

  const upsertExpenseLocal = (record) => {
    if (!record) return
    setExpenses((prev) => {
      const exists = prev.some((e) => Number(e.id) === Number(record.id))
      return exists
        ? prev.map((e) => (Number(e.id) === Number(record.id) ? { ...e, ...record } : e))
        : [record, ...prev]
    })
    setExpensePayments((prev) => {
      const without = prev.filter((p) => Number(p.expenseRecordId) !== Number(record.id))
      return [...flattenExpensePayments([record]), ...without]
    })
  }

  const addIncome = async (item) => {
    const { income: created, message } = await incomeService.createIncome(item)
    upsertIncomeLocal(created)
    return { income: created, message }
  }

  const updateIncome = async (id, data) => {
    const { income: updated, message } = await incomeService.updateIncome(id, data)
    upsertIncomeLocal(updated)
    return { income: updated, message }
  }

  const deleteIncome = async (id) => {
    const result = await incomeService.deleteIncome(id)
    setIncome((prev) => prev.filter((i) => Number(i.id) !== Number(id)))
    setIncomePayments((prev) => prev.filter((p) => Number(p.incomeRecordId) !== Number(id)))
    return result
  }

  const addIncomePayment = async (incomeRecordId, payment) => {
    const { payment: created, income: updated, message } = await incomeService.addIncomePayment(
      incomeRecordId,
      payment
    )
    if (updated) upsertIncomeLocal(updated)
    return { payment: created, income: updated, message }
  }

  const updateIncomePayment = async (paymentId, data) => {
    const existing = incomePayments.find((p) => Number(p.id) === Number(paymentId))
    if (!existing?.incomeRecordId) throw new Error('Payment not found')
    const { payment: updatedPayment, income: updated, message } =
      await incomeService.updateIncomePayment(existing.incomeRecordId, paymentId, data)
    if (updated) upsertIncomeLocal(updated)
    return { payment: updatedPayment, income: updated, message }
  }

  const deleteIncomePayment = async (paymentId) => {
    const existing = incomePayments.find((p) => Number(p.id) === Number(paymentId))
    if (!existing?.incomeRecordId) throw new Error('Payment not found')
    const { income: updated, message } = await incomeService.deleteIncomePayment(
      existing.incomeRecordId,
      paymentId
    )
    if (updated) upsertIncomeLocal(updated)
    return { income: updated, message }
  }

  const addExpense = async (item) => {
    const { expense: created, message } = await expenseService.createExpense(item)
    upsertExpenseLocal(created)
    return { expense: created, message }
  }

  const updateExpense = async (id, data) => {
    const { expense: updated, message } = await expenseService.updateExpense(id, data)
    upsertExpenseLocal(updated)
    return { expense: updated, message }
  }

  const deleteExpense = async (id) => {
    const result = await expenseService.deleteExpense(id)
    setExpenses((prev) => prev.filter((e) => Number(e.id) !== Number(id)))
    setExpensePayments((prev) => prev.filter((p) => Number(p.expenseRecordId) !== Number(id)))
    return result
  }

  const addExpensePayment = async (expenseRecordId, payment) => {
    const { payment: created, expense: updated, message } = await expenseService.addExpensePayment(
      expenseRecordId,
      payment
    )
    if (updated) upsertExpenseLocal(updated)
    return { payment: created, expense: updated, message }
  }

  const updateExpensePayment = async (paymentId, data) => {
    const existing = expensePayments.find((p) => Number(p.id) === Number(paymentId))
    if (!existing?.expenseRecordId) throw new Error('Payment not found')
    const { payment: updatedPayment, expense: updated, message } =
      await expenseService.updateExpensePayment(existing.expenseRecordId, paymentId, data)
    if (updated) upsertExpenseLocal(updated)
    return { payment: updatedPayment, expense: updated, message }
  }

  const deleteExpensePayment = async (paymentId) => {
    const existing = expensePayments.find((p) => Number(p.id) === Number(paymentId))
    if (!existing?.expenseRecordId) throw new Error('Payment not found')
    const { expense: updated, message } = await expenseService.deleteExpensePayment(
      existing.expenseRecordId,
      paymentId
    )
    if (updated) upsertExpenseLocal(updated)
    return { expense: updated, message }
  }

  const addCheck = async (item) => {
    const { check, message } = await checkService.createCheck(item)
    setChecks((prev) => [check, ...prev.filter((c) => Number(c.id) !== Number(check.id))])
    return { check, message }
  }

  const updateCheck = async (id, data) => {
    const { check, message } = await checkService.updateCheck(id, data)
    setChecks((prev) => prev.map((c) => (Number(c.id) === Number(id) ? { ...c, ...check } : c)))
    return { check, message }
  }

  const completeCheck = async (id, data = {}) => {
    const { check, message } = await checkService.completeCheck(id, data)
    setChecks((prev) => prev.map((c) => (Number(c.id) === Number(id) ? { ...c, ...check } : c)))
    return { check, message }
  }

  const deleteCheck = async (id) => {
    const { message } = await checkService.deleteCheck(id)
    setChecks((prev) => prev.filter((c) => Number(c.id) !== Number(id)))
    return { message }
  }

  const syncProductMaintenanceState = (productId, nextRecords) => {
    if (!productId) return
    setProducts((prev) =>
      prev.map((p) => {
        if (Number(p.id) !== Number(productId)) return p
        const stillActive = productHasActiveMaintenance(productId, nextRecords)
        if (stillActive) {
          return p.status === 'Maintenance' ? p : markProductUnderMaintenance(p)
        }
        if (p.status === 'Maintenance') {
          return releaseProductFromMaintenance(p)
        }
        return p
      })
    )
  }

  const addMaintenance = async (item) => {
    const { maintenance: record, message } = await maintenanceService.createMaintenance(item)
    const next = [record, ...maintenance.filter((m) => Number(m.id) !== Number(record.id))]
    setMaintenance(next)
    syncProductMaintenanceState(record.productId, next)
    await loadProducts().catch(() => {})
    return { maintenance: record, message }
  }

  const updateMaintenance = async (id, data) => {
    const { maintenance: updated, message } = await maintenanceService.updateMaintenance(id, data)
    const next = maintenance.map((m) => (Number(m.id) === Number(id) ? { ...m, ...updated } : m))
    setMaintenance(next)
    syncProductMaintenanceState(updated?.productId || data.productId, next)
    await loadProducts().catch(() => {})
    return { maintenance: updated, message }
  }

  const completeMaintenance = async (id, data = {}) => {
    const { maintenance: updated, message } = await maintenanceService.completeMaintenance(id, data)
    const next = maintenance.map((m) => (Number(m.id) === Number(id) ? { ...m, ...updated } : m))
    setMaintenance(next)
    syncProductMaintenanceState(updated?.productId, next)
    await loadProducts().catch(() => {})
    return { maintenance: updated, message }
  }

  const cancelMaintenance = async (id, data = {}) => {
    const { maintenance: updated, message } = await maintenanceService.cancelMaintenance(id, data)
    const next = maintenance.map((m) => (Number(m.id) === Number(id) ? { ...m, ...updated } : m))
    setMaintenance(next)
    syncProductMaintenanceState(updated?.productId, next)
    await loadProducts().catch(() => {})
    return { maintenance: updated, message }
  }

  const deleteMaintenance = async (id) => {
    const existing = maintenance.find((m) => Number(m.id) === Number(id))
    const { message } = await maintenanceService.deleteMaintenance(id)
    const next = maintenance.filter((m) => Number(m.id) !== Number(id))
    setMaintenance(next)
    if (existing?.productId) {
      syncProductMaintenanceState(existing.productId, next)
    }
    await loadProducts().catch(() => {})
    return { message }
  }

  const addRecurringReminder = async (item) => {
    const payload = {
      ...item,
      title: item.title || item.reminder,
      dueDate: item.dueDate || item.nextReminder,
      nextReminder: item.nextReminder || item.dueDate,
      isRecurring: true,
      reminderType: item.reminderType || 'Recurring',
      status: item.status === 'Paused' ? 'Dismissed' : 'Pending',
      apiStatus: item.status === 'Paused' ? 'Dismissed' : 'Pending',
    }
    const { reminder, message } = await reminderService.createReminder(payload)
    setRecurringReminders((prev) => [reminder, ...prev.filter((r) => Number(r.id) !== Number(reminder.id))])
    return { reminder, message }
  }

  const updateRecurringReminder = async (id, data) => {
    const payload = {
      ...data,
      title: data.title || data.reminder,
      dueDate: data.dueDate || data.nextReminder,
      nextReminder: data.nextReminder || data.dueDate,
      isRecurring: true,
      reminderType: data.reminderType || 'Recurring',
      status: data.status === 'Paused' ? 'Dismissed' : data.status === 'Active' ? 'Pending' : data.status,
    }
    const { reminder, message } = await reminderService.updateReminder(id, payload)
    setRecurringReminders((prev) =>
      prev.map((r) => (Number(r.id) === Number(id) ? { ...r, ...reminder } : r))
    )
    return { reminder, message }
  }

  const deleteRecurringReminder = async (id) => {
    const { message } = await reminderService.deleteReminder(id)
    setRecurringReminders((prev) => prev.filter((r) => Number(r.id) !== Number(id)))
    return { message }
  }

  const addReminder = async (item) => {
    const { reminder, message } = await reminderService.createReminder(item)
    if (reminder.isRecurring) {
      setRecurringReminders((prev) => [reminder, ...prev.filter((r) => Number(r.id) !== Number(reminder.id))])
    } else {
      setReminders((prev) => [reminder, ...prev.filter((r) => Number(r.id) !== Number(reminder.id))])
    }
    return { reminder, message }
  }

  const updateReminder = async (id, data) => {
    const { reminder, message } = await reminderService.updateReminder(id, data)
    setReminders((prev) => prev.map((r) => (Number(r.id) === Number(id) ? { ...r, ...reminder } : r)))
    setRecurringReminders((prev) =>
      prev.map((r) => (Number(r.id) === Number(id) ? { ...r, ...reminder } : r))
    )
    return { reminder, message }
  }

  const setReminderOverride = (reminderId, patch) => {
    setReminderOverrides((prev) => ({
      ...prev,
      [reminderId]: { ...(prev[reminderId] || {}), ...patch },
    }))
  }

  const markReminderRead = async (reminderId) => {
    if (Number.isFinite(Number(reminderId))) {
      // Pending reminders stay pending; "read" is a UI concern — dismiss not required
      setReminderOverride(reminderId, { read: true, status: 'Read' })
      return
    }
    setReminderOverride(reminderId, { read: true, status: 'Read' })
  }

  const completeReminder = async (reminderId) => {
    if (Number.isFinite(Number(reminderId))) {
      const { reminder, message } = await reminderService.completeReminder(reminderId)
      setReminders((prev) => prev.map((r) => (Number(r.id) === Number(reminderId) ? { ...r, ...reminder } : r)))
      setReminderOverride(reminderId, { completed: true, status: 'Completed', read: true })
      return { reminder, message }
    }
    setReminderOverride(reminderId, { completed: true, status: 'Completed', read: true })
    return { message: 'Reminder completed.' }
  }

  const dismissReminder = async (reminderId) => {
    if (Number.isFinite(Number(reminderId))) {
      const { reminder, message } = await reminderService.dismissReminder(reminderId)
      setReminders((prev) => prev.map((r) => (Number(r.id) === Number(reminderId) ? { ...r, ...reminder } : r)))
      setReminderOverride(reminderId, { completed: true, status: 'Completed', read: true })
      return { reminder, message }
    }
    setReminderOverride(reminderId, { completed: true, status: 'Completed', read: true })
    return { message: 'Reminder dismissed.' }
  }

  const snoozeReminder = async (reminderId, patch) => {
    if (Number.isFinite(Number(reminderId)) && (patch?.dueDate || patch?.nextReminder)) {
      const { reminder, message } = await reminderService.updateReminder(reminderId, {
        dueDate: patch.dueDate || patch.nextReminder,
        nextReminder: patch.nextReminder || patch.dueDate,
        status: 'Pending',
      })
      setReminders((prev) => prev.map((r) => (Number(r.id) === Number(reminderId) ? { ...r, ...reminder } : r)))
      setReminderOverride(reminderId, patch)
      return { reminder, message }
    }
    setReminderOverride(reminderId, patch)
    return { message: 'Reminder snoozed.' }
  }

  const addNotification = async (data) => {
    const { notification: created, message } = await notificationService.createNotification(data)
    setNotifications((prev) => [created, ...prev.filter((n) => Number(n.id) !== Number(created.id))])
    await refreshUnreadNotificationCount()
    return { notification: created, message }
  }

  const updateNotification = async (id, data) => {
    const { notification: updated, message } = await notificationService.updateNotification(id, data)
    setNotifications((prev) =>
      prev.map((n) => (Number(n.id) === Number(id) ? { ...n, ...updated } : n))
    )
    await refreshUnreadNotificationCount()
    return { notification: updated, message }
  }

  const markNotificationRead = async (id) => {
    const { notification: updated, message } = await notificationService.markAsRead(id)
    setNotifications((prev) =>
      prev.map((n) => (Number(n.id) === Number(id) ? { ...n, ...updated, read: true } : n))
    )
    await refreshUnreadNotificationCount()
    return { notification: updated, message }
  }

  const dismissNotification = async (id) => {
    const { notification: updated, message } = await notificationService.dismissNotification(id)
    setNotifications((prev) => prev.filter((n) => Number(n.id) !== Number(id)))
    await refreshUnreadNotificationCount()
    return { notification: updated, message }
  }

  const markAllNotificationsRead = async () => {
    const result = await notificationService.markAllAsRead()
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, status: n.status === 'Dismissed' ? n.status : 'Read' }))
    )
    setUnreadNotificationCount(0)
    return result
  }

  const deleteNotification = async (id) => {
    const result = await notificationService.deleteNotification(id)
    setNotifications((prev) => prev.filter((n) => Number(n.id) !== Number(id)))
    await refreshUnreadNotificationCount()
    return result
  }

  const addCustomer = async (customer) => {
    const { customer: created, message } = await customerService.createCustomer(customer)
    setCustomers((prev) => [created, ...prev.filter((c) => Number(c.id) !== Number(created.id))])
    return { customer: created, message }
  }

  const updateCustomer = async (id, data) => {
    const { customer: updated, message } = await customerService.updateCustomer(id, data)
    setCustomers((prev) => prev.map((c) => (Number(c.id) === Number(id) ? { ...c, ...updated } : c)))
    return { customer: updated, message }
  }

  const uploadCustomerIdPhoto = async (id, file) => {
    const { customer: updated, message } = await customerService.uploadIdPhoto(id, file)
    setCustomers((prev) => prev.map((c) => (Number(c.id) === Number(id) ? { ...c, ...updated } : c)))
    return { customer: updated, message }
  }

  const removeCustomerIdPhoto = async (id) => {
    const { customer: updated, message } = await customerService.deleteIdPhoto(id)
    setCustomers((prev) => prev.map((c) => (Number(c.id) === Number(id) ? { ...c, ...updated } : c)))
    return { customer: updated, message }
  }

  const deleteCustomer = async (id) => {
    const result = await customerService.deleteCustomer(id)
    if (result.deactivated && result.customer) {
      setCustomers((prev) =>
        prev.map((c) => (Number(c.id) === Number(id) ? { ...c, ...result.customer } : c))
      )
    } else {
      setCustomers((prev) => prev.filter((c) => Number(c.id) !== Number(id)))
    }
    return result
  }

  const addSupplier = async (supplier) => {
    const { supplier: created, message } = await supplierService.createSupplier(supplier)
    setSuppliers((prev) => [created, ...prev.filter((s) => Number(s.id) !== Number(created.id))])
    return { supplier: created, message }
  }

  const updateSupplier = async (id, data) => {
    const { supplier: updated, message } = await supplierService.updateSupplier(id, data)
    setSuppliers((prev) => prev.map((s) => (Number(s.id) === Number(id) ? { ...s, ...updated } : s)))
    return { supplier: updated, message }
  }

  const deleteSupplier = async (id) => {
    const result = await supplierService.deleteSupplier(id)
    if (result.deactivated && result.supplier) {
      setSuppliers((prev) =>
        prev.map((s) => (Number(s.id) === Number(id) ? { ...s, ...result.supplier } : s))
      )
    } else {
      setSuppliers((prev) => prev.filter((s) => Number(s.id) !== Number(id)))
    }
    return result
  }

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true)
    setSettingsError(null)
    try {
      const data = await settingsService.getSettings()
      setSettings(data)
      return data
    } catch (error) {
      setSettingsError(getApiErrorMessage(error, 'Unable to load settings.'))
      throw error
    } finally {
      setSettingsLoading(false)
    }
  }, [])

  const updateSettings = async (data) => {
    const { settings: saved, message } = await settingsService.updateSettings({ ...settings, ...data })
    setSettings(saved)
    return { settings: saved, message }
  }

  const uploadCompanyLogo = async (file) => {
    const { settings: saved, message } = await settingsService.uploadLogo(file)
    setSettings(saved)
    return { settings: saved, message }
  }

  const removeCompanyLogo = async () => {
    const { settings: saved, message } = await settingsService.removeLogo()
    setSettings(saved)
    return { settings: saved, message }
  }

  const stats = useMemo(() => {
    const totalProducts = products.length
    const inventoryValue = products.reduce((sum, p) => sum + p.purchaseCost * p.quantity, 0)
    const totalSales = sales
      .filter((s) => s.saleStatus !== 'Cancelled' && s.saleStatus !== 'Refunded')
      .reduce((sum, s) => sum + Number(s.total || 0), 0)
    const rentalIncome = rentals.reduce((sum, r) => sum + r.total, 0)
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
    const totalIncome = income.reduce((sum, i) => sum + i.amount, 0)
    const netIncome = totalIncome - totalExpenses
    const activeRentals = rentals.filter((r) => r.rentalStatus === 'Active').length
    const pendingBookings = bookings.filter((b) => b.status === 'Pending').length
    const lowStock = products.filter((p) => p.available <= p.minStock)
    const upcomingChecks = checks.filter((c) =>
      ['Upcoming', 'Overdue', 'Due Today', 'Scheduled'].includes(c.status)
    )
    return {
      totalProducts,
      inventoryValue,
      totalSales,
      rentalIncome,
      totalExpenses,
      totalIncome,
      netIncome,
      activeRentals,
      pendingBookings,
      lowStock,
      upcomingChecks,
    }
  }, [products, sales, rentals, expenses, income, bookings, checks])

  const liveCalendarEvents = useMemo(
    () =>
      buildCalendarEvents({
        bookings,
        rentals,
        sales,
        checks,
        maintenance,
        reminders: [...reminders, ...recurringReminders],
        vehicleRentals,
        staticEvents: [],
      }),
    [bookings, rentals, sales, checks, maintenance, reminders, recurringReminders, vehicleRentals]
  )

  const isAdmin = Boolean(
    user && (String(user.role_slug || '').toLowerCase() === 'admin' || String(user.role || '').toLowerCase() === 'admin')
  )

  const value = {
    user,
    isAdmin,
    authReady,
    permissions,
    can,
    canAny,
    canAll,
    login,
    logout,
    refreshUser,
    updateProfile,
    products,
    productsLoading,
    productsError,
    loadProducts,
    loadProduct,
    addProduct,
    updateProduct,
    transferProductToSale,
    deleteProduct,
    addCategory,
    updateCategory,
    deleteCategory,
    customers,
    customersLoading,
    customersError,
    loadCustomers,
    loadCustomer,
    addCustomer,
    updateCustomer,
    uploadCustomerIdPhoto,
    removeCustomerIdPhoto,
    deleteCustomer,
    suppliers,
    suppliersLoading,
    suppliersError,
    loadSuppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    sales,
    salesLoading,
    salesError,
    loadSales,
    loadSale,
    addSale,
    updateSale,
    deleteSale,
    rentals,
    rentalsLoading,
    rentalsError,
    loadRentals,
    loadRental,
    addRental,
    updateRental,
    deleteRental,
    completeRentalReturn,
    addSalePayment,
    addRentalPayment,
    updateRentalPayment,
    deleteRentalPayment,
    getRentalReturn,
    bookings,
    bookingsLoading,
    bookingsError,
    loadBookings,
    loadBooking,
    addBooking,
    updateBooking,
    deleteBooking,
    updateBookingStatus,
    convertBookingToRental,
    checkEquipmentAvailability,
    returns,
    income,
    incomeLoading,
    incomeError,
    loadIncome,
    loadIncomeRecord,
    addIncome,
    updateIncome,
    deleteIncome,
    incomePayments,
    addIncomePayment,
    updateIncomePayment,
    deleteIncomePayment,
    expenses,
    expensesLoading,
    expensesError,
    loadExpenses,
    loadExpense,
    addExpense,
    updateExpense,
    deleteExpense,
    expensePayments,
    addExpensePayment,
    updateExpensePayment,
    deleteExpensePayment,
    checks,
    checksLoading,
    checksError,
    loadChecks,
    addCheck,
    updateCheck,
    completeCheck,
    deleteCheck,
    maintenance,
    maintenanceLoading,
    maintenanceError,
    loadMaintenance,
    addMaintenance,
    updateMaintenance,
    completeMaintenance,
    cancelMaintenance,
    deleteMaintenance,
    reminders,
    remindersLoading,
    remindersError,
    loadReminders,
    addReminder,
    updateReminder,
    dismissReminder,
    recurringReminders,
    addRecurringReminder,
    updateRecurringReminder,
    deleteRecurringReminder,
    reminderOverrides,
    markReminderRead,
    completeReminder,
    snoozeReminder,
    notifications,
    notificationsLoading,
    notificationsError,
    unreadNotificationCount,
    loadNotifications,
    refreshUnreadNotificationCount,
    addNotification,
    updateNotification,
    markNotificationRead,
    dismissNotification,
    markAllNotificationsRead,
    deleteNotification,
    stockHistory,
    stockHistoryLoading,
    stockHistoryError,
    loadStockHistory,
    setStockHistory,
    categories,
    categoriesLoading,
    categoriesError,
    loadCategories,
    branches,
    loadBranches,
    addBranch,
    vehicleRentals,
    loadVehicleRentals,
    setCategories,
    settings,
    settingsLoading,
    settingsError,
    loadSettings,
    updateSettings,
    uploadCompanyLogo,
    removeCompanyLogo,
    stats,
    calendarEvents: liveCalendarEvents,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
