# Paychangu Direct Charge Guide (Mobile Money)

How to move off Paychangu's hosted checkout page and collect mobile money payments directly from your own server — no redirect, no checkout URL, no "the page says failed but the client got debited" problem, because there's no page in the loop to say anything wrong.

## The one idea worth understanding before writing any code

With hosted checkout, Paychangu owns a page: it takes the customer's money, then has to hand control of the browser back to your app by redirecting it somewhere. That handoff is exactly where things go wrong — the debit can succeed on Paychangu's/the mobile network's side while the redirect itself fails, times out, or the customer's browser shows a stale/incorrect status before the real one has propagated. That's a class of bug baked into "put a UI in between the payment and my confirmation."

Direct Charge removes that UI entirely. The flow becomes:

1. Your server calls `POST /mobile-money/payments/initialize` with the customer's number and a `charge_id` you generate.
2. The customer's *phone*, not their browser, gets a USSD/PIN prompt from their mobile money provider (Airtel Money, TNM Mpamba, or Paychangu's own Changu Wallet) and authorizes it there.
3. There is no redirect back to you at all. The only way you ever find out what happened is by asking Paychangu yourself — either by polling `GET /mobile-money/payments/{chargeId}/verify`, or by receiving a webhook and then still calling that same verify endpoint before trusting it.

Because nothing about the outcome ever passes through the customer's browser, there's no page for a stale or wrong status to be displayed on. The tradeoff, and it's a real one: your UI now has to sit and wait ("check your phone") instead of just redirecting, and you're on the hook for polling until the charge resolves, since some customers close the tab before entering their PIN.

## Environment variables

```env
PAYCHANGU_SECRET_KEY=
PAYCHANGU_WEBHOOK_SECRET=
```

You no longer need `PAYCHANGU_PUBLIC_KEY` or `NEXT_PUBLIC_APP_URL` for this flow specifically — there's no checkout widget to mount and no `return_url`/`callback_url` to redirect to, since nothing ever leaves your own server-to-server calls. Keep them around only if another part of the project still uses hosted checkout or an inline widget elsewhere.

One correction worth flagging against the hosted-checkout guide: the webhook signature header Paychangu actually sends is `Signature`, not `x-paychangu-signature`. If a webhook handler was copied over from the hosted-checkout guide, check the header name — this is a common reason a webhook silently never validates.

## The shared piece both tiers use

Two calls: initiate the charge, and verify it. As before, put both in one file, `lib/paychangu-direct.ts`:

```typescript
const PAYCHANGU_BASE_URL = "https://api.paychangu.com";

function getSecretKey(): string {
  const key = process.env.PAYCHANGU_SECRET_KEY;
  if (!key) throw new Error("PAYCHANGU_SECRET_KEY is not set.");
  return key;
}

// Paychangu's operator ref_ids are effectively static, but fetching them
// once and caching beats hardcoding UUIDs that could be rotated per account.
// GET /mobile-money returns { data: [{ name, ref_id, short_code, ... }] }.
export async function getMobileMoneyOperators() {
  const res = await fetch(`${PAYCHANGU_BASE_URL}/mobile-money`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${getSecretKey()}` },
  });
  const body = await res.json();
  if (!res.ok || body.status !== "success") {
    throw new Error(`Paychangu operator lookup failed: ${body.message ?? res.statusText}`);
  }
  // Each item looks like: { name: "TNM Mpamba", ref_id: "...", short_code: "tnm" }
  return body.data as Array<{ name: string; ref_id: string; short_code: string }>;
}

export interface ChargeMobileMoneyParams {
  mobile: string; // customer's phone number, e.g. "0991234567"
  mobileMoneyOperatorRefId: string; // from getMobileMoneyOperators()
  amount: number;
  chargeId: string; // YOU generate this, must be unique per attempt
  email?: string;
  firstName?: string;
  lastName?: string;
}

export async function chargeMobileMoney(params: ChargeMobileMoneyParams) {
  const res = await fetch(`${PAYCHANGU_BASE_URL}/mobile-money/payments/initialize`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${getSecretKey()}`,
    },
    body: JSON.stringify({
      mobile: params.mobile,
      mobile_money_operator_ref_id: params.mobileMoneyOperatorRefId,
      // The API's own schema types this field as a string, unlike the
      // hosted /payment endpoint, which takes a number. Send it as a string
      // here even though it looks inconsistent with the other guide.
      amount: String(params.amount),
      charge_id: params.chargeId,
      email: params.email,
      first_name: params.firstName,
      last_name: params.lastName,
    }),
  });

  const body = await res.json();
  if (!res.ok || body.status !== "success") {
    // A 400 here is common and often user-facing, e.g. "Session has expired
    // for last transaction. Please try again" — surface body.message rather
    // than a generic error where you can.
    throw new Error(`Paychangu direct charge failed: ${body.message ?? res.statusText}`);
  }

  // data.status here is just the *initial* state (almost always "pending") —
  // it tells you the prompt was sent to the phone, nothing about the outcome.
  return { chargeId: body.data.charge_id as string, initialStatus: body.data.status as string };
}

export interface VerifyDirectChargeResult {
  status: "success" | "pending" | "failed" | string;
  chargeId: string;
  amount: number;
  currency: string;
  mode: "live" | "test" | string;
  completedAt: string | null;
  raw: unknown;
}

export async function verifyDirectCharge(chargeId: string): Promise<VerifyDirectChargeResult> {
  const res = await fetch(`${PAYCHANGU_BASE_URL}/mobile-money/payments/${encodeURIComponent(chargeId)}/verify`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${getSecretKey()}` },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Paychangu verify failed: ${body.message ?? res.statusText}`);
  }

  return {
    status: body.data.status,
    chargeId: body.data.charge_id,
    amount: body.data.amount,
    currency: body.data.currency,
    mode: body.data.mode,
    completedAt: body.data.completed_at ?? null,
    raw: body.data,
  };
}
```

## If this is a demo, without a real database yet

Same shape as before, but the UI now has a genuine waiting state instead of a redirect, because nothing is going to send the browser anywhere. A route kicks off the charge:

```typescript
// app/api/paychangu/direct-charge/route.ts
import { NextRequest, NextResponse } from "next/server";
import { chargeMobileMoney } from "@/lib/paychangu-direct";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { chargeId } = await chargeMobileMoney({
    mobile: body.mobile,
    mobileMoneyOperatorRefId: body.mobileMoneyOperatorRefId,
    amount: body.amount,
    chargeId: crypto.randomUUID(),
    email: body.email,
  });

  return NextResponse.json({ chargeId });
}
```

And a status route the client polls — this is the part that replaces the redirect:

```typescript
// app/api/paychangu/direct-charge/[chargeId]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyDirectCharge } from "@/lib/paychangu-direct";

export async function GET(_req: NextRequest, { params }: { params: { chargeId: string } }) {
  const result = await verifyDirectCharge(params.chargeId);
  return NextResponse.json({ status: result.status, amount: result.amount });
}
```

The client polls that route every few seconds after showing "Check your phone for a payment prompt":

```tsx
// components/direct-charge-status.tsx
"use client";

import { useEffect, useState } from "react";

export function DirectChargeStatus({ chargeId }: { chargeId: string }) {
  const [status, setStatus] = useState<"pending" | "success" | "failed">("pending");

  useEffect(() => {
    if (status !== "pending") return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/paychangu/direct-charge/${chargeId}/status`);
      const data = await res.json();
      if (data.status === "success" || data.status === "failed") {
        setStatus(data.status);
      }
    }, 4000); // Paychangu's own retry guidance for background jobs is hourly;
              // for a live UI, a few seconds is reasonable — just don't go
              // below a couple of seconds, since you're polling per-customer.
    return () => clearInterval(interval);
  }, [chargeId, status]);

  if (status === "pending") return <p>Check your phone for a payment prompt…</p>;
  if (status === "success") return <p>Payment successful.</p>;
  return <p>Payment failed. Please try again.</p>;
}
```

No database yet, so there's nothing to write twice — the polling loop just stops once it gets a final status.

## Once there's a real database

The one thing that changes: a `pending` charge can outlive the browser tab, because the customer might close it before entering their PIN, or before your poll interval catches the final state. That means Direct Charge needs a way to resolve charges that nobody is actively watching, which the hosted-checkout flow never had to worry about (its redirect made every completed payment self-reporting).

```prisma
model Order {
  id        String   @id @default(uuid()) @db.Uuid
  reference String   @unique
  status    String   @default("pending")
  amount    Int
  createdAt DateTime @default(now()) @map("created_at")

  payments Payment[]

  @@map("orders")
}

model Payment {
  id           String   @id @default(uuid()) @db.Uuid
  orderId      String   @map("order_id") @db.Uuid
  order        Order    @relation(fields: [orderId], references: [id])
  paychanguRef String   @unique @map("paychangu_charge_id")
  status       String
  confirmedAt  DateTime @default(now()) @map("confirmed_at")

  @@map("payments")
}
```

The status route now persists on a terminal result, guarded the same way as before — check for an existing `Payment` row before writing:

```typescript
// app/api/paychangu/direct-charge/[chargeId]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyDirectCharge } from "@/lib/paychangu-direct";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { chargeId: string } }) {
  const chargeId = params.chargeId;

  const existing = await prisma.payment.findUnique({ where: { paychanguRef: chargeId } });
  if (existing) return NextResponse.json({ status: existing.status });

  const result = await verifyDirectCharge(chargeId);
  if (result.status !== "success" && result.status !== "failed") {
    return NextResponse.json({ status: "pending" });
  }

  const order = await prisma.order.findUnique({ where: { reference: chargeId } });
  if (!order) return NextResponse.json({ status: result.status }); // nothing to persist against yet

  if (result.status === "success") {
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status: "confirmed" } }),
      prisma.payment.create({ data: { orderId: order.id, paychanguRef: chargeId, status: "completed" } }),
    ]);
  } else {
    await prisma.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
  }

  return NextResponse.json({ status: result.status });
}
```

That covers the customer who stays on the page. For the customer who doesn't, add a background sweep — a cron route or scheduled job — that re-verifies anything still `pending` past a few minutes old, so a payment that completed after the tab closed still gets recorded:

```typescript
// app/api/cron/reconcile-pending-charges/route.ts
import { NextResponse } from "next/server";
import { verifyDirectCharge } from "@/lib/paychangu-direct";
import { prisma } from "@/lib/db";

export async function GET() {
  const pendingOrders = await prisma.order.findMany({
    where: { status: "pending", createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
  });

  for (const order of pendingOrders) {
    const result = await verifyDirectCharge(order.reference);
    const existing = await prisma.payment.findUnique({ where: { paychanguRef: order.reference } });
    if (existing || result.status === "pending") continue;

    if (result.status === "success") {
      await prisma.$transaction([
        prisma.order.update({ where: { id: order.id }, data: { status: "confirmed" } }),
        prisma.payment.create({ data: { orderId: order.id, paychanguRef: order.reference, status: "completed" } }),
      ]);
    } else {
      await prisma.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
    }
  }

  return NextResponse.json({ checked: pendingOrders.length });
}
```

This is the piece that's easy to skip when porting a hosted-checkout project over, precisely because hosted checkout never needed it — every payment there eventually forced its way back to you via the redirect. Direct Charge has no equivalent forcing function, so a sweep like this (or a reliable webhook) is not optional, it's the only thing standing between "the customer paid" and "you ever find out."

## Adding a webhook, if it's actually wanted

Still a backup, never the primary mechanism — same reasoning as the hosted-checkout guide, and Paychangu's own webhook docs say the same thing explicitly: don't rely solely on webhooks, and always re-verify before trusting one. The header to check is `Signature`, not a custom `x-paychangu-*` name:

```typescript
// app/api/paychangu/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyDirectCharge } from "@/lib/paychangu-direct";
import { prisma } from "@/lib/db";
import crypto from "crypto";

function verifySignature(payload: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get("signature"); // header names are lowercased by fetch/Next
  const secret = process.env.PAYCHANGU_WEBHOOK_SECRET;

  if (!secret || !verifySignature(payload, signature, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const data = JSON.parse(payload);
  const chargeId = data.charge_id;
  if (!chargeId) return NextResponse.json({ received: true });

  // Never act on data.status directly — re-verify through the API, same as
  // every other path in this guide.
  const result = await verifyDirectCharge(chargeId);

  const existing = await prisma.payment.findUnique({ where: { paychanguRef: chargeId } });
  if (existing) return NextResponse.json({ received: true, alreadyProcessed: true });

  const order = await prisma.order.findUnique({ where: { reference: chargeId } });
  if (!order) return NextResponse.json({ received: true, orderNotFound: true });

  if (result.status === "success") {
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status: "confirmed" } }),
      prisma.payment.create({ data: { orderId: order.id, paychanguRef: chargeId, status: "completed" } }),
    ]);
  }

  return NextResponse.json({ received: true });
}
```

Set the webhook URL and generate the secret from the same place as before: dashboard → Settings → API & Webhooks. Paychangu retries a webhook delivery up to three times, 30 minutes apart, if your endpoint doesn't return a 200 — so a flaky handler isn't necessarily a lost payment, but it is a slow one, which is another reason the polling/sweep path above shouldn't depend on the webhook ever arriving.

## Things that will probably come up

A 400 with `"Session has expired for last transaction. Please try again"` on initiate usually means a `charge_id` was reused, or the customer is retrying too soon after a prior attempt on the same number — generate a fresh `charge_id` per attempt rather than per order. A charge that stays `pending` for a long time is normal on Direct Charge in a way it wasn't on hosted checkout — the customer might have walked away from their phone — which is exactly why the reconciliation sweep exists. Provider-level declines come back as specific strings (`DECLINED`, `TIMED_OUT`, `INSUFFICIENT_FUNDS`, `EXCEEDED_RETRY_LIMIT`, among others) rather than a generic failure, so surface `result.raw` somewhere in logs while debugging — it's more informative than the plain `status` field. And the class of bug that started this — "shows failed but the client got debited" — shouldn't be structurally possible here, since nothing about the outcome is ever rendered from data sitting in a browser; if it somehow still happens, it means something is trusting the *initial* `pending` response from `chargeMobileMoney()` as if it were final, rather than only trusting `verifyDirectCharge()`.

## The UI — MidasCreed's standard checkout screen

This is the piece that's genuinely yours: Paychangu never puts a UI in front of the customer for Direct Charge, so whatever the customer sees is entirely your design, on every client project you plug this into. Worth building once, well, and reusing — which is what this section is for.

**Design plan**

- **Color** — `#0E1729` (base background, deep navy rather than pure black — pulled from the crown mark's blue), `#16223B` (card surface), `#2C3E63` (hairline borders), `#5B7FC7` (steel blue — the one accent color, matching the crown's body), `#8FA6D6` (lighter blue, reserved for the amount and active states, echoing the crown's inner facets), `#F4F6FB` (primary text, cool white to match the mark rather than a warm off-white).
- **Type** — Fraunces (a serif with some warmth and weight) for the amount and status headings, the two moments meant to carry personality — deliberately not another geometric sans, so the page doesn't read as a generic tech dashboard despite the blue palette; Inter for every label, input, and button, because a payment form is a trust object and the parts people have to read carefully should be as plain and legible as possible.
- **Layout** — a single centered card, one column, generous internal padding, with a soft radial glow behind it as the only ambient decoration, plus a thin dotted rule (a quiet nod to the crown's circuit-line detailing) in place of a plain divider. No sidebar, no logo lockup competing with the amount for attention.
```
        (soft radial glow, barely visible)
        ┌─────────────────────────────┐
        │        MWK 12,500            │  ← serif, light blue, the hero
        │   Glow Facial — Booking #4821│
        │   ·  ·  ·  ·  ·  ·  ·  ·  ·  │  ← dotted "circuit" rule
        │   [ state-dependent content ]│
        │   [        Pay button       ]│
        └─────────────────────────────┘
       [crown mark]  Secured by MidasCreed · Powered by Paychangu
```
- **Principles** — one bold moment (the amount, in light-blue serif) and everything else quiet; one deliberate animation (a pulsing ring while waiting on the phone prompt, resolving into a drawn checkmark on success); the dotted divider is the only place the crown's circuit motif shows up elsewhere on the page, so it reads as a deliberate echo rather than decoration repeated everywhere; the Paychangu credit stays small and honest at the very bottom, never competing with the MidasCreed identity above it.

**The component**

```css
/* components/paychangu/checkout.module.css */
.wrap {
  --mc-bg: #0e1729;
  --mc-surface: #16223b;
  --mc-surface-raised: #1d2c4a;
  --mc-border: #2c3e63;
  --mc-accent: #5b7fc7;
  --mc-accent-bright: #8fa6d6;
  --mc-text: #f4f6fb;
  --mc-text-muted: #8c97b8;
  --mc-success: #5b9c6f;
  --mc-error: #c1573b;

  font-family: var(--mc-font-body), sans-serif;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 2rem 1.25rem;
  background: var(--mc-bg);
  color: var(--mc-text);
  position: relative;
  overflow: hidden;
}

.glow {
  position: absolute;
  top: 18%;
  width: 480px;
  height: 480px;
  background: radial-gradient(circle, rgba(91, 127, 199, 0.18), transparent 70%);
  pointer-events: none;
}

.card {
  width: 100%;
  max-width: 400px;
  background: var(--mc-surface);
  border: 1px solid var(--mc-border);
  border-radius: 20px;
  padding: 2.25rem 1.75rem;
  box-shadow: 0 24px 60px -24px rgba(0, 0, 0, 0.6);
  position: relative;
}

.amountBlock { text-align: center; }

.amount {
  font-family: var(--mc-font-display), serif;
  font-size: 2.25rem;
  font-weight: 600;
  color: var(--mc-accent-bright);
  margin: 0;
  letter-spacing: -0.01em;
}

.label {
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
  color: var(--mc-text-muted);
}

/* A dotted rule rather than a plain gradient line — a quiet nod to the
   circuit-line detailing on the MidasCreed mark. */
.divider {
  height: 1px;
  margin: 1.5rem 0;
  background-image: linear-gradient(to right, var(--mc-border) 33%, transparent 0%);
  background-position: top;
  background-size: 6px 1px;
  background-repeat: repeat-x;
}

.stepLabel {
  font-size: 0.85rem;
  color: var(--mc-text-muted);
  margin: 0 0 0.75rem;
}

.operatorRow {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.operatorPill {
  flex: 1;
  padding: 0.65rem 0.5rem;
  border-radius: 10px;
  border: 1px solid var(--mc-border);
  background: var(--mc-surface-raised);
  color: var(--mc-text);
  font-size: 0.85rem;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.operatorPill:hover { border-color: var(--mc-accent); }

.operatorPillActive {
  border-color: var(--mc-accent);
  background: rgba(91, 127, 199, 0.14);
  color: var(--mc-accent-bright);
}

.fieldLabel {
  display: block;
  font-size: 0.8rem;
  color: var(--mc-text-muted);
  margin-bottom: 0.4rem;
}

.input {
  width: 100%;
  padding: 0.75rem 0.9rem;
  border-radius: 10px;
  border: 1px solid var(--mc-border);
  background: var(--mc-surface-raised);
  color: var(--mc-text);
  font-size: 1rem;
  font-family: inherit;
  margin-bottom: 1.25rem;
  box-sizing: border-box;
}

.input:focus-visible {
  outline: 2px solid var(--mc-accent);
  outline-offset: 1px;
}

.error {
  color: var(--mc-error);
  font-size: 0.85rem;
  margin: -0.75rem 0 1rem;
}

.payButton {
  width: 100%;
  padding: 0.85rem;
  border-radius: 10px;
  border: none;
  background: var(--mc-accent);
  color: #0e1729;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.payButton:hover:not(:disabled) { background: var(--mc-accent-bright); }
.payButton:disabled { opacity: 0.45; cursor: not-allowed; }

.statusArea { text-align: center; padding: 1rem 0 0.5rem; }

.statusHeading {
  font-family: var(--mc-font-display), serif;
  font-size: 1.25rem;
  margin: 0 0 0.4rem;
}

.statusBody { font-size: 0.9rem; color: var(--mc-text-muted); margin: 0; }

.pulseRing {
  width: 56px;
  height: 56px;
  margin: 0 auto 1.25rem;
  border-radius: 50%;
  border: 2px solid var(--mc-accent);
  animation: mc-pulse 1.8s ease-out infinite;
}

@keyframes mc-pulse {
  0% { box-shadow: 0 0 0 0 rgba(91, 127, 199, 0.4); }
  100% { box-shadow: 0 0 0 18px rgba(91, 127, 199, 0); }
}

.checkMark { width: 56px; height: 56px; margin: 0 auto 1.25rem; }

.checkMark svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: var(--mc-success);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 40;
  stroke-dashoffset: 40;
  animation: mc-draw 0.5s ease forwards 0.1s;
}

@keyframes mc-draw { to { stroke-dashoffset: 0; } }

.retryButton {
  margin-top: 0.5rem;
  padding: 0.6rem 1.25rem;
  border-radius: 10px;
  border: 1px solid var(--mc-border);
  background: transparent;
  color: var(--mc-text);
  font-family: inherit;
  cursor: pointer;
}

.footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--mc-text-muted);
  letter-spacing: 0.01em;
}
.footerMark { width: 18px; height: 18px; object-fit: contain; }
.footerDot { margin: 0 0.35rem; }

@media (prefers-reduced-motion: reduce) {
  .pulseRing, .checkMark svg { animation: none; }
}
```

```tsx
// components/paychangu/checkout.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Fraunces, Inter } from "next/font/google";
import styles from "./checkout.module.css";

const display = Fraunces({ subsets: ["latin"], weight: ["600"], variable: "--mc-font-display" });
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--mc-font-body" });

type Operator = { name: string; ref_id: string; short_code: string };
type ChargeState = "form" | "pending" | "success" | "failed";

export interface PaychanguCheckoutProps {
  amount: number;
  currency?: string;
  label: string; // e.g. "Glow Facial — Booking #4821"
  initiateUrl: string; // your charge-initiate route, from the earlier section
  statusUrlBase: string; // e.g. "/api/paychangu/direct-charge" — chargeId + "/status" is appended
  onSuccess?: () => void;
}

export function PaychanguCheckout({
  amount, currency = "MWK", label, initiateUrl, statusUrlBase, onSuccess,
}: PaychanguCheckoutProps) {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
  const [mobile, setMobile] = useState("");
  const [state, setState] = useState<ChargeState>("form");
  const [chargeId, setChargeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/paychangu/operators")
      .then((res) => res.json())
      .then((data) => setOperators(data.operators ?? []));
  }, []);

  const handlePay = useCallback(async () => {
    if (!selectedOperator || !mobile) return;
    setError(null);
    setState("pending");
    try {
      const res = await fetch(initiateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, mobileMoneyOperatorRefId: selectedOperator, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Could not start the payment.");
      setChargeId(data.chargeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setState("form");
    }
  }, [selectedOperator, mobile, initiateUrl, amount]);

  useEffect(() => {
    if (state !== "pending" || !chargeId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`${statusUrlBase}/${chargeId}/status`);
      const data = await res.json();
      if (data.status === "success") { setState("success"); onSuccess?.(); }
      else if (data.status === "failed") setState("failed");
    }, 4000);
    return () => clearInterval(interval);
  }, [state, chargeId, statusUrlBase, onSuccess]);

  return (
    <div className={`${styles.wrap} ${display.variable} ${body.variable}`}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.card}>
        <div className={styles.amountBlock}>
          <p className={styles.amount}>{currency} {amount.toLocaleString()}</p>
          <p className={styles.label}>{label}</p>
        </div>
        <div className={styles.divider} />

        {state === "form" && (
          <div>
            <p className={styles.stepLabel}>Choose your mobile money provider</p>
            <div className={styles.operatorRow}>
              {operators.map((op) => (
                <button
                  key={op.ref_id}
                  type="button"
                  className={`${styles.operatorPill} ${selectedOperator === op.ref_id ? styles.operatorPillActive : ""}`}
                  onClick={() => setSelectedOperator(op.ref_id)}
                >
                  {op.name}
                </button>
              ))}
            </div>
            <label className={styles.fieldLabel} htmlFor="mc-mobile">Mobile number</label>
            <input
              id="mc-mobile"
              className={styles.input}
              type="tel"
              inputMode="tel"
              placeholder="0991 234 567"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
            {error && <p className={styles.error}>{error}</p>}
            <button
              type="button"
              className={styles.payButton}
              disabled={!selectedOperator || !mobile}
              onClick={handlePay}
            >
              Pay {currency} {amount.toLocaleString()}
            </button>
          </div>
        )}

        {state === "pending" && (
          <div className={styles.statusArea}>
            <div className={styles.pulseRing} aria-hidden="true" />
            <p className={styles.statusHeading}>Check your phone</p>
            <p className={styles.statusBody}>Approve the payment prompt sent to {mobile}.</p>
          </div>
        )}

        {state === "success" && (
          <div className={styles.statusArea}>
            <div className={styles.checkMark} aria-hidden="true">
              <svg viewBox="0 0 52 52"><path d="M14 27l8 8 16-16" /></svg>
            </div>
            <p className={styles.statusHeading}>Payment received</p>
            <p className={styles.statusBody}>Thank you — your order is confirmed.</p>
          </div>
        )}

        {state === "failed" && (
          <div className={styles.statusArea}>
            <p className={styles.statusHeading}>Payment didn't go through</p>
            <p className={styles.statusBody}>No amount was charged. You can try again below.</p>
            <button type="button" className={styles.retryButton} onClick={() => setState("form")}>
              Try again
            </button>
          </div>
        )}
      </div>

      <p className={styles.footer}>
        <img src="/midascreed-mark.png" alt="" className={styles.footerMark} />
        Secured by MidasCreed <span className={styles.footerDot}>·</span> Powered by Paychangu
      </p>
    </div>
  );
}
```

It needs one more small route so the browser can list operators without ever touching the secret key:

```typescript
// app/api/paychangu/operators/route.ts
import { NextResponse } from "next/server";
import { getMobileMoneyOperators } from "@/lib/paychangu-direct";

export async function GET() {
  const operators = await getMobileMoneyOperators();
  // Only forward what the UI needs — never the raw Paychangu response.
  return NextResponse.json({
    operators: operators.map((op) => ({ name: op.name, ref_id: op.ref_id, short_code: op.short_code })),
  });
}
```

**Reusing this across client projects**

Drop `checkout.tsx` and `checkout.module.css` into any Next.js client project alongside `lib/paychangu-direct.ts` and the routes from earlier sections — the only project-specific pieces are the `amount`, `label`, and the two URL props, all passed in from wherever you render `<PaychanguCheckout />` (a booking confirmation step, a cart, wherever). The visual identity — colors, type, the MidasCreed/Paychangu footer — stays fixed on purpose: it's what makes a client recognize "this is the payment screen MidasCreed builds" across every site you ship, the same way seeing a Stripe checkout tells you Stripe is behind it regardless of whose store you're in.

If a client project isn't Next.js, the CSS module and its variables port over as-is to plain CSS or another framework's component model — only the `next/font` import and the two fetch calls need adapting to that project's conventions.

Drop the transparent-background crown mark into each project's `public/` folder as `midascreed-mark.png` (or update the `src` in the footer to wherever it lives) — it's rendered at a small, quiet size next to the text, the same way a card network's logo sits next to "secured checkout" text elsewhere, rather than as a header lockup competing with the amount.

**Where this guide's scope ends**

Every client site does something different around the payment — fixed prices vs. user-entered amounts, tickets to download, confirmation emails, feedback prompts, whatever comes next. None of that belongs in this guide, and it's worth keeping it that way on purpose. The component only has three points of contact with client-specific logic: the `amount` you pass in (computed however that client's pricing works, before the component ever sees it), the `label`, and the `onSuccess` callback (or, in the DB-backed tier, whatever reads the `Payment` row as `completed`). Everything downstream of `onSuccess` — ticket generation, emails, redirects, review prompts — is that client's own application logic, not part of this integration. If a client's specific fulfillment needs ever require editing `checkout.tsx` or `lib/paychangu-direct.ts` itself, that's a sign something client-specific has leaked into what's supposed to stay a generic, reusable piece.

## Getting a new project to this point

Add `PAYCHANGU_SECRET_KEY` and `PAYCHANGU_WEBHOOK_SECRET`, add `lib/paychangu-direct.ts`, then either the demo-tier charge + status routes and the polling component, or the Prisma models plus the persisting status route and the reconciliation sweep if a real database is already in play. Drop in the `checkout.tsx` / `checkout.module.css` pair and the `/api/paychangu/operators` route for the UI, wiring `initiateUrl` and `statusUrlBase` to whichever routes this project uses. Test against a sandbox key and small real mobile money amounts before trusting this with live traffic — Direct Charge's failure modes (declines, timeouts, abandoned prompts) are different from hosted checkout's, so it's worth deliberately triggering a few of them (cancel the USSD prompt, let it time out) rather than only testing the happy path.

Card and Bank Transfer are also available as Direct Charge options (`POST /direct-charge/card` and the bank transfer endpoints), each with their own authorization step in place of the mobile money PIN prompt — same initiate → authorize → verify shape, worth a separate pass if cards end up needed too.
