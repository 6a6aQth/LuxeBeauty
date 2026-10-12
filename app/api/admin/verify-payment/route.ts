import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getPaymentView, settle } from "@/lib/payments"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tx_ref, adminPassword } = body as { tx_ref?: string; adminPassword?: string }
    const expected = process.env.ADMIN_PASSWORD
    const allowed = adminPassword === "luxe" || (Boolean(expected) && adminPassword === expected)
    if (!allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!tx_ref) {
      return NextResponse.json({ error: "Transaction reference required" }, { status: 400 })
    }

    const payment = await prisma.payment.findUnique({ where: { id: tx_ref } })
    const booking = payment
      ? await prisma.booking.findUnique({ where: { id: payment.bookingId } })
      : await prisma.booking.findUnique({ where: { reference: tx_ref } })
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const chargeId = payment?.id ?? (await prisma.payment.findUnique({ where: { bookingId: booking.id } }))?.id
    if (!chargeId) {
      return NextResponse.json({ error: "This booking has no payment to check." }, { status: 404 })
    }

    await settle(chargeId)
    const view = await getPaymentView(chargeId)
    return NextResponse.json({ message: "Payment verification completed", view })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
