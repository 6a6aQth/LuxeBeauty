import { NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import prisma from "@/lib/prisma"
import { logPaymentEvent } from "@/lib/paymentLogger"
import { verifyDirectCharge } from "@/lib/paychangu-direct"
import { classifyChargeStatus } from "@/lib/mobile-money"
import { DEPOSIT_AMOUNT_MWK, chargedAmountMatches } from "@/lib/deposit"
import { confirmPaidBooking } from "@/lib/confirm-booking"

function signaturesMatch(payload: string, signature: string | null, secret: string) {
  if (!signature) return false
  const received = signature.trim().replace(/^sha256=/i, "").toLowerCase()
  const expected = createHmac("sha256", secret).update(payload, "utf8").digest("hex")
  if (received.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(received, "utf8"), Buffer.from(expected, "utf8"))
}

function chargeIdFromBody(body: Record<string, unknown>): string | null {
  const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {}
  const candidates = [body.charge_id, body.tx_ref, body.reference, data.charge_id, data.tx_ref, data.reference]
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim()
  }
  return null
}

export async function POST(req: NextRequest) {
  const secret = process.env.PAYCHANGU_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret is not configured." }, { status: 401 })
  }

  const payload = await req.text()
  const signature = req.headers.get("signature")
  let body: Record<string, unknown> = {}
  try {
    body = payload ? JSON.parse(payload) : {}
  } catch {
    body = {}
  }
  const chargeId = chargeIdFromBody(body) || "unknown"

  if (!signaturesMatch(payload, signature, secret)) {
    await logPaymentEvent({
      txRef: chargeId,
      eventType: "webhook_received",
      status: "unauthorized",
      message: signature ? "Invalid signature" : "No signature header",
    })
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  await logPaymentEvent({
    txRef: chargeId,
    eventType: "webhook_received",
    status: "accepted",
    message: "Webhook received",
  })
  await logPaymentEvent({
    txRef: chargeId,
    eventType: "signature_verified",
    status: "ok",
    message: "Signature matched",
  })

  if (chargeId === "unknown") {
    return NextResponse.json({ received: true })
  }

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
    return NextResponse.json({ error: "Verification failed" }, { status: 500 })
  }

  await logPaymentEvent({
    txRef: chargeId,
    eventType: "paychangu_verify_response",
    status: result.status,
    message: `Webhook verify returned ${result.status}`,
    payload: { amount: result.amount, currency: result.currency },
  })

  const outcome = classifyChargeStatus(result.status)
  if (outcome === "pending") {
    return NextResponse.json({ received: true, status: "pending" })
  }
  if (outcome === "failed") {
    await prisma.booking.updateMany({
      where: { ticketId: chargeId, status: "pending" },
      data: { status: "failed" },
    })
    return NextResponse.json({ received: true, status: "failed" })
  }
  if (!chargedAmountMatches(result.amount)) {
    await logPaymentEvent({
      txRef: chargeId,
      eventType: "paychangu_verify_response",
      status: "amount_mismatch",
      message: `Expected ${DEPOSIT_AMOUNT_MWK}, got ${result.amount}`,
    })
    return NextResponse.json({ received: true, status: "amount_mismatch" })
  }

  const confirmed = await confirmPaidBooking(chargeId)
  if (!confirmed.ok) {
    return NextResponse.json({ received: true, bookingNotFound: true })
  }

  await logPaymentEvent({
    txRef: chargeId,
    bookingId: confirmed.booking.id,
    eventType: "booking_confirmed",
    status: confirmed.alreadyConfirmed ? "already" : "successful",
    message: confirmed.alreadyConfirmed ? "Booking was already successful" : "Booking confirmed from webhook",
  })

  return NextResponse.json({ received: true, status: "success" })
}
