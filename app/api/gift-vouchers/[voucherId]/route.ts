import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) {
  try {
    const { voucherId } = await params

    if (!voucherId) {
      return NextResponse.json({ error: "Voucher ID is required" }, { status: 400 })
    }

    const voucher = await prisma.giftVoucher.findUnique({
      where: { voucherId: voucherId.trim().toUpperCase() },
      include: {
        redemptions: {
          orderBy: { redeemedAt: "desc" },
        },
      },
    })

    if (!voucher) {
      return NextResponse.json({ error: "Gift voucher not found" }, { status: 404 })
    }

    // Public lookup does not need to expose sensitive internal IDs
    return NextResponse.json({
      voucherId: voucher.voucherId,
      status: voucher.status,
      purchaseAmount: voucher.purchaseAmount,
      remainingBalance: voucher.remainingBalance,
      recipientName: voucher.recipientName,
      purchaserName: voucher.purchaserName,
      message: voucher.message,
      createdAt: voucher.createdAt,
      redemptions: voucher.redemptions.map((r) => ({
        id: r.id,
        amountDeducted: r.amountDeducted,
        serviceNames: r.serviceNames,
        note: r.note,
        redeemedAt: r.redeemedAt,
      })),
    })
  } catch (error: any) {
    console.error("[api/gift-vouchers/[voucherId]] error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

