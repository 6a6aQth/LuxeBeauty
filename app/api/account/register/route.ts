import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getNeonAuth } from "@/lib/auth/neon";
import { EMAIL_TAKEN_MESSAGE, findNeonIdentityByEmail } from "@/lib/auth/one-email";
import { canonicalPhone } from "@/lib/phone";

function readUserId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const user = record.user as { id?: string } | undefined;
  return user?.id ?? null;
}

export async function POST(req: Request) {
  const neon = getNeonAuth();
  if (!neon) {
    return NextResponse.json(
      { error: "Neon Auth is not configured. Set NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const confirmPassword = String(body?.confirmPassword ?? "");
  const phone = canonicalPhone(String(body?.phone ?? ""));

  if (!name || !email || !password || !phone) {
    return NextResponse.json(
      { error: "Name, email, password, and a valid phone number are required." },
      { status: 400 }
    );
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  const phoneTaken = await prisma.customerProfile.findUnique({ where: { phone } });
  if (phoneTaken) {
    return NextResponse.json({ error: "That phone number already belongs to an account." }, { status: 409 });
  }

  const emailTaken = await prisma.customerProfile.findUnique({ where: { email } });
  if (emailTaken) {
    return NextResponse.json({ error: EMAIL_TAKEN_MESSAGE }, { status: 409 });
  }

  try {
    const identity = await findNeonIdentityByEmail(email);
    if (identity) {
      return NextResponse.json({ error: EMAIL_TAKEN_MESSAGE }, { status: 409 });
    }
  } catch {
    return NextResponse.json({ error: "Could not check this email. Try again." }, { status: 503 });
  }

  const { data, error } = await neon.signUp.email({ email, password, name });
  if (error) {
    return NextResponse.json({ error: error.message || "Sign-up failed." }, { status: 400 });
  }

  const neonUserId = readUserId(data);
  if (!neonUserId) {
    return NextResponse.json({ error: "Sign-up did not return a user id." }, { status: 502 });
  }

  try {
    await prisma.customerProfile.create({
      data: { neonUserId, name, email, phone },
    });
  } catch {
    return NextResponse.json(
      { error: "The account was created, but the studio profile could not be saved." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
