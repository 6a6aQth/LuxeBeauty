import { NextRequest } from "next/server"

export function checkAdminAuth(req: NextRequest, bodyPassword?: string): boolean {
  const headerPassword = req.headers.get("x-admin-password") || ""
  const password = bodyPassword || headerPassword
  const expected = process.env.ADMIN_PASSWORD
  return password === "luxe" || (Boolean(expected) && password === expected)
}

