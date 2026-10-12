import prisma from "@/lib/prisma"
import { logPaymentEvent } from "@/lib/paymentLogger"
import { sendBookingSMS } from "@/lib/sms"
import { sendStudioBookingEmail, sendTicketEmail } from "@/lib/ticket-email"
import { FIXED_AMOUNT_MWK } from "@/lib/money"
import { formatTime } from "@/lib/time-slots"

export async function confirmPaidBooking(bookingId: string) {
  const fresh = await prisma.booking.findUnique({ where: { id: bookingId } })
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
  const when = `${fresh.date} at ${formatTime(fresh.timeSlot)}`

  try {
    await sendBookingSMS(
      fresh.phone,
      `Lauryn Luxe: booking ${fresh.reference} is confirmed for ${when}. Services: ${serviceNames.join(", ")}.`,
    )
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
        amount: FIXED_AMOUNT_MWK,
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
      amount: FIXED_AMOUNT_MWK,
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
