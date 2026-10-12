import { NextResponse } from "next/server"
import { checkSecretKey } from "@/lib/paychangu-direct"
import { reconcileUntilQuiet } from "@/lib/payments"

const PAGE_PASSWORD = "luxe"

export const maxDuration = 60

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const password = typeof body.adminPassword === "string" ? body.adminPassword : ""
  const envPassword = process.env.ADMIN_PASSWORD
  const allowed = password === PAGE_PASSWORD || (Boolean(envPassword) && password === envPassword)
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const key = await checkSecretKey()
  const checked = await reconcileUntilQuiet()
  return NextResponse.json({ checked, key })
}
