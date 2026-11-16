# Neon Auth Guide

How best to add real authentication to a project using Neon Auth. This assumes Prisma and Postgres are already set up — see the Prisma Database Guide first if not, since the last step here depends on it.

## Understanding what Neon Auth actually is

It's worth being clear about this before writing any code: Neon Auth handles identity only — email and password, OAuth logins, session cookies. It is not, and should not become, your application's own profile table. Neon owns the identity data; your own Postgres database, through Prisma, owns everything else about that person that your product actually cares about — their role, their plan, whatever they're related to in your schema. Once someone signs in successfully through Neon, the very next thing that should happen is your own code creating or updating a matching row in your own database. What you call that row is entirely up to the project — a `User` model is the obvious default, but if this project already has a different name for "the person using the app" (a `Client`, a `Member`, a `Customer`), use that instead. Nothing about Neon Auth requires the name `User` specifically; it's just the placeholder used through the rest of this guide.

One more naming note before the console: Neon currently defaults new projects to what it calls Managed Better Auth, which uses a base URL plus a cookie secret you generate yourself. Older Neon projects sometimes still show a different set of keys prefixed `NEXT_PUBLIC_STACK_` — that's the previous integration, now considered legacy. If a project you're working on already has those Stack keys sitting in its Neon console, this guide's approach doesn't apply to it as written; that's a different, older setup.

## Setting it up in the Neon console

Open the project in the Neon console and find the Auth section — enable it if it isn't already. Once enabled, the console will show an Auth base URL, something in the shape of `https://ep-xxxxx.neonauth.<region>.aws.neon.tech/<dbname>/auth`. That's the value that becomes `NEON_AUTH_BASE_URL` — worth double-checking it's not confused with the separate `DATABASE_URL`, since the two live right next to each other in the console and look similar at a glance.

Email and password sign-in is on by default, which is fine to leave as-is unless the product specifically wants Google-only sign-in. If Google login is needed, that's a two-sided setup: enable the Google provider in Neon's Auth settings, and separately create an OAuth client in Google Cloud Console (a "Web application" type). Google will ask for authorized redirect URIs, which Neon's own console will show you — and the browser origins added in the next step need to match what's registered on the Google side too, or the redirect will fail even though everything else is configured correctly.

## Environment variables

Alongside `DATABASE_URL`, two new variables are needed:

```env
NEON_AUTH_BASE_URL="https://ep-xxx.neonauth.REGION.aws.neon.tech/neondb/auth"
NEON_AUTH_COOKIE_SECRET="generate-with-openssl-rand-base64-32"
```

The cookie secret isn't something Neon gives you — generate it yourself with `openssl rand -base64 32`, and keep it at least 32 characters, since the auth library will refuse to start otherwise. Both of these go in the same single `.env` file as `DATABASE_URL` — there's no need for a separate `.env.local`, since Next.js already reads plain `.env` on its own.

One thing worth knowing before it causes confusion later: connecting Neon to a Vercel project through Vercel's Storage integration will automatically fill in `DATABASE_URL` for you, but it does not do the same for these two Auth variables. Those always have to be copied from the console (or generated) and added by hand, even on a project where the database connection itself was wired up automatically. If you're setting env vars in Vercel by uploading your local `.env` file directly (the simplest approach, and the one this project uses instead of relying on the Storage integration), all three variables go in together with no extra step.

## The part that catches almost everyone at least once: allowed origins

Neon Auth checks which website is making the request, and it will quietly refuse anything it doesn't recognize. Localhost usually works without any configuration, but a live Vercel URL will not — until it's explicitly added to the list of allowed origins in Neon's Auth settings. Each one needs to be typed exactly, with no trailing slash:

```text
http://localhost:3000
https://your-project.vercel.app
https://www.your-real-domain.com
```

`https://www.your-real-domain.com/` — with a trailing slash — will not match, even though it looks identical at a glance.

The symptom this produces is distinctive enough to be worth memorizing: sign-in works perfectly on localhost, but the exact same request in production comes back with a 403. If the app's own error handling treats every failure the same way, this can misleadingly present itself as "check your API keys" — but a 403 specifically means the opposite: Auth is configured correctly, and it's the origin that's being rejected. Chasing this as a credentials problem wastes time; it's always the origin list. After adding one, a hard refresh is usually enough — a redeploy is only needed if an actual environment variable changed. And if Preview deployments on Vercel are ever used to test sign-in (rather than just Production), each specific preview URL needs to be added too, since every preview gets its own unique subdomain.

## Installing and wiring it into Next.js

```bash
pnpm add @neondatabase/auth
```

Three small files complete the wiring. First, a server-side singleton that Next.js and Node can share, at `lib/auth/neon.ts`:

```typescript
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
```

This caches the client the first time it's created, which means the dev server needs restarting after changing any of the env vars it reads — a simple hot-reload won't pick that up.

Second, a single proxy route that the browser actually talks to, at `app/api/auth/[...path]/route.ts`. The browser never contacts Neon directly; it calls your own domain, and this route forwards the request and handles the resulting session cookie:

```typescript
import { NextResponse } from "next/server";
import { getNeonAuth } from "@/lib/auth/neon";

type Params = { path: string[] };

async function handle(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  request: Request,
  context: { params: Params | Promise<Params> }
) {
  const neon = getNeonAuth();
  if (!neon) {
    return NextResponse.json(
      { error: "Neon Auth is not configured. Set NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET." },
      { status: 503 }
    );
  }
  const handlers = neon.handler();
  const params = Promise.resolve(context.params);
  return handlers[method](request, { params });
}

export const GET = (req: Request, ctx: { params: Params | Promise<Params> }) => handle("GET", req, ctx);
export const POST = (req: Request, ctx: { params: Params | Promise<Params> }) => handle("POST", req, ctx);
export const PUT = (req: Request, ctx: { params: Params | Promise<Params> }) => handle("PUT", req, ctx);
export const PATCH = (req: Request, ctx: { params: Params | Promise<Params> }) => handle("PATCH", req, ctx);
export const DELETE = (req: Request, ctx: { params: Params | Promise<Params> }) => handle("DELETE", req, ctx);
```

Worth remembering the distinction between the two error codes this setup can produce: a 503 here means the env vars themselves are missing or still placeholders, while a 403 (covered above) means the origin was rejected. They look similar at first glance but point in completely different directions, so it's worth checking which one is actually happening before trying to fix either.

Third, the client-side piece the UI actually calls, at `lib/auth/client.ts`:

```typescript
"use client";
import { createAuthClient } from "@neondatabase/auth/next";
export const authClient = createAuthClient();
```

From a Client Component or an event handler:

```typescript
await authClient.signUp.email({ email, password, name });
await authClient.signIn.email({ email, password });
await authClient.signIn.social({ provider: "google", callbackURL: "/" });
await authClient.signOut();
const session = authClient.useSession(); // { data, isPending }
```

## Connecting a successful sign-in to your own database

This is the step that actually matters most, and it's easy to skip by mistake since Neon Auth "just works" on its own well before this piece exists. After a session is established, look it up server-side and make sure a matching row exists in your own table — creating one if this is the person's first time, updating it if not:

```prisma
model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique
  name         String
  authProvider String   @map("auth_provider")
  createdAt    DateTime @default(now()) @map("created_at")

  @@map("users")
}
```

Again — rename `User` to whatever this project already calls this entity, and adjust the fields to match. The one part worth keeping regardless of the name: matching by `email`, and reusing Neon's own user id as the primary key when it's already a UUID, rather than generating an entirely separate one.

```typescript
import { prisma } from "@/lib/db";

function asUuid(id: string): string | undefined {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id
    : undefined;
}

export async function upsertAppUser(input: {
  authUserId: string;
  email: string;
  name: string;
  authProvider: string;
}) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { name: input.name || existing.name },
    });
  }
  return prisma.user.create({
    data: {
      ...(asUuid(input.authUserId) ? { id: input.authUserId } : {}),
      email,
      name: input.name || email.split("@")[0],
      authProvider: input.authProvider,
    },
  });
}
```

Call this right after `signIn`, `signUp`, or wherever a server route checks `getNeonAuth()?.getSession()`. And when protecting an API route, check for both a valid Neon session and a matching row in your own table — never authorize someone purely because an email address showed up in a request body, since that's trivially fakeable.

## Shipping it to Vercel

Both `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET` need to be set for both the Production and Preview environments in Vercel — not just Production, if Preview deployments will ever be used to test sign-in. And if they are, remember to add each specific preview URL to Neon's allowed origins too, per the section above.

One deployment-ordering detail worth being deliberate about: run `prisma migrate deploy` against production before assuming any new column exists, since Auth's own tables live inside Neon's managed Auth service, separate from anything tracked in `schema.prisma`.

## Troubleshooting

| What you're seeing | What it usually means | What to do |
|---|---|---|
| Sign-in returns 403 | The origin making the request isn't on Neon's allowed list, or has a trailing slash | Add it exactly as shown in the browser's address bar, no trailing slash |
| Sign-in returns 503 | `NEON_AUTH_BASE_URL` is still a placeholder, or the cookie secret is under 32 characters | Fix the env var and restart the dev server |
| Works locally, fails once deployed | Env vars only set for Preview and not Production, or the deployed origin isn't on the allowed list | Check both |
| Session comes back empty right after signing in | Cookies being blocked, or a `Secure` cookie flag over a plain HTTP connection | Serve over HTTPS in production and check same-site cookie settings |
| Google sign-in redirects incorrectly | Provider not enabled on the Neon side, or the redirect URI registered in Google Cloud doesn't match | Revisit the Google Cloud client's authorized redirect URIs |

If any of these show up, it's worth resisting the instinct to rotate the database password — none of them are actually about `DATABASE_URL`, and changing it won't touch any of the causes above.
