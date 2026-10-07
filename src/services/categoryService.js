import api, { unwrapApiData } from './api'
import { mapCategoryFromApi, mapCategoryToApi } from '../utils/apiMappers'
import fetchAllPages from './fetchAllPages'

export const categoryService = {
  async getCategories(params) {
    const rows = await fetchAllPages('/categories', params)
    return rows.map(mapCategoryFromApi).filter(Boolean)
  },

  async getCategory(id) {
    const response = await api.get(`/categories/${id}`)
    return mapCategoryFromApi(unwrapApiData(response))
  },

  async createCategory(data) {
    const response = await api.post('/categories', mapCategoryToApi(data))
    return {
      category: mapCategoryFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Category created successfully.',
    }
  },

  async updateCategory(id, data) {
    const response = await api.put(`/categories/${id}`, mapCategoryToApi(data))
    return {
      category: mapCategoryFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Category updated successfully.',
    }
  },

  async deleteCategory(id) {
    const response = await api.delete(`/categories/${id}`)
    return {
      message: response.data?.message || 'Category deleted successfully.',
    }
  },
}

export default categoryService
