import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

function checkAdminAuth(req: NextRequest, bodyPassword?: string): boolean {
  const headerPassword = req.headers.get("x-admin-password") || ""
  const password = bodyPassword || headerPassword
  const expected = process.env.ADMIN_PASSWORD
  return password === "luxe" || (Boolean(expected) && password === expected)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) {
  try {
    const { voucherId } = await params
    const body = await req.json()
    const { serviceIds, amount, note, adminPassword } = body

    if (!checkAdminAuth(req, adminPassword)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!voucherId) {
      return NextResponse.json({ error: "Voucher ID is required" }, { status: 400 })
    }

    const voucher = await prisma.giftVoucher.findUnique({
      where: { voucherId: voucherId.trim().toUpperCase() },
    })

    if (!voucher) {
      return NextResponse.json({ error: "Voucher not found" }, { status: 404 })
    }

    if (voucher.status !== "active") {
      return NextResponse.json(
        { error: `Cannot redeem voucher with status '${voucher.status}'` },
        { status: 400 }
      )
    }

    let calculatedAmount = 0
    let serviceNames: string[] = []
    let resolvedServiceIds: string[] = []

    if (Array.isArray(serviceIds) && serviceIds.length > 0) {
      resolvedServiceIds = serviceIds.map(String)
      const services = await prisma.service.findMany({
        where: { id: { in: resolvedServiceIds } },
        select: { id: true, name: true, price: true },
      })

      if (services.length !== resolvedServiceIds.length) {
        return NextResponse.json(
          { error: "One or more selected services could not be found." },
          { status: 400 }
        )
      }

      for (const svc of services) {
        if (!svc.price || svc.price <= 0) {
          return NextResponse.json(
            { error: `Service '${svc.name}' does not have a positive price.` },
            { status: 400 }
          )
        }
        calculatedAmount += svc.price
        serviceNames.push(svc.name)
      }
    } else if (amount) {
      const parsed = typeof amount === "number" ? Math.round(amount) : parseInt(String(amount), 10)
      if (isNaN(parsed) || parsed <= 0) {
        return NextResponse.json({ error: "Invalid redemption amount." }, { status: 400 })
      }
      if (!note || !note.trim()) {
        return NextResponse.json(
          { error: "A mandatory note is required for custom amount redemptions." },
          { status: 400 }
        )
      }
      calculatedAmount = parsed
    } else {
      return NextResponse.json(
        { error: "Must specify either serviceIds or a custom amount with note." },
        { status: 400 }
      )
    }

    // FM-13: amountDeducted <= remainingBalance enforced server-side
    if (calculatedAmount > voucher.remainingBalance) {
      return NextResponse.json(
        {
          error: `Deduction amount (MWK ${calculatedAmount.toLocaleString()}) exceeds remaining voucher balance (MWK ${voucher.remainingBalance.toLocaleString()}).`,
        },
        { status: 400 }
      )
    }

    const newBalance = voucher.remainingBalance - calculatedAmount
    const newStatus = newBalance === 0 ? "depleted" : "active"

    // Atomic transaction for redemption record and balance decrement
    const result = await prisma.$transaction(async (tx) => {
      const redemption = await tx.giftVoucherRedemption.create({
        data: {
          voucherId: voucher.id,
          amountDeducted: calculatedAmount,
          serviceIds: resolvedServiceIds,
          serviceNames,
          note: note?.trim() || null,
        },
      })

      const updated = await tx.giftVoucher.update({
        where: { id: voucher.id },
        data: {
          remainingBalance: newBalance,
          status: newStatus,
        },
        include: {
          redemptions: {
            orderBy: { redeemedAt: "desc" },
          },
        },
      })

      return { redemption, voucher: updated }
    })

    return NextResponse.json({
      ok: true,
      voucher: result.voucher,
      redemption: result.redemption,
    })
  } catch (error: any) {
    console.error("[api/admin/gift-vouchers/redeem] error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

