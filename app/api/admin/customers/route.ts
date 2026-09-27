import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** Account list for the admin screen. Name, email, and phone only. */
export async function GET() {
  try {
    const accounts = await prisma.customerProfile.findMany({
      select: { name: true, email: true, phone: true },
      orderBy: { name: "asc" },
    })
    return NextResponse.json(accounts)
  } catch (error) {
    console.error("Failed to list customer profiles", error)
    return NextResponse.json({ error: "Failed to list accounts" }, { status: 500 })
  }
}
