import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getChargeStatus, type Method } from "@/lib/paychangu-direct"
import { logPaymentEvent } from "@/lib/paymentLogger"
import { sendVoucherEmail } from "@/lib/voucher-email"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { chargeId } = body

    if (!chargeId) {
      return NextResponse.json({ error: "Missing chargeId" }, { status: 400 })
    }

    const voucher = await prisma.giftVoucher.findUnique({
      where: { chargeId },
      include: { redemptions: true },
    })

    if (!voucher) {
      return NextResponse.json({ error: "Voucher not found for charge" }, { status: 404 })
    }

    // If already active or depleted, return current voucher state
    if (voucher.status === "active" || voucher.status === "depleted") {
      return NextResponse.json({
        ok: true,
        status: voucher.status,
        voucher,
      })
    }

    // Call PayChangu to verify transaction
    const statusRes = await getChargeStatus(voucher.method as Method, chargeId)

    if (!statusRes.ok) {
      return NextResponse.json({
        ok: false,
        status: "pending",
        message: statusRes.message,
      })
    }

    if (statusRes.state === "failed") {
      await prisma.giftVoucher.update({
        where: { id: voucher.id },
        data: { status: "failed" },
      })
      return NextResponse.json({ ok: false, status: "failed", message: "Payment failed or was declined." })
    }

    if (statusRes.state !== "success") {
      return NextResponse.json({ ok: false, status: "pending", message: "Awaiting payment confirmation." })
    }

    // Amount check (guard against underpayment)
    if (statusRes.amount !== null && statusRes.amount < voucher.purchaseAmount) {
      return NextResponse.json({
        ok: false,
        status: "pending",
        message: "Paid amount does not match voucher purchase amount.",
      })
    }

    // FM-12 Guard: Transactional update so confirmation is atomic
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
      message: `Voucher ${voucher.voucherId} confirmed and activated`,
    })

    // Send recipient email asynchronously
    sendVoucherEmail({
      voucherId: voucher.voucherId,
      originalAmount: voucher.purchaseAmount,
      recipientName: voucher.recipientName,
      recipientEmail: voucher.recipientEmail,
      purchaserName: voucher.purchaserName,
      message: voucher.message,
    }).catch((e) => console.error("[api/gift-vouchers/confirm] email failed:", e))

    return NextResponse.json({
      ok: true,
      status: "active",
      voucher: updatedVoucher,
    })
  } catch (error: any) {
    console.error("[api/gift-vouchers/confirm] error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

