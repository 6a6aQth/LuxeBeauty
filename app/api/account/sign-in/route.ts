import { NextResponse } from "next/server";
import { getNeonAuth } from "@/lib/auth/neon";

export async function POST(req: Request) {
  const neon = getNeonAuth();
  if (!neon) {
    return NextResponse.json(
      { error: "Neon Auth is not configured. Set NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const { error } = await neon.signIn.email({ email, password });
  if (error) {
    return NextResponse.json({ error: error.message || "Sign-in failed." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
