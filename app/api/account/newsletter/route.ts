import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/auth/session"

async function profileForSession() {
  const session = await getSessionUser()
  if (!session.configured) {
    return { error: NextResponse.json({ error: "Neon Auth is not configured." }, { status: 503 }) }
  }
  if (!session.user) {
    return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) }
  }
  const profile = await prisma.customerProfile.findUnique({
    where: { neonUserId: session.user.id },
  })
  if (!profile) {
    return { error: NextResponse.json({ error: "No studio profile for this account." }, { status: 404 }) }
  }
  return { profile }
}

export async function POST() {
  const result = await profileForSession()
  if ("error" in result && result.error) return result.error
  const email = result.profile.email
  const existing = await prisma.newsletterSubscription.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  })
  if (!existing) {
    await prisma.newsletterSubscription.create({ data: { email } })
  }
  return NextResponse.json({ subscribed: true })
}

export async function DELETE() {
  const result = await profileForSession()
  if ("error" in result && result.error) return result.error
  await prisma.newsletterSubscription.deleteMany({
    where: { email: { equals: result.profile.email, mode: "insensitive" } },
  })
  return NextResponse.json({ subscribed: false })
}
