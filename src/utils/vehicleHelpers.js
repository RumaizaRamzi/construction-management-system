import { useEffect, useState } from 'react'
import vehicleService from '../services/vehicleService'

export const VEHICLE_STATUSES = ['Available', 'Rented', 'Under Maintenance', 'Out of Service']
export const VEHICLE_CATEGORIES = [
  'Excavator',
  'Bulldozer',
  'Crane',
  'Dump Truck',
  'Backhoe Loader',
  'Wheel Loader',
  'Forklift',
  'Other Construction Vehicle',
]
export const RATE_TYPES = ['Daily', 'Weekly', 'Monthly']
export const RENTAL_STATUSES = ['Active', 'Completed', 'Cancelled']
export const MAINTENANCE_STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Cancelled']
export const MAINTENANCE_TYPES = [
  'Routine Service',
  'Repair',
  'Inspection',
  'Oil Change',
  'Tyre / Track Replacement',
  'Engine Work',
  'Hydraulics',
  'Electrical',
  'Other',
]

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const rateFor = (vehicle, rateType) => {
  if (!vehicle) return null
  if (rateType === 'Weekly') return vehicle.weeklyRate
  if (rateType === 'Monthly') return vehicle.monthlyRate
  return vehicle.dailyRate
}

const dayDiff = (start, end) => {
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T00:00:00`)
  return Math.round((e - s) / 86400000)
}

/** Mirrors VehicleRentalService::calculate on the API so the form previews the saved totals. */
export const calculateVehicleRental = ({ startDate, expectedReturnDate, actualReturnDate, rateType, rentalRate }) => {
  const end = actualReturnDate || expectedReturnDate
  const days = startDate && end ? Math.max(dayDiff(startDate, end), 1) : 1
  let units = days
  if (rateType === 'Weekly') units = Math.ceil(days / 7)
  if (rateType === 'Monthly') units = Math.ceil(days / 30)
  units = Math.max(units, 1)
  const rate = Number(rentalRate) || 0
  return { days, units, total: Math.round(units * rate * 100) / 100 }
}

export const paymentStatusFor = (total, paid) => {
  if (total > 0 && paid >= total) return 'Paid'
  if (paid > 0) return 'Partial'
  return 'Pending'
}

export const unitLabel = (rateType, units) => {
  const base = rateType === 'Weekly' ? 'week' : rateType === 'Monthly' ? 'month' : 'day'
  return `${units} ${base}${units === 1 ? '' : 's'}`
}

/** Loads an authenticated vehicle photo as an object URL. */
export function useVehiclePhoto(vehicleId, hasPhoto, version = 0) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!vehicleId || !hasPhoto) {
      setUrl(null)
      return undefined
    }
    let cancelled = false
    let objectUrl = null
    vehicleService
      .getPhotoBlob(vehicleId)
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
  }, [vehicleId, hasPhoto, version])

  return url
}

/**
 * Save vehicle details, then the photo. A failed photo upload keeps the saved vehicle and
 * reports the photo problem separately.
 */
export async function saveVehicle(existing, form, { photoFile, removePhoto } = {}) {
  const result = existing
    ? await vehicleService.updateVehicle(existing.id, form)
    : await vehicleService.createVehicle(form)
  let vehicle = result.vehicle
  let photoError = null
  try {
    if (photoFile) vehicle = (await vehicleService.uploadPhoto(vehicle.id, photoFile)).vehicle
    else if (removePhoto && existing?.hasPhoto) vehicle = (await vehicleService.deletePhoto(vehicle.id)).vehicle
  } catch (error) {
    photoError = error
  }
  return { vehicle, message: result.message, photoError }
}

export const openBlob = async (loader, filename) => {
  const blob = await loader()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener'
  if (filename && !/^image\/|pdf/.test(blob.type || '')) link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}
