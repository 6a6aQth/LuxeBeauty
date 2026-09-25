import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { logPaymentEvent } from "@/lib/paymentLogger"
import { verifyDirectCharge } from "@/lib/paychangu-direct"
import { classifyChargeStatus } from "@/lib/mobile-money"
import { DEPOSIT_AMOUNT_MWK } from "@/lib/deposit"
import { confirmPaidBooking } from "@/lib/confirm-booking"

export async function POST(req: NextRequest) {
  let chargeId = "unknown"
  try {
    const body = await req.json()
    chargeId = String(body.chargeId || body.tx_ref || "")
    if (!chargeId) {
      return NextResponse.json({ error: "Missing charge id" }, { status: 400 })
    }

    await logPaymentEvent({
      txRef: chargeId,
      eventType: "verification_started",
      message: "Verify poll started",
    })

    let result
    try {
      result = await verifyDirectCharge(chargeId)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Verify failed"
      await logPaymentEvent({
        txRef: chargeId,
        eventType: "paychangu_verify_response",
        status: "error",
        message,
      })
      return NextResponse.json({ status: "pending", message: "Still waiting for PayChangu." }, { status: 202 })
    }

    await logPaymentEvent({
      txRef: chargeId,
      eventType: "paychangu_verify_response",
      status: result.status,
      message: `Verify returned ${result.status}`,
      payload: { amount: result.amount, currency: result.currency, mode: result.mode },
    })

    const outcome = classifyChargeStatus(result.status)
    if (outcome === "pending") {
      return NextResponse.json({ status: "pending" }, { status: 202 })
    }

    if (outcome === "failed") {
      await prisma.booking.updateMany({
        where: { ticketId: chargeId, status: "pending" },
        data: { status: "failed" },
      })
      return NextResponse.json({
        status: "failed",
        message: "Payment was not approved. You can try again.",
      })
    }

    if (result.amount !== DEPOSIT_AMOUNT_MWK) {
      await logPaymentEvent({
        txRef: chargeId,
        eventType: "paychangu_verify_response",
        status: "amount_mismatch",
        message: `Expected ${DEPOSIT_AMOUNT_MWK}, got ${result.amount}`,
      })
      return NextResponse.json(
        { status: "failed", message: "The payment amount did not match this booking." },
        { status: 400 },
      )
    }

    const confirmed = await confirmPaidBooking(chargeId)
    if (!confirmed.ok) {
      return NextResponse.json({ status: "failed", message: "Booking not found." }, { status: 404 })
    }

    const booking = confirmed.booking
    return NextResponse.json({
      status: "success",
      booking: {
        id: booking.id,
        name: booking.name,
        date: booking.date,
        timeSlot: booking.timeSlot,
        services: booking.services,
        ticketId: booking.ticketId,
        discountApplied: booking.discountApplied,
        email: booking.email,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message, chargeId }, { status: 500 })
  }
}
