import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/auth/session"
import { phonesMatch } from "@/lib/phone"

/** Guest reschedules skip Neon Auth. Account reschedules must match the profile phone. */
export async function sessionPhoneForAccount(fromAccount: boolean): Promise<
  { ok: true; phone: string | null } | { ok: false; response: NextResponse }
> {
  if (!fromAccount) return { ok: true, phone: null }

  const session = await getSessionUser()
  if (!session.configured) {
    return { ok: false, response: NextResponse.json({ error: "Neon Auth is not configured." }, { status: 503 }) }
  }
  if (!session.user) {
    return { ok: false, response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) }
  }

  const profile = await prisma.customerProfile.findUnique({
    where: { neonUserId: session.user.id },
  })
  if (!profile) {
    return { ok: false, response: NextResponse.json({ error: "No studio profile for this account." }, { status: 404 }) }
  }
  return { ok: true, phone: profile.phone }
}

export function rejectOtherPhone(bookingPhone: string, sessionPhone: string | null) {
  if (sessionPhone !== null && !phonesMatch(bookingPhone, sessionPhone)) {
    return NextResponse.json(
      { error: "This visit does not belong to the signed-in phone number." },
      { status: 403 }
    )
  }
  return null
}
