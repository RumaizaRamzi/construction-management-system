import api from './api'
import {
  mapAssignmentFromApi,
  mapAttendanceFromApi,
  mapStaffFromApi,
  mapStaffRoleFromApi,
  mapStaffToApi,
} from '../utils/staffHelpers'

const list = (rows, mapper) => (Array.isArray(rows) ? rows : []).map(mapper).filter(Boolean)

export const staffService = {
  /** One server-side page: `{ rows, page, totalPages, total }`. */
  async getStaff(params = {}) {
    const response = await api.get('/staff', { params })
    const body = response.data?.data || {}
    return {
      rows: list(body.data, mapStaffFromApi),
      page: Number(body.current_page || 1),
      totalPages: Number(body.last_page || 1),
      total: Number(body.total || 0),
    }
  },

  async getSummary() {
    const response = await api.get('/staff/summary')
    const s = response.data?.data || {}
    return {
      total: Number(s.total || 0),
      active: Number(s.active || 0),
      inactive: Number(s.inactive || 0),
      onLeaveToday: Number(s.on_leave_today || 0),
    }
  },

  async getStaffMember(id) {
    const response = await api.get(`/staff/${id}`)
    const payload = response.data?.data || {}
    const summary = payload.attendance_summary || {}
    return {
      staff: mapStaffFromApi(payload),
      month: payload.month || '',
      attendanceSummary: {
        present: Number(summary.present || 0),
        absent: Number(summary.absent || 0),
        late: Number(summary.late || 0),
        leave: Number(summary.leave || 0),
        halfDay: Number(summary.half_day || 0),
        markedDays: Number(summary.marked_days || 0),
      },
      attendance: list(payload.attendance, mapAttendanceFromApi),
      assignments: list(payload.assignments, mapAssignmentFromApi),
      activity: Array.isArray(payload.activity) ? payload.activity : [],
    }
  },

  async createStaff(data) {
    const response = await api.post('/staff', mapStaffToApi(data))
    return { staff: mapStaffFromApi(response.data?.data), message: response.data?.message || 'Staff member added successfully.' }
  },

  async updateStaff(id, data) {
    const response = await api.put(`/staff/${id}`, mapStaffToApi(data))
    return { staff: mapStaffFromApi(response.data?.data), message: response.data?.message || 'Staff member updated successfully.' }
  },

  async setStatus(id, status) {
    const response = await api.patch(`/staff/${id}`, { status })
    return { staff: mapStaffFromApi(response.data?.data), message: response.data?.message || 'Staff status updated.' }
  },

  async uploadPhoto(id, file) {
    const body = new FormData()
    body.append('photo', file)
    const response = await api.post(`/staff/${id}/photo`, body, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 })
    return { staff: mapStaffFromApi(response.data?.data), message: response.data?.message || 'Staff photo uploaded successfully.' }
  },

  async deletePhoto(id) {
    const response = await api.delete(`/staff/${id}/photo`)
    return { staff: mapStaffFromApi(response.data?.data), message: response.data?.message || 'Staff photo removed successfully.' }
  },

  async getPhotoBlob(id) {
    const response = await api.get(`/staff/${id}/photo`, { responseType: 'blob' })
    return response.data
  },

  async getRoles() {
    const response = await api.get('/staff-roles')
    return list(response.data?.data, mapStaffRoleFromApi)
  },

  async createRole(data) {
    const response = await api.post('/staff-roles', { name: data.name?.trim(), description: data.description?.trim() || null })
    return { role: mapStaffRoleFromApi(response.data?.data), message: response.data?.message || 'Role added successfully.' }
  },

  async updateRole(id, data) {
    const response = await api.put(`/staff-roles/${id}`, { name: data.name?.trim(), description: data.description?.trim() || null })
    return { role: mapStaffRoleFromApi(response.data?.data), message: response.data?.message || 'Role updated successfully.' }
  },

  async deleteRole(id) {
    const response = await api.delete(`/staff-roles/${id}`)
    return { message: response.data?.message || 'Role deleted successfully.' }
  },

  async getAttendance(date) {
    const response = await api.get('/attendance', { params: { date } })
    const payload = response.data?.data || {}
    return {
      date: payload.date || date,
      rows: (Array.isArray(payload.rows) ? payload.rows : []).map((row) => ({
        staffId: row.staff_id,
        staffCode: row.staff_code || '',
        fullName: row.full_name || '',
        roleName: row.role_name || '',
        branchName: row.branch_name || '',
        staffStatus: row.staff_status || 'Active',
        attendance: mapAttendanceFromApi(row.attendance),
      })),
    }
  },

  async saveAttendance(date, records) {
    const response = await api.post('/attendance/bulk', {
      date,
      records: records.map((r) => ({
        staff_id: r.staffId,
        status: r.status,
        check_in: r.checkIn || null,
        check_out: r.checkOut || null,
        notes: r.notes?.trim() || null,
      })),
    })
    return { message: response.data?.message || 'Attendance saved.' }
  },

  async getMonthlySummary(month) {
    const response = await api.get('/attendance/summary', { params: { month } })
    const payload = response.data?.data || {}
    return {
      month: payload.month || month,
      daysInMonth: Number(payload.days_in_month || 30),
      rows: (Array.isArray(payload.rows) ? payload.rows : []).map((row) => ({
        staffId: row.staff_id,
        staffCode: row.staff_code || '',
        fullName: row.full_name || '',
        roleName: row.role_name || '',
        staffStatus: row.staff_status || 'Active',
        present: Number(row.present || 0),
        absent: Number(row.absent || 0),
        late: Number(row.late || 0),
        leave: Number(row.leave || 0),
        halfDay: Number(row.half_day || 0),
        markedDays: Number(row.marked_days || 0),
        days: row.days && typeof row.days === 'object' ? row.days : {},
      })),
    }
  },

  async createAssignment(staffId, data) {
    const response = await api.post(`/staff/${staffId}/assignments`, {
      vehicle_id: data.vehicleId ? Number(data.vehicleId) : null,
      rental_id: data.rentalId ? Number(data.rentalId) : null,
      assigned_from: data.assignedFrom || null,
      assigned_to: data.assignedTo || null,
      notes: data.notes?.trim() || null,
    })
    return { assignment: mapAssignmentFromApi(response.data?.data), message: response.data?.message || 'Staff assigned successfully.' }
  },

  async deleteAssignment(id) {
    const response = await api.delete(`/staff-assignments/${id}`)
    return { message: response.data?.message || 'Assignment removed.' }
  },
}

export default staffService
