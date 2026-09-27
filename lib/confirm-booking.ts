import prisma from "@/lib/prisma"
import { logPaymentEvent } from "@/lib/paymentLogger"
import { successfulBookingsForPhone } from "@/lib/booking-phones"
import { sendBookingSMS } from "@/lib/sms"
import { sendTicketEmail } from "@/lib/ticket-email"
import { formatTime } from "@/lib/time-slots"

export async function confirmPaidBooking(chargeId: string) {
  const booking = await prisma.booking.findUnique({ where: { ticketId: chargeId } })
  if (!booking) {
    return { ok: false as const, reason: "missing" as const }
  }
  if (booking.status === "successful") {
    return { ok: true as const, booking, alreadyConfirmed: true }
  }

  const existingCount = (await successfulBookingsForPhone(booking.phone, chargeId)).length
  const discountApplied = (existingCount + 1) % 6 === 0

  const updated = await prisma.booking.updateMany({
    where: { ticketId: chargeId, status: { not: "successful" } },
    data: { status: "successful", discountApplied },
  })

  const fresh = await prisma.booking.findUnique({ where: { ticketId: chargeId } })
  if (!fresh) {
    return { ok: false as const, reason: "missing" as const }
  }
  if (updated.count === 0) {
    return { ok: true as const, booking: fresh, alreadyConfirmed: true }
  }

  await logPaymentEvent({
    txRef: chargeId,
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
      `Lauryn Luxe: booking ${fresh.ticketId} is confirmed for ${when}. Services: ${serviceNames.join(", ")}.`,
    )
    await logPaymentEvent({
      txRef: chargeId,
      bookingId: fresh.id,
      eventType: "sms_sent",
      status: "sent",
      message: "Confirmation SMS sent",
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "SMS failed"
    await logPaymentEvent({
      txRef: chargeId,
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
        ticketId: fresh.ticketId,
        discountApplied: fresh.discountApplied,
        serviceNames,
      })
      await logPaymentEvent({
        txRef: chargeId,
        bookingId: fresh.id,
        eventType: "ticket_email_sent",
        status: "sent",
        message: "Ticket email sent",
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Ticket email failed"
      await logPaymentEvent({
        txRef: chargeId,
        bookingId: fresh.id,
        eventType: "ticket_email_sent",
        status: "error",
        message,
      })
    }
  }

  return { ok: true as const, booking: fresh, alreadyConfirmed: false }
}
