import { createNeonAuth } from "@neondatabase/auth/next/server";

type NeonAuthInstance = ReturnType<typeof createNeonAuth>;

let cached: NeonAuthInstance | null | undefined;

export function getNeonAuth(): NeonAuthInstance | null {
  if (cached !== undefined) return cached;
  const baseUrl = process.env.NEON_AUTH_BASE_URL?.trim();
  const secret = process.env.NEON_AUTH_COOKIE_SECRET?.trim();
  const ok =
    Boolean(baseUrl) &&
    Boolean(baseUrl?.includes("neonauth")) &&
    !baseUrl?.includes("ep-xxx") &&
    Boolean(secret && secret.length >= 32);
  if (!ok) {
    cached = null;
    return null;
  }
  cached = createNeonAuth({ baseUrl: baseUrl!, cookies: { secret: secret! } });
  return cached;
}
