import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { logPaymentEvent } from "@/lib/paymentLogger"
import { confirmPaidBooking } from "@/lib/confirm-booking"
import { checkCharge } from "@/lib/charge-check"

function bookingPayload(booking: {
  id: string
  name: string
  date: string
  timeSlot: string
  services: string[]
  ticketId: string
  discountApplied: boolean
  email: string | null
  serviceTotal: number | null
}) {
  return {
    id: booking.id,
    name: booking.name,
    date: booking.date,
    timeSlot: booking.timeSlot,
    services: booking.services,
    ticketId: booking.ticketId,
    discountApplied: booking.discountApplied,
    email: booking.email,
    serviceTotal: booking.serviceTotal,
  }
}

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
      message: "Verify started",
    })

    let result
    try {
      result = await checkCharge(chargeId)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Verify failed"
      const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 0
      await logPaymentEvent({
        txRef: chargeId,
        eventType: "paychangu_verify_response",
        status: status === 404 ? "absent" : "error",
        message,
      })
      if (status === 404) {
        return NextResponse.json({ status: "absent" }, { status: 202 })
      }
      return NextResponse.json({ status: "pending", message: "Still waiting for PayChangu." }, { status: 202 })
    }

    await logPaymentEvent({
      txRef: chargeId,
      eventType: "paychangu_verify_response",
      status: result.status,
      message: `Verify returned ${result.status}`,
      payload: { amount: result.amount, currency: result.currency, bank: result.bank },
    })

    if (result.bank) {
      if (!result.paid || !result.amountOk) {
        const mismatch = result.paid && !result.amountOk
        if (mismatch) {
          await logPaymentEvent({
            txRef: chargeId,
            eventType: "paychangu_verify_response",
            status: "amount_mismatch",
            message: `Expected ${result.serviceTotal}, got ${result.amount}`,
          })
        }
        return NextResponse.json(
          {
            status: "pending",
            message: mismatch
              ? "The amount received does not match this booking. It stays unpaid."
              : "The transfer is not confirmed yet. You can verify again.",
          },
          { status: 202 },
        )
      }
    } else if (!result.paid) {
      if (result.failed) {
        await prisma.booking.updateMany({
          where: { ticketId: chargeId, status: "pending" },
          data: { status: "failed" },
        })
        return NextResponse.json({
          status: "failed",
          message: "Payment was not approved. You can try again.",
        })
      }
      return NextResponse.json({ status: "pending" }, { status: 202 })
    } else if (!result.amountOk) {
      await logPaymentEvent({
        txRef: chargeId,
        eventType: "paychangu_verify_response",
        status: "amount_mismatch",
        message: `Expected ${result.serviceTotal}, got ${result.amount}`,
      })
      return NextResponse.json({
        status: "review",
        message: "PayChangu reported a different amount. Stay on this page and do not start another payment.",
      })
    }

    const confirmed = await confirmPaidBooking(chargeId)
    if (!confirmed.ok) {
      return NextResponse.json({ status: "failed", message: "Booking not found." }, { status: 404 })
    }

    return NextResponse.json({
      status: "success",
      booking: bookingPayload(confirmed.booking),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message, chargeId }, { status: 500 })
  }
}
