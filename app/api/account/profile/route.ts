import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { EMAIL_ALREADY_HAS_ACCOUNT, emailBelongsToOtherProfile, LINKED_EMAIL_MESSAGE } from "@/lib/auth/one-email";

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
    const sessionEmail = session.user.email ?? "";
    if (await emailBelongsToOtherProfile(sessionEmail, session.user.id)) {
      return NextResponse.json(
        { error: LINKED_EMAIL_MESSAGE, code: EMAIL_ALREADY_HAS_ACCOUNT },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: "No studio profile for this account.",
        suggested: {
          name: session.user.name ?? "",
          email: session.user.email ?? "",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
  });
}
