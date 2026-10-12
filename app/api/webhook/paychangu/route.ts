import { NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import { settle } from "@/lib/payments"

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

  if (!signaturesMatch(payload, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const chargeId = chargeIdFromBody(body)
  if (chargeId) {
    try {
      await settle(chargeId)
    } catch (error: unknown) {
      console.error("[payments] webhook settle", error)
    }
  }

  return NextResponse.json({ received: true })
}
