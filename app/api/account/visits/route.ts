import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { isPastVisit } from "@/lib/visit-time";
import { loyaltyProgressCopy, nextVisitIsDiscount, visitsUntilDiscount } from "@/lib/loyalty";
import { successfulBookingsForPhone } from "@/lib/booking-phones";

export async function GET() {
  const session = await getSessionUser();
  if (!session.configured) {
    return NextResponse.json({ error: "Neon Auth is not configured." }, { status: 503 });
  }
  if (!session.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const profile = await prisma.customerProfile.findUnique({
    where: { neonUserId: session.user.id },
  });
  if (!profile) {
    return NextResponse.json({ error: "No studio profile for this account." }, { status: 404 });
  }

  const bookings = await successfulBookingsForPhone(profile.phone);

  const upcoming = [];
  const past = [];
  for (const booking of bookings) {
    const item = {
      id: booking.id,
      ticketId: booking.ticketId,
      name: booking.name,
      phone: booking.phone,
      email: booking.email,
      date: booking.date,
      timeSlot: booking.timeSlot,
      services: booking.services,
      discountApplied: booking.discountApplied,
      rescheduleCount: booking.rescheduleCount,
      originalDate: booking.originalDate,
    };
    if (isPastVisit(booking.date, booking.timeSlot)) past.push(item);
    else upcoming.push(item);
  }

  const count = bookings.length;
  return NextResponse.json({
    name: profile.name,
    phone: profile.phone,
    upcoming,
    past,
    loyalty: {
      successfulCount: count,
      visitsUntilDiscount: visitsUntilDiscount(count),
      nextVisitIsDiscount: nextVisitIsDiscount(count),
      copy: loyaltyProgressCopy(count),
    },
  });
}
