import { getNeonAuth } from "@/lib/auth/neon";

export type SessionUser = {
  id: string;
  email?: string;
  name?: string;
};

function readUser(data: unknown): SessionUser | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const direct = record.user;
  const nested =
    record.session && typeof record.session === "object"
      ? (record.session as Record<string, unknown>).user
      : undefined;
  const user = (direct ?? nested) as { id?: string; email?: string; name?: string } | undefined;
  if (!user?.id) return null;
  return { id: user.id, email: user.email, name: user.name };
}

export async function getSessionUser(): Promise<
  | { configured: false }
  | { configured: true; user: SessionUser | null }
> {
  const neon = getNeonAuth();
  if (!neon) return { configured: false };
  const result = await neon.getSession();
  return { configured: true, user: readUser(result?.data ?? result) };
}
