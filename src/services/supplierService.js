import api, { unwrapApiData } from './api'
import { mapProductFromApi, mapPurchaseFromApi, mapSupplierFromApi, mapSupplierToApi } from '../utils/apiMappers'
import fetchAllPages from './fetchAllPages'

export const supplierService = {
  async getSuppliers(params) {
    const rows = await fetchAllPages('/suppliers', params)
    return rows.map(mapSupplierFromApi).filter(Boolean)
  },

  async getSupplier(id) {
    const response = await api.get(`/suppliers/${id}`)
    return mapSupplierFromApi(unwrapApiData(response))
  },

  async getSupplierDetails(id) {
    const response = await api.get(`/suppliers/${id}`)
    const payload = response.data?.data || {}
    return {
      supplier: mapSupplierFromApi(payload),
      products: Array.isArray(payload.products) ? payload.products.map(mapProductFromApi).filter(Boolean) : [],
      purchases: Array.isArray(payload.purchases) ? payload.purchases.map(mapPurchaseFromApi).filter(Boolean) : null,
      purchaseTotals: payload.purchase_totals || null,
    }
  },

  async createSupplier(data) {
    const response = await api.post('/suppliers', mapSupplierToApi(data))
    return {
      supplier: mapSupplierFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Supplier created successfully.',
    }
  },

  async updateSupplier(id, data) {
    const response = await api.put(`/suppliers/${id}`, mapSupplierToApi(data))
    return {
      supplier: mapSupplierFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Supplier updated successfully.',
    }
  },

  async deleteSupplier(id) {
    const response = await api.delete(`/suppliers/${id}`)
    const payload = unwrapApiData(response)
    return {
      supplier: payload ? mapSupplierFromApi(payload) : null,
      deactivated: Boolean(payload && payload.status === 'Inactive'),
      message: response.data?.message || 'Supplier deleted successfully.',
    }
  },
}

export default supplierService
