import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAuth } from "@/lib/admin-auth"

export async function DELETE(
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

    await prisma.customerProfile.delete({
      where: { id },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    console.error("[api/admin/users/delete] error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete user profile" },
      { status: 500 }
    )
  }
}

