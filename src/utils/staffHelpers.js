import { useEffect, useState } from 'react'
import staffService from '../services/staffService'

export const STAFF_STATUSES = ['Active', 'Inactive']

export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'leave', 'half_day']

export const ATTENDANCE_LABELS = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  leave: 'Leave',
  half_day: 'Half Day',
}

/** Short codes for the monthly grid. */
export const ATTENDANCE_SHORT = {
  present: 'P',
  absent: 'A',
  late: 'L',
  leave: 'Lv',
  half_day: 'H',
}

export const ATTENDANCE_TONES = {
  present: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  absent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  late: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  leave: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  half_day: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
}

/** Absent and leave days have no check-in/out times. */
export const isWorkingStatus = (status) => status !== 'absent' && status !== 'leave'

export const NIC_PATTERN = /^(\d{9}[VvXx]|\d{12})$/
export const PHONE_PATTERN = /^\+?[0-9\s\-()]{9,20}$/
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024

export const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?'

export function mapStaffFromApi(record) {
  if (!record) return null
  return {
    id: record.id,
    staffCode: record.staff_code || '',
    fullName: record.full_name || '',
    nic: record.nic || '',
    phone: record.phone || '',
    email: record.email || '',
    address: record.address || '',
    hasPhoto: Boolean(record.has_photo),
    roleId: record.role_id ?? null,
    roleName: record.role_name || '',
    branchId: record.branch_id ?? null,
    branchName: record.branch_name || '',
    joinedDate: record.joined_date || '',
    status: record.status || 'Active',
    userId: record.user_id ?? null,
    userName: record.user_name || '',
    notes: record.notes || '',
    createdAt: record.created_at || null,
    updatedAt: record.updated_at || null,
  }
}

export function mapStaffToApi(staff) {
  const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  return {
    staff_code: text(staff.staffCode)?.toUpperCase() ?? null,
    full_name: text(staff.fullName),
    nic: text(staff.nic)?.toUpperCase() ?? null,
    phone: text(staff.phone),
    email: text(staff.email),
    address: text(staff.address),
    role_id: staff.roleId ? Number(staff.roleId) : null,
    branch_id: staff.branchId ? Number(staff.branchId) : null,
    joined_date: staff.joinedDate || null,
    status: staff.status || 'Active',
    user_id: staff.userId ? Number(staff.userId) : null,
    notes: text(staff.notes),
  }
}

export function mapStaffRoleFromApi(record) {
  if (!record) return null
  return {
    id: record.id,
    name: record.name || '',
    description: record.description || '',
    staffCount: Number(record.staff_count || 0),
  }
}

export function mapAttendanceFromApi(record) {
  if (!record) return null
  return {
    id: record.id,
    staffId: record.staff_id,
    date: record.date || '',
    checkIn: record.check_in || '',
    checkOut: record.check_out || '',
    status: record.status || 'present',
    notes: record.notes || '',
  }
}

export function mapAssignmentFromApi(record) {
  if (!record) return null
  return {
    id: record.id,
    staffId: record.staff_id,
    staffName: record.staff_name || '',
    vehicleId: record.vehicle_id ?? null,
    vehicleName: record.vehicle_name || '',
    vehicleRegistration: record.vehicle_registration || '',
    rentalId: record.rental_id ?? null,
    rentalNumber: record.rental_number || '',
    rentalCustomer: record.rental_customer || '',
    assignedFrom: record.assigned_from || '',
    assignedTo: record.assigned_to || '',
    isCurrent: Boolean(record.is_current),
    notes: record.notes || '',
  }
}

/** Client-side checks that mirror StoreStaffRequest; the server stays the source of truth. */
export function validateStaffForm(form) {
  const errors = {}
  if (!form.fullName.trim()) errors.fullName = 'Full name is required.'
  if (!form.nic.trim()) errors.nic = 'NIC number is required.'
  else if (!NIC_PATTERN.test(form.nic.trim())) errors.nic = 'Enter a valid NIC number (9 digits followed by V or X, or 12 digits).'
  if (!form.phone.trim()) errors.phone = 'Phone number is required.'
  else if (!PHONE_PATTERN.test(form.phone.trim()) || form.phone.replace(/\D/g, '').length < 9) {
    errors.phone = 'Enter a valid phone number, e.g. 077 123 4567 or +94 77 123 4567.'
  }
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.'
  if (!form.address.trim()) errors.address = 'Address is required.'
  if (!form.roleId) errors.roleId = 'Please select a role.'
  if (!form.joinedDate) errors.joinedDate = 'Joined date is required.'
  return errors
}

/** Maps Laravel field names to the form's field names. */
export function mapStaffApiErrors(fieldErrors = {}) {
  const keys = {
    staff_code: 'staffCode',
    full_name: 'fullName',
    nic: 'nic',
    phone: 'phone',
    email: 'email',
    address: 'address',
    role_id: 'roleId',
    branch_id: 'branchId',
    joined_date: 'joinedDate',
    status: 'status',
    user_id: 'userId',
    notes: 'notes',
    photo: 'photo',
  }
  return Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [keys[k] || k, v]))
}

/** Loads an authenticated staff photo as an object URL. */
export function useStaffPhoto(staffId, hasPhoto, version = 0) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!staffId || !hasPhoto) {
      setUrl(null)
      return undefined
    }
    let cancelled = false
    let objectUrl = null
    staffService
      .getPhotoBlob(staffId)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [staffId, hasPhoto, version])

  return url
}
