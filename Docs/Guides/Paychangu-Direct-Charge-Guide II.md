# Paychangu Direct Charge Guide (Mobile Money)

How to collect Airtel Money or TNM Mpamba on your own site. The customer never visits a Paychangu page. There is no checkout URL, no redirect, and no shared payment screen in this guide. Each site draws its own "check your phone" page. This document is the server rules those pages call.

The deposit amount being fixed in your code does not make Paychangu's verify reply identical every time. The customer does not type the amount. Your server still has to read the reply correctly.

## The one idea worth understanding before writing any code

With hosted checkout, Paychangu takes the money and then redirects the browser back to you. That redirect can fail after the debit has already succeeded.

Direct Charge has no redirect. The flow is:

1. Your server saves a pending order and a `charge_id` you generate.
2. Your server calls `POST /mobile-money/payments/initialize`. The customer's phone, not their browser, gets the PIN prompt.
3. You learn the outcome only by calling `GET /mobile-money/payments/{chargeId}/verify`, or from a webhook that then calls that same verify before it changes anything.

The page can still tell the customer the wrong thing. A timer, a cancelled row, or a currency check can say "no deposit was taken" after Paychangu has collected the money. Saying that is allowed only when verify's payment status is in the failed list below.

## Which verify document to follow

Paychangu publishes two different verify calls.

Hosted checkout is `GET /verify-payment/{tx_ref}`, documented at [Transaction verification](https://developer.paychangu.com/docs/transaction-verification). That sample is a card payment. Its `data.currency` is `MWK`. Its outer `"status": "success"` means the lookup worked ("Payment details retrieved successfully"), not that the customer paid. The reference for that endpoint excludes mobile-money Direct Charge. Do not use it here.

Direct Charge is `GET /mobile-money/payments/{chargeId}/verify`, documented at [Charge verification](https://developer.paychangu.com/docs/charge-verification). That is the call in this guide. A completed sample looks like this:

- Outer `status` is `successful`. That is the API envelope.
- `data.status` is `success`. That is the payment. Read this field.
- `data.currency` is `MK`, not `MWK`.
- `data.amount` is the number you charged.
- `data.charge_id` is the id you generated.
- `data.ref_id` is Paychangu's own number, the one that shows up in their email. Do not verify with `ref_id`. Verify with `charge_id`.

`MK` and `MWK` are the same kwacha. A check that allows only `MWK` cancels a normal Direct Charge success. Ignore the currency text.

## Environment variables

```env
PAYCHANGU_SECRET_KEY=
PAYCHANGU_WEBHOOK_SECRET=
```

You do not need `PAYCHANGU_PUBLIC_KEY` or a return URL for this flow. Keep them only if some other part of the project still uses hosted checkout.

The webhook signature header is `Signature`, not `x-paychangu-signature`.

## The shared file

Put the Paychangu calls and the one settlement decision in `lib/paychangu-direct.ts`. The status route, the webhook, and the reconcile job all call `settleDirectCharge`. They do not each invent their own comparison to the word `"success"`.

```typescript
const PAYCHANGU_BASE_URL = "https://api.paychangu.com";

function getSecretKey(): string {
  const key = process.env.PAYCHANGU_SECRET_KEY;
  if (!key) throw new Error("PAYCHANGU_SECRET_KEY is not set.");
  return key;
}

export async function getMobileMoneyOperators() {
  const res = await fetch(`${PAYCHANGU_BASE_URL}/mobile-money`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${getSecretKey()}` },
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok || body.status !== "success" || !Array.isArray(body.data)) {
    throw new Error("Paychangu operator lookup failed.");
  }
  return body.data as Array<{ name: string; ref_id: string; short_code: string }>;
}

export async function chargeMobileMoney(params: {
  mobile: string;
  mobileMoneyOperatorRefId: string;
  amount: number;
  chargeId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}) {
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
      amount: String(params.amount),
      charge_id: params.chargeId,
      email: params.email,
      first_name: params.firstName,
      last_name: params.lastName,
    }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.status !== "success") {
    throw new Error("Paychangu could not start the payment.");
  }
  // data.status here is almost always "pending". The prompt was sent. The customer has not paid yet.
  return {
    chargeId: (body.data?.charge_id as string) || params.chargeId,
    initialStatus: (body.data?.status as string) || "pending",
  };
}

export type ChargeOutcome = "success" | "failed" | "pending" | "review";

export function classifyChargeStatus(status: string): "success" | "failed" | "pending" {
  const value = status.trim().toLowerCase();
  if (value === "success" || value === "paid" || value === "completed") return "success";
  if (
    value === "failed" ||
    value === "failure" ||
    value === "declined" ||
    value === "timed_out" ||
    value === "insufficient_funds" ||
    value === "exceeded_retry_limit" ||
    value === "cancelled" ||
    value === "canceled" ||
    value === "expired"
  ) {
    return "failed";
  }
  // pending, processing, successful, an empty string, or any word you do not recognise
  return "pending";
}

export function amountMatches(amount: unknown, expected: number): boolean {
  const rounded = Math.round(Number(amount));
  return Number.isFinite(rounded) && rounded === expected;
}

export async function verifyDirectCharge(chargeId: string) {
  const res = await fetch(
    `${PAYCHANGU_BASE_URL}/mobile-money/payments/${encodeURIComponent(chargeId)}/verify`,
    {
      headers: { Accept: "application/json", Authorization: `Bearer ${getSecretKey()}` },
      cache: "no-store",
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error("Paychangu verify failed.") as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  // Always data.status. Never the outer status.
  return {
    status: String(body.data?.status ?? "pending"),
    chargeId: String(body.data?.charge_id ?? chargeId),
    amount: body.data?.amount,
    currency: String(body.data?.currency ?? ""),
    raw: body.data,
  };
}
```

`classifyChargeStatus("successful")` stays pending on purpose. Paychangu uses `successful` on the outer envelope and `success` on `data.status`. If you treat the outer word as a paid charge, you will confirm a lookup that has not finished. `paid` and `completed` are accepted so a real paid charge is not thrown away when the inner word is not spelled `success`.

## Save the charge, then send the PIN prompt

Generate the charge id, store the pending order, and return that id to the browser before you call initialize. The waiting page polls verify for that id even when initialize never returns.

A thrown initialize, an HTTP 4xx, or an HTTP 200 whose envelope is not `success` does not cancel the order. The usual phone failure is `TypeError: Load failed` after Paychangu has already shown the PIN. A 400 such as "Session has expired for last transaction" means you reused a charge id or retried too soon. Start a new charge id only after verify for the old one has returned a failed status.

```typescript
// app/api/paychangu/direct-charge/route.ts
// 1. POST { action: "create" } writes the pending order and returns chargeId.
// 2. POST { action: "initialize", chargeId } calls chargeMobileMoney.
//    On any throw, respond 202 with { chargeId, status: "pending" }.
//    Do not delete the order.
```

The browser shows "Check your phone" as soon as it has the charge id, then polls:

```typescript
// app/api/paychangu/direct-charge/[chargeId]/status/route.ts
// Calls settleDirectCharge and returns { status: "pending" | "success" | "failed" | "review" }.
```

Poll about every 4 seconds. Keep polling on `pending` and on `review`. `failed` is the only result that may show "no deposit was taken" and offer another payment. `review` means the amount did not match: leave the customer on the page and do not start a second charge.

There is no checkout component to copy. The waiting screen belongs to that site.

## Once there is a real database

A pending charge outlives the tab. The customer can approve the PIN after the page is gone. Store the charge id on the order. One settle function is what the poll, the webhook, and the cron all run.

```prisma
model Order {
  id        String   @id @default(uuid()) @db.Uuid
  reference String   @unique // the charge_id you generated
  status    String   @default("pending") // pending | confirmed | cancelled | review
  amount    Int
  createdAt DateTime @default(now()) @map("created_at")

  @@map("orders")
}
```

```typescript
import { amountMatches, classifyChargeStatus, verifyDirectCharge } from "@/lib/paychangu-direct";
import { prisma } from "@/lib/db";

export async function settleDirectCharge(chargeId: string, expectedAmount: number) {
  const order = await prisma.order.findUnique({ where: { reference: chargeId } });
  if (!order) return { status: "pending" as const };
  if (order.status === "confirmed") return { status: "success" as const };

  let verified;
  try {
    verified = await verifyDirectCharge(chargeId);
  } catch {
    // Network error or HTTP 404. The charge may not exist yet. Leave the order pending.
    return { status: "pending" as const };
  }

  const outcome = classifyChargeStatus(verified.status);
  if (outcome === "pending") return { status: "pending" as const };

  if (outcome === "failed") {
    await prisma.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
    return { status: "failed" as const };
  }

  if (!amountMatches(verified.amount, expectedAmount)) {
    // Paid, but the number is not the deposit you charged. Do not cancel. Do not say the deposit was not taken.
    await prisma.order.update({ where: { id: order.id }, data: { status: "review" } });
    console.error("Direct charge amount needs a manual check", { chargeId, raw: verified.raw });
    return { status: "review" as const };
  }

  // Confirm even when this order was already cancelled by an older bug.
  // Currency is intentionally ignored. MK and MWK are both valid.
  await prisma.order.update({ where: { id: order.id }, data: { status: "confirmed" } });
  return { status: "success" as const };
}
```

If confirming would give away a slot that a later booking already took, still record this payment and flag the order for a person to fix. Do not leave the money unrecorded, and do not start a new PIN prompt for it.

A reconcile job calls that same function for every order that is not `confirmed` and still has a charge id, including orders already marked `cancelled` or `review`. Age is not a reason to cancel. A verify result of `pending` keeps the hold.

```typescript
// app/api/cron/reconcile-charges/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { settleDirectCharge } from "@/lib/settle-direct-charge";

export async function GET() {
  const orders = await prisma.order.findMany({
    where: { status: { not: "confirmed" } },
  });
  for (const order of orders) {
    await settleDirectCharge(order.reference, order.amount);
  }
  return NextResponse.json({ checked: orders.length });
}
```

## Webhook

The webhook is a backup for the customer who leaves the page. It is not the thing that confirms someone who stays and gets polled. It re-verifies, then calls `settleDirectCharge`. It does not trust the status inside the webhook body.

Paychangu retries a delivery that does not return 200, up to three times, 30 minutes apart. A 200 with no charge id is how a paid booking gets dropped, so a body with no id returns 400.

```typescript
// app/api/paychangu/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { settleDirectCharge } from "@/lib/settle-direct-charge";

function signaturesMatch(payload: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const received = signature.trim().replace(/^sha256=/i, "").toLowerCase();
  const expected = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received, "utf8"), Buffer.from(expected, "utf8"));
}

function chargeIdFrom(body: Record<string, unknown>): string | null {
  const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {};
  const candidates = [body.charge_id, body.tx_ref, body.reference, data.charge_id, data.tx_ref, data.reference];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.PAYCHANGU_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret is not configured." }, { status: 401 });

  const payload = await req.text();
  if (!signaturesMatch(payload, req.headers.get("signature"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = payload ? JSON.parse(payload) : {};
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const chargeId = chargeIdFrom(body);
  if (!chargeId) return NextResponse.json({ error: "missing charge id" }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { reference: chargeId } });
  if (!order) return NextResponse.json({ received: true, orderNotFound: true });

  const settled = await settleDirectCharge(chargeId, order.amount);
  return NextResponse.json({ received: true, status: settled.status });
}
```

Set the URL and the secret in the Paychangu dashboard under Settings → API & Webhooks. The dashboard secret has to equal `PAYCHANGU_WEBHOOK_SECRET`.

## Rules that keep a paid charge from being cancelled

- Read `data.status`. Compare it with `classifyChargeStatus`. Do not cancel because the word is not exactly `success`.
- Ignore currency. `MK` is a successful Direct Charge, not a failed one.
- Match the amount with `Math.round(Number(amount))`. The string `"10000"` and the number `10000` are the same deposit. A mismatch sets `review` and keeps the hold.
- Release a slot, cancel an order, or show "no deposit was taken" only when the outcome is `failed`.
- A 15-minute job, a "Cancel payment" button, and an initialize error do not cancel while verify is `pending`.
- A later `success` confirms an order that an older mistake already cancelled, as long as the amount matches.
- Do not start a second charge while this charge id is `pending` or `review`.
- The number in the Paychangu email is `ref_id`. The id stored on the order is the charge id you generated.

A 400 on initialize that says the session expired is a reused charge id or a retry that was too soon. Provider declines inside verify use words such as `DECLINED`, `TIMED_OUT`, `INSUFFICIENT_FUNDS`, and `EXCEEDED_RETRY_LIMIT`. Log `raw` while debugging. Those words are in the failed list, so they cancel. `processing` is not in that list, so it waits.

## Getting a new project to this point

Add `PAYCHANGU_SECRET_KEY` and `PAYCHANGU_WEBHOOK_SECRET`. Add `lib/paychangu-direct.ts` and `settleDirectCharge`. Create the pending order and the charge id before initialize. Poll settle from the site's own waiting page. Schedule the reconcile job. Point the Paychangu webhook at the route above.

Test with a small live mobile-money amount. Approve a PIN, reject a PIN, let the prompt time out, and kill the initialize request on a phone after the prompt appears. The killed request must leave the page polling, and the approved PIN must still confirm.

Card and bank transfer use other Direct Charge endpoints. They are a separate pass. They are not a reason to bring hosted checkout back.
