import { getSlotsForDate } from "@/lib/time-slots"

export type OverviewRange = "week" | "month" | "year"

export type CalendarDay = {
  year: number
  month: number
  day: number
}

export type OverviewPoint = {
  key: string
  label: string
  sublabel?: string
  count: number
  slots: number
  fullness: number
}

const BLANTYRE = "Africa/Blantyre"

export function blantyreToday(now = new Date()): CalendarDay {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BLANTYRE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return { year: read("year"), month: read("month"), day: read("day") }
}

export function dateKey(day: CalendarDay): string {
  const month = String(day.month).padStart(2, "0")
  const date = String(day.day).padStart(2, "0")
  return `${day.year}-${month}-${date}`
}

/** Noon UTC stays on the same calendar day in Africa/Blantyre. */
export function noonUtc(day: CalendarDay): Date {
  return new Date(Date.UTC(day.year, day.month - 1, day.day, 12))
}

export function addCalendarDays(day: CalendarDay, amount: number): CalendarDay {
  const next = noonUtc(day)
  next.setUTCDate(next.getUTCDate() + amount)
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  }
}

export function startOfWeekMonday(day: CalendarDay): CalendarDay {
  const weekday = noonUtc(day).getUTCDay()
  const offset = (weekday + 6) % 7
  return addCalendarDays(day, -offset)
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function monthDayLabel(day: CalendarDay): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(noonUtc(day))
}

export function periodLabel(range: OverviewRange, anchor: CalendarDay): string {
  if (range === "year") return String(anchor.year)
  if (range === "month") {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(noonUtc({ year: anchor.year, month: anchor.month, day: 1 }))
  }
  const start = startOfWeekMonday(anchor)
  const end = addCalendarDays(start, 6)
  if (start.month === end.month && start.year === end.year) {
    return `${monthDayLabel(start)} – ${end.day}`
  }
  return `${monthDayLabel(start)} – ${monthDayLabel(end)}`
}

export function shiftAnchor(range: OverviewRange, anchor: CalendarDay, direction: -1 | 1): CalendarDay {
  if (range === "week") return addCalendarDays(anchor, direction * 7)
  if (range === "year") {
    return { year: anchor.year + direction, month: anchor.month, day: 1 }
  }
  const next = new Date(Date.UTC(anchor.year, anchor.month - 1 + direction, 1, 12))
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: 1 }
}

function bookingDay(date: string): string {
  return date.slice(0, 10)
}

function slotMinutes(slot: string): number {
  const match = slot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!match) return 0
  let hours = Number(match[1])
  const minutes = Number(match[2])
  const suffix = match[3]?.toUpperCase()
  if (suffix === "PM" && hours < 12) hours += 12
  if (suffix === "AM" && hours === 12) hours = 0
  return hours * 60 + minutes
}

export type WeekVisit = {
  name: string
  date: string
  timeSlot: string
}

export function upcomingVisits(
  bookings: { name?: string | null; date: string; timeSlot?: string | null; status?: string | null }[],
  limit = 5,
  now = new Date(),
): WeekVisit[] {
  const todayKey = dateKey(blantyreToday(now))
  return bookings
    .filter((booking) => booking.status === "successful" && booking.date)
    .filter((booking) => bookingDay(booking.date) >= todayKey)
    .sort((a, b) => {
      const byDate = bookingDay(a.date).localeCompare(bookingDay(b.date))
      if (byDate !== 0) return byDate
      return slotMinutes(a.timeSlot ?? "") - slotMinutes(b.timeSlot ?? "")
    })
    .slice(0, limit)
    .map((booking) => ({
      name: booking.name?.trim() || "Guest",
      date: bookingDay(booking.date),
      timeSlot: booking.timeSlot ?? "",
    }))
}

export type StudioSnapshot = {
  todayCount: number
  todaySlots: number
  upcoming: number
  nextWhen: string | null
  weekCount: number
  weekSlots: number
}

export function studioSnapshot(
  bookings: { date: string; timeSlot?: string | null; status?: string | null }[],
  now = new Date(),
): StudioSnapshot {
  const today = blantyreToday(now)
  const todayKey = dateKey(today)
  const weekDays = Array.from({ length: 7 }, (_, index) => addCalendarDays(startOfWeekMonday(today), index))
  const weekKeys = new Set(weekDays.map(dateKey))
  const successful = bookings.filter((booking) => booking.status === "successful" && booking.date)

  const todayCount = successful.filter((booking) => bookingDay(booking.date) === todayKey).length
  const todaySlots = getSlotsForDate(noonUtc(today)).length
  const upcoming = successful
    .filter((booking) => bookingDay(booking.date) >= todayKey)
    .sort((a, b) => {
      const byDate = bookingDay(a.date).localeCompare(bookingDay(b.date))
      if (byDate !== 0) return byDate
      return slotMinutes(a.timeSlot ?? "") - slotMinutes(b.timeSlot ?? "")
    })
  const next = upcoming[0]
  const nextWhen = next
    ? `${bookingDay(next.date) === todayKey ? "Today" : monthDayLabel({
        year: Number(bookingDay(next.date).slice(0, 4)),
        month: Number(bookingDay(next.date).slice(5, 7)),
        day: Number(bookingDay(next.date).slice(8, 10)),
      })} · ${next.timeSlot ?? ""}`
    : null
  const weekCount = successful.filter((booking) => weekKeys.has(bookingDay(booking.date))).length
  const weekSlots = weekDays.reduce((sum, day) => sum + getSlotsForDate(noonUtc(day)).length, 0)

  return { todayCount, todaySlots, upcoming: upcoming.length, nextWhen, weekCount, weekSlots }
}

export function buildOverviewPoints(
  range: OverviewRange,
  anchor: CalendarDay,
  bookings: { date: string; status?: string | null }[],
): OverviewPoint[] {
  const counts = new Map<string, number>()
  for (const booking of bookings) {
    if (booking.status !== "successful") continue
    const key = bookingDay(booking.date)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  if (range === "year") {
    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1
      const totalDays = daysInMonth(anchor.year, month)
      let slots = 0
      let count = 0
      for (let day = 1; day <= totalDays; day += 1) {
        const current = { year: anchor.year, month, day }
        slots += getSlotsForDate(noonUtc(current)).length
        count += counts.get(dateKey(current)) ?? 0
      }
      return {
        key: `${anchor.year}-${String(month).padStart(2, "0")}`,
        label: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(
          noonUtc({ year: anchor.year, month, day: 1 }),
        ),
        count,
        slots,
        fullness: slots === 0 ? 0 : Math.min(1, count / slots),
      }
    })
  }

  const days =
    range === "week"
      ? Array.from({ length: 7 }, (_, index) => addCalendarDays(startOfWeekMonday(anchor), index))
      : Array.from({ length: daysInMonth(anchor.year, anchor.month) }, (_, index) => ({
          year: anchor.year,
          month: anchor.month,
          day: index + 1,
        }))

  return days.map((day) => {
    const slots = getSlotsForDate(noonUtc(day)).length
    const count = counts.get(dateKey(day)) ?? 0
    return {
      key: dateKey(day),
      label:
        range === "week"
          ? new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(noonUtc(day))
          : String(day.day),
      sublabel: range === "week" ? monthDayLabel(day) : undefined,
      count,
      slots,
      fullness: slots === 0 ? 0 : Math.min(1, count / slots),
    }
  })
}
