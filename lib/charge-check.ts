import prisma from "@/lib/prisma"
import { chargedAmountMatches } from "@/lib/money"
import { classifyChargeStatus } from "@/lib/mobile-money"
import { bankTransferDetails, verifyDirectCharge } from "@/lib/paychangu-direct"

export type ChargeCheck = {
  bank: boolean
  status: string
  amount: number
  currency: string
  paid: boolean
  failed: boolean
  amountOk: boolean
  serviceTotal: number | null
}

export async function checkCharge(chargeId: string): Promise<ChargeCheck> {
  const booking = await prisma.booking.findUnique({
    where: { ticketId: chargeId },
    select: { paymentMethod: true, serviceTotal: true },
  })
  const expected = booking?.serviceTotal ?? null

  if (booking?.paymentMethod === "bank") {
    const result = await bankTransferDetails(chargeId)
    const paid = result.status.trim().toLowerCase() === "success"
    return {
      bank: true,
      status: result.status,
      amount: result.amount,
      currency: result.currency,
      paid,
      failed: false,
      amountOk: chargedAmountMatches(result.amount, expected),
      serviceTotal: expected,
    }
  }

  const result = await verifyDirectCharge(chargeId)
  const outcome = classifyChargeStatus(result.status)
  return {
    bank: false,
    status: result.status,
    amount: result.amount,
    currency: result.currency,
    paid: outcome === "success",
    failed: outcome === "failed",
    amountOk: chargedAmountMatches(result.amount, expected),
    serviceTotal: expected,
  }
}
