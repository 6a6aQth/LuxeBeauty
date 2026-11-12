/**
 * The 8AM early-access overflow slot (Mon–Fri only, not Saturday).
 * This slot is NOT included in getSlotsForDate() output by default.
 * It is surfaced only when isOverflowSlotAvailable() returns true —
 * i.e. every regular slot on that date has at least one successful booking.
 */
export const OVERFLOW_SLOT = "08:00";

export const timeSlots = {
  monday_thursday: [
    "10:00",
    "11:30",
    "13:30",
    "15:00",
  ],
  friday: [
    "10:00",
    "11:30",
    "13:30",
  ],
  saturday: [
    "10:00",
    "11:30",
    "13:30",
    "15:00",
  ],
};

export function generateTimeSlots(includeWeekends: boolean): string[] {
  const allSlots = new Set([
    ...timeSlots.monday_thursday,
    ...timeSlots.friday,
  ]);

  if (includeWeekends) {
    timeSlots.saturday.forEach(slot => allSlots.add(slot));
  }

  return Array.from(allSlots).sort();
}

export function getSlotsForDate(date: Date): string[] {
  // Use Intl.DateTimeFormat to get the day of week specifically in Malawi's timezone (UTC+2)
  // this ensures that '2026-02-13' (Friday) is always evaluated as Friday, even if the server
  // is running in a different timezone (e.g. UTC-5).
  // weekday: 'long' returns 'Monday', 'Tuesday', etc.
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'Africa/Blantyre',
  });
  const dayName = formatter.format(date);

  if (['Monday', 'Tuesday', 'Wednesday', 'Thursday'].includes(dayName)) {
    return timeSlots.monday_thursday;
  }
  if (dayName === 'Friday') {
    return timeSlots.friday;
  }
  if (dayName === 'Saturday') {
    return timeSlots.saturday;
  }
  return []; // Sunday or invalid
}

export function formatTime(time: string): string {
  const [hour, minute] = time.split(':');
  const h = parseInt(hour, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12; // convert 0 to 12
  return `${h12}:${minute} ${suffix}`;
}

export function serviceLabel(value: string, allServices: { id: string; name: string }[]): string {
  const service = allServices.find(s => s.id === value);
  return service ? service.name : value;
} 