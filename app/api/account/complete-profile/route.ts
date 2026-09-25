import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { canonicalPhone } from "@/lib/phone";

/** After Google sign-in, store the studio phone on CustomerProfile. */
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session.configured) {
    return NextResponse.json({ error: "Neon Auth is not configured." }, { status: 503 });
  }
  if (!session.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const existing = await prisma.customerProfile.findUnique({
    where: { neonUserId: session.user.id },
  });
  if (existing) return NextResponse.json({ ok: true });

  const body = await req.json().catch(() => null);
  const phone = canonicalPhone(String(body?.phone ?? ""));
  const email = String(session.user.email ?? "").trim().toLowerCase();
  const name = String(session.user.name ?? "").trim() || email.split("@")[0] || "Customer";

  if (!phone || !email) {
    return NextResponse.json({ error: "A valid phone number is required." }, { status: 400 });
  }

  const phoneTaken = await prisma.customerProfile.findUnique({ where: { phone } });
  if (phoneTaken) {
    return NextResponse.json({ error: "That phone number already belongs to an account." }, { status: 409 });
  }

  const emailTaken = await prisma.customerProfile.findUnique({ where: { email } });
  if (emailTaken) {
    return NextResponse.json({ error: "That email already belongs to an account." }, { status: 409 });
  }

  await prisma.customerProfile.create({
    data: { neonUserId: session.user.id, name, email, phone },
  });

  return NextResponse.json({ ok: true });
}
