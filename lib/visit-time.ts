/** Africa/Blantyre is UTC+2 year-round. Booking dates and slots are studio local time. */
export function blantyreAppointmentTime(date: string, timeSlot: string): Date {
  return new Date(`${date}T${timeSlot}:00+02:00`)
}

export function isPastVisit(date: string, timeSlot: string, now = new Date()): boolean {
  const when = blantyreAppointmentTime(date, timeSlot)
  if (Number.isNaN(when.getTime())) return false
  return when.getTime() <= now.getTime()
}
