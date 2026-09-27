import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { EMAIL_ALREADY_HAS_ACCOUNT, emailBelongsToOtherProfile, LINKED_EMAIL_MESSAGE } from "@/lib/auth/one-email";
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
  const email = String(body?.email ?? session.user.email ?? "").trim().toLowerCase();
  const name = String(body?.name ?? "").trim();

  if (!name || !email || !email.includes("@") || !phone) {
    return NextResponse.json({ error: "Name, email, and a valid phone number are required." }, { status: 400 });
  }

  const phoneTaken = await prisma.customerProfile.findUnique({ where: { phone } });
  if (phoneTaken) {
    return NextResponse.json({ error: "That phone number already belongs to an account." }, { status: 409 });
  }

  const sessionEmail = session.user.email ?? "";
  if (
    (await emailBelongsToOtherProfile(sessionEmail, session.user.id)) ||
    (await emailBelongsToOtherProfile(email, session.user.id))
  ) {
    return NextResponse.json(
      { error: LINKED_EMAIL_MESSAGE, code: EMAIL_ALREADY_HAS_ACCOUNT },
      { status: 409 },
    );
  }

  await prisma.customerProfile.create({
    data: { neonUserId: session.user.id, name, email, phone },
  });

  return NextResponse.json({ ok: true });
}
