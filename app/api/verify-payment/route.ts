import { after, NextResponse } from "next/server"
import { getPaymentView, reconcile } from "@/lib/payments"

function sweepSoon() {
  after(() => {
    reconcile(3).catch((error) => console.error("[payments] sweep", error))
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const chargeId = String(body.chargeId || "")
    if (!chargeId) {
      return NextResponse.json({ error: "Missing charge id" }, { status: 400 })
    }

    const view = await getPaymentView(chargeId)
    sweepSoon()
    if (!view) {
      return NextResponse.json({ status: "absent" }, { status: 404 })
    }

    const waiting = view.status === "pending"
    return NextResponse.json(view, { status: waiting ? 202 : 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
