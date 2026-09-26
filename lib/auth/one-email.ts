import prisma from "@/lib/prisma";

export const GOOGLE_ONLY_SIGN_IN_MESSAGE = "This email uses Google. Continue with Google.";

export const EMAIL_TAKEN_MESSAGE = "That email already belongs to an account.";

export const LINKED_EMAIL_MESSAGE =
  "This email already has an account. Sign in with the password for that account.";

export const EMAIL_ALREADY_HAS_ACCOUNT = "email_already_has_account";

const CREDENTIAL = "credential";
const GOOGLE = "google";

export type NeonIdentity = {
  userId: string;
  providers: string[];
};

export function isGoogleOnly(identity: NeonIdentity): boolean {
  const providers = identity.providers.map((provider) => provider.toLowerCase());
  return providers.includes(GOOGLE) && !providers.includes(CREDENTIAL);
}

/** Provider ids only. Never selects the credential password hash. */
export async function findNeonIdentityByEmail(email: string): Promise<NeonIdentity | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const rows = await prisma.$queryRaw<Array<{ userId: string; providerId: string | null }>>`
    SELECT u.id::text AS "userId", a."providerId" AS "providerId"
    FROM neon_auth."user" u
    LEFT JOIN neon_auth.account a ON a."userId" = u.id
    WHERE lower(u.email) = ${normalized}
  `;

  if (rows.length === 0) return null;

  const providers = rows
    .map((row) => row.providerId)
    .filter((provider): provider is string => Boolean(provider));

  return { userId: rows[0].userId, providers };
}

export async function emailBelongsToOtherProfile(email: string, neonUserId: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const profile = await prisma.customerProfile.findUnique({ where: { email: normalized } });
  return Boolean(profile && profile.neonUserId !== neonUserId);
}
