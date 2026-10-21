import prisma from "@/lib/prisma"
import { logPaymentEvent } from "@/lib/paymentLogger"
import { sendBookingSMS } from "@/lib/sms"
import { sendStudioBookingEmail, sendTicketEmail } from "@/lib/ticket-email"
import { amountForMethod, formatMwk } from "@/lib/money"
import { formatTime } from "@/lib/time-slots"

export async function confirmPaidBooking(bookingId: string) {
  const fresh = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payment: { select: { method: true } } },
  })
  if (!fresh) {
    return { ok: false as const, reason: "missing" as const }
  }
  if (fresh.status !== "successful") {
    return { ok: false as const, reason: "unpaid" as const }
  }

  await logPaymentEvent({
    txRef: fresh.reference,
    bookingId: fresh.id,
    eventType: "booking_updated",
    status: "successful",
    message: "Marked booking successful",
  })

  const services = await prisma.service.findMany({
    where: { id: { in: fresh.services } },
    select: { id: true, name: true },
  })
  const serviceNames = fresh.services.map((id) => services.find((service) => service.id === id)?.name ?? id)
  const amount = amountForMethod(fresh.payment?.method)
  const visitDate = formatVisitDate(fresh.date)
  const visitTime = formatTime(fresh.timeSlot)
  const serviceList = serviceNames.filter(Boolean).join(", ")
  const sms = [
    "Lauryn Luxe booking confirmed.",
    `Ticket: ${fresh.reference}`,
    `Date: ${visitDate}`,
    `Time: ${visitTime}`,
    `Services: ${serviceList || "See your ticket"}`,
    `Booking fee: ${formatMwk(amount)}`,
    fresh.discountApplied ? "30% loyalty discount noted." : "",
    "Show this ticket at the studio.",
  ]
    .filter(Boolean)
    .join("\n")

  try {
    await sendBookingSMS(fresh.phone, sms)
    await logPaymentEvent({
      txRef: fresh.reference,
      bookingId: fresh.id,
      eventType: "sms_sent",
      status: "sent",
      message: "Confirmation SMS sent",
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "SMS failed"
    await logPaymentEvent({
      txRef: fresh.reference,
      bookingId: fresh.id,
      eventType: "sms_sent",
      status: "error",
      message,
    })
  }

  if (fresh.email) {
    try {
      await sendTicketEmail({
        email: fresh.email,
        name: fresh.name,
        date: fresh.date,
        timeSlot: fresh.timeSlot,
        ticketId: fresh.reference,
        discountApplied: fresh.discountApplied,
        serviceNames,
        amount,
      })
      await logPaymentEvent({
        txRef: fresh.reference,
        bookingId: fresh.id,
        eventType: "ticket_email_sent",
        status: "sent",
        message: "Ticket email sent",
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Ticket email failed"
      await logPaymentEvent({
        txRef: fresh.reference,
        bookingId: fresh.id,
        eventType: "ticket_email_sent",
        status: "error",
        message,
      })
    }
  }

  try {
    await sendStudioBookingEmail({
      name: fresh.name,
      phone: fresh.phone,
      email: fresh.email,
      date: fresh.date,
      timeSlot: fresh.timeSlot,
      ticketId: fresh.reference,
      discountApplied: fresh.discountApplied,
      serviceNames,
      amount,
    })
    await logPaymentEvent({
      txRef: fresh.reference,
      bookingId: fresh.id,
      eventType: "studio_email_sent",
      status: "sent",
      message: "Studio copy sent",
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Studio email failed"
    await logPaymentEvent({
      txRef: fresh.reference,
      bookingId: fresh.id,
      eventType: "studio_email_sent",
      status: "error",
      message,
    })
  }

  return { ok: true as const, booking: fresh, alreadyConfirmed: false }
}

function formatVisitDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  if (!year || !month || !day) return isoDate
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Blantyre",
  }).format(date)
}
