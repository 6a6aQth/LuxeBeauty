import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
  const session = await getSessionUser();
  if (!session.configured) {
    return NextResponse.json({ error: "Neon Auth is not configured." }, { status: 503 });
  }
  if (!session.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const profile = await prisma.customerProfile.findUnique({
    where: { neonUserId: session.user.id },
  });
  if (!profile) {
    return NextResponse.json({ error: "No studio profile for this account." }, { status: 404 });
  }

  return NextResponse.json({
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
  });
}
