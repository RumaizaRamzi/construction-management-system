/**
 * Build calendar events from live bookings, rentals, checks, maintenance, reminders.
 */
import { buildCalendarEvents } from '../utils/bookingHelpers'

export const calendarService = {
  buildEvents({
    bookings = [],
    rentals = [],
    sales = [],
    checks = [],
    maintenance = [],
    reminders = [],
    staticEvents = [],
  } = {}) {
    return buildCalendarEvents({
      bookings,
      rentals,
      sales,
      checks,
      maintenance,
      reminders,
      staticEvents,
    })
  },
}

export default calendarService
