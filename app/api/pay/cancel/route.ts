import { after, NextResponse } from "next/server"
import { cancelPayment, getPaymentView, reconcile } from "@/lib/payments"

export async function POST(req: Request) {
  const { chargeId } = await req.json()
  if (!chargeId || typeof chargeId !== "string") {
    return NextResponse.json({ result: "not_open" }, { status: 400 })
  }
  const result = await cancelPayment(chargeId)
  const view = result === "already_paid" ? await getPaymentView(chargeId) : null
  after(() => {
    reconcile(3).catch((error) => console.error("[payments] sweep", error))
  })
  return NextResponse.json({ result, view })
}
