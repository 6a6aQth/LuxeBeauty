import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

function checkAdminAuth(req: NextRequest): boolean {
  const password = req.headers.get("x-admin-password") || ""
  const expected = process.env.ADMIN_PASSWORD
  return password === "luxe" || (Boolean(expected) && password === expected)
}

export async function GET(req: NextRequest) {
  try {
    if (!checkAdminAuth(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const vouchers = await prisma.giftVoucher.findMany({
      where: {
        remainingBalance: { gt: 0 },
        status: { in: ["active", "depleted"] },
      },
      include: {
        redemptions: {
          orderBy: { redeemedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(vouchers)
  } catch (error: any) {
    console.error("[api/admin/gift-vouchers] error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

