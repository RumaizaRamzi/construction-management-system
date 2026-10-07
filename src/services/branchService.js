import api, { unwrapApiData } from './api'
import { mapBranchFromApi, mapBranchToApi } from '../utils/apiMappers'

export const branchService = {
  async getBranches() {
    const response = await api.get('/branches')
    const rows = unwrapApiData(response)
    return (Array.isArray(rows) ? rows : []).map(mapBranchFromApi).filter(Boolean)
  },

  async createBranch(data) {
    const response = await api.post('/branches', mapBranchToApi(data))
    return {
      branch: mapBranchFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Branch created successfully.',
    }
  },

  async updateBranch(id, data) {
    const response = await api.put(`/branches/${id}`, mapBranchToApi(data))
    return {
      branch: mapBranchFromApi(unwrapApiData(response)),
      message: response.data?.message || 'Branch updated successfully.',
    }
  },

  async deleteBranch(id) {
    const response = await api.delete(`/branches/${id}`)
    return {
      message: response.data?.message || 'Branch deleted successfully.',
    }
  },
}

export default branchService
