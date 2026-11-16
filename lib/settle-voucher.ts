import prisma from "@/lib/prisma"
import { getChargeStatus, type Method } from "@/lib/paychangu-direct"
import { logPaymentEvent } from "@/lib/paymentLogger"
import { sendVoucherEmail } from "@/lib/voucher-email"

export async function settleGiftVoucher(chargeId: string): Promise<boolean> {
  const voucher = await prisma.giftVoucher.findUnique({
    where: { chargeId },
  })

  if (!voucher) return false
  if (voucher.status === "active" || voucher.status === "depleted") return true

  const statusRes = await getChargeStatus(voucher.method as Method, chargeId)
  if (!statusRes.ok) {
    console.error(`[settleGiftVoucher] failed to get status for ${chargeId}:`, statusRes.message)
    return false
  }

  if (statusRes.state === "failed") {
    await prisma.giftVoucher.update({
      where: { id: voucher.id },
      data: { status: "failed" },
    })
    return false
  }

  if (statusRes.state !== "success") {
    return false
  }

  if (statusRes.amount !== null && statusRes.amount < voucher.purchaseAmount) {
    console.error(`[settleGiftVoucher] underpaid for ${chargeId}: got ${statusRes.amount}, expected ${voucher.purchaseAmount}`)
    return false
  }

  const updatedVoucher = await prisma.$transaction(async (tx) => {
    const v = await tx.giftVoucher.findUnique({ where: { id: voucher.id } })
    if (!v || v.status === "active" || v.status === "depleted") return v

    return await tx.giftVoucher.update({
      where: { id: voucher.id },
      data: {
        status: "active",
        paymentRef: statusRes.receipt || chargeId,
      },
    })
  })

  await logPaymentEvent({
    txRef: voucher.voucherId,
    bookingId: null,
    eventType: "voucher_payment_confirmed",
    status: "successful",
    message: `Voucher ${voucher.voucherId} confirmed via webhook/settle`,
  })

  try {
    await sendVoucherEmail({
      voucherId: voucher.voucherId,
      originalAmount: voucher.purchaseAmount,
      recipientName: voucher.recipientName,
      recipientEmail: voucher.recipientEmail,
      purchaserName: voucher.purchaserName,
      message: voucher.message,
    })
  } catch (e) {
    console.error(`[settleGiftVoucher] email delivery failed for ${voucher.voucherId}:`, e)
  }

  return true
}

