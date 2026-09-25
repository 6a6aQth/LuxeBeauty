import prisma from "@/lib/prisma"
import { canonicalPhone } from "@/lib/phone"

/** Successful bookings whose stored phone is the same E.164 value, including rows not rewritten yet. */
export async function successfulBookingsForPhone(phone: string, excludeTicketId?: string) {
  const target = canonicalPhone(phone)
  if (!target) return []

  const rows = await prisma.booking.findMany({
    where: {
      status: "successful",
      ...(excludeTicketId ? { NOT: { ticketId: excludeTicketId } } : {}),
    },
    orderBy: { date: "asc" },
  })

  return rows.filter((row) => canonicalPhone(row.phone) === target)
}
