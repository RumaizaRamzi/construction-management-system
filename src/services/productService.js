import api, { unwrapApiData } from './api'
import { mapProductFromApi, mapProductToApi } from '../utils/apiMappers'
import fetchAllPages from './fetchAllPages'

export const productService = {
  async getProducts(params) {
    const rows = await fetchAllPages('/products', params)
    return rows.map(mapProductFromApi).filter(Boolean)
  },

  async getProduct(id) {
    const response = await api.get(`/products/${id}`)
    return mapProductFromApi(unwrapApiData(response))
  },

  async createProduct(data) {
    const response = await api.post('/products', mapProductToApi(data))
    return {
      product: mapProductFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Product created successfully.',
    }
  },

  async updateProduct(id, data) {
    const response = await api.put(`/products/${id}`, mapProductToApi(data))
    return {
      product: mapProductFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Product updated successfully.',
    }
  },

  async deleteProduct(id) {
    const response = await api.delete(`/products/${id}`)
    const payload = unwrapApiData(response)
    const message = response.data?.message || 'Product deleted successfully.'
    return {
      product: payload ? mapProductFromApi(payload) : null,
      deactivated: /deactivated/i.test(message) || payload?.status === 'Inactive',
      message,
    }
  },

  async transferToSale(id, salePrice) {
    const response = await api.post(`/products/${id}/transfer-to-sale`, {
      sale_price: salePrice === '' || salePrice == null ? undefined : Number(salePrice),
    })
    return {
      product: mapProductFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Product transferred to sales inventory.',
    }
  },

  async adjustStock(id, data) {
    const response = await api.post(`/products/${id}/adjust-stock`, {
      quantity_delta: data.quantityDelta ?? data.quantity_delta ?? data.quantity,
      new_quantity: data.newQuantity ?? data.new_quantity,
      reason: data.reason,
      movement_type: data.movementType || data.movement_type,
    })
    return {
      product: mapProductFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Stock adjusted successfully.',
    }
  },
}

export default productService
