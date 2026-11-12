import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAuth } from "@/lib/admin-auth"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { adminPassword } = body as { adminPassword?: string }

    if (!checkAdminAuth(req, adminPassword)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!id) {
      return NextResponse.json({ error: "Customer profile ID is required" }, { status: 400 })
    }

    const existing = await prisma.customerProfile.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Customer profile not found" }, { status: 404 })
    }

    const updated = await prisma.customerProfile.update({
      where: { id },
      data: { blocked: false },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        blocked: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("[api/admin/users/unblock] error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to unblock user" },
      { status: 500 }
    )
  }
}

