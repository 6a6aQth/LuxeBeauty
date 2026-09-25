import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/auth/session"
import { successfulBookingsForPhone } from "@/lib/booking-phones"
import { isPastVisit } from "@/lib/visit-time"
import { loyaltyProgressCopy, nextVisitIsDiscount, visitsUntilDiscount } from "@/lib/loyalty"

const PAST_PAGE_SIZE = 6

function looksLikeId(value: string) {
  return /^c[a-z0-9]{20,}$/i.test(value)
}

export async function GET(req: NextRequest) {
  const session = await getSessionUser()
  if (!session.configured) {
    return NextResponse.json({ error: "Neon Auth is not configured." }, { status: 503 })
  }
  if (!session.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 })
  }

  const profile = await prisma.customerProfile.findUnique({
    where: { neonUserId: session.user.id },
  })
  if (!profile) {
    return NextResponse.json({ error: "No studio profile for this account." }, { status: 404 })
  }

  const catalog = await prisma.service.findMany({ select: { id: true, name: true } })
  const nameById = new Map(catalog.map((service) => [service.id, service.name]))

  function serviceNames(values: string[]) {
    const names = values
      .map((value) => nameById.get(value) || (looksLikeId(value) ? null : value))
      .filter((name): name is string => Boolean(name))
    return names.length > 0 ? names : ["Service from this visit"]
  }

  const bookings = await successfulBookingsForPhone(profile.phone)
  const upcoming = []
  const past = []
  for (const booking of bookings) {
    const item = {
      id: booking.id,
      ticketId: booking.ticketId,
      name: booking.name,
      date: booking.date,
      timeSlot: booking.timeSlot,
      services: booking.services,
      serviceNames: serviceNames(booking.services),
      discountApplied: booking.discountApplied,
      rescheduleCount: booking.rescheduleCount,
      originalDate: booking.originalDate,
    }
    if (isPastVisit(booking.date, booking.timeSlot)) past.push(item)
    else upcoming.push(item)
  }

  past.reverse()
  const page = Math.max(1, Number(new URL(req.url).searchParams.get("pastPage") || "1") || 1)
  const visiblePast = past.slice(0, page * PAST_PAGE_SIZE)
  const count = bookings.length

  return NextResponse.json({
    name: profile.name,
    phone: profile.phone,
    upcoming,
    past: visiblePast,
    pastTotal: past.length,
    pastHasMore: visiblePast.length < past.length,
    loyalty: {
      successfulCount: count,
      visitsUntilDiscount: visitsUntilDiscount(count),
      nextVisitIsDiscount: nextVisitIsDiscount(count),
      copy: loyaltyProgressCopy(count),
    },
  })
}
