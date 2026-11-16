import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendVoucherEmail } from "@/lib/voucher-email"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) {
  try {
    const { voucherId } = await params
    if (!voucherId) {
      return NextResponse.json({ error: "Missing voucherId" }, { status: 400 })
    }

    const voucher = await prisma.giftVoucher.findUnique({
      where: { voucherId: voucherId.trim().toUpperCase() },
    })

    if (!voucher) {
      return NextResponse.json({ error: "Voucher not found" }, { status: 404 })
    }

    if (voucher.status !== "active" && voucher.status !== "depleted") {
      return NextResponse.json({ error: "Cannot send email for an unconfirmed voucher." }, { status: 400 })
    }

    await sendVoucherEmail({
      voucherId: voucher.voucherId,
      originalAmount: voucher.purchaseAmount,
      recipientName: voucher.recipientName,
      recipientEmail: voucher.recipientEmail,
      purchaserName: voucher.purchaserName,
      message: voucher.message,
    })

    return NextResponse.json({ ok: true, message: `Voucher email successfully sent to ${voucher.recipientEmail}` })
  } catch (err: any) {
    console.error("[api/gift-vouchers/resend] error:", err)
    return NextResponse.json({ error: err.message || "Failed to resend voucher email" }, { status: 500 })
  }
}

