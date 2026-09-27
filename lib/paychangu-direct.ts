const PAYCHANGU_BASE_URL = "https://api.paychangu.com"

export type MobileMoneyOperator = {
  name: string
  ref_id: string
  short_code: string
}

function getSecretKey(): string {
  const key = process.env.PAYCHANGU_SECRET_KEY
  if (!key) throw new Error("PAYCHANGU_SECRET_KEY is not set.")
  return key
}

let operatorsCache: MobileMoneyOperator[] | null = null

export async function getMobileMoneyOperators(): Promise<MobileMoneyOperator[]> {
  if (operatorsCache) return operatorsCache
  const res = await fetch(`${PAYCHANGU_BASE_URL}/mobile-money`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${getSecretKey()}` },
    cache: "no-store",
  })
  const body = await res.json()
  if (!res.ok || body.status !== "success" || !Array.isArray(body.data)) {
    throw new Error(body.message || "PayChangu operator lookup failed.")
  }
  operatorsCache = body.data as MobileMoneyOperator[]
  return operatorsCache
}

export async function operatorRefId(kind: "tnm" | "airtel"): Promise<string> {
  const operators = await getMobileMoneyOperators()
  const match = operators.find((operator) => {
    const haystack = `${operator.name} ${operator.short_code}`.toLowerCase()
    return kind === "tnm"
      ? haystack.includes("tnm") || haystack.includes("mpamba")
      : haystack.includes("airtel")
  })
  if (!match?.ref_id) {
    throw new Error("That mobile money operator is not available.")
  }
  return match.ref_id
}

export async function chargeMobileMoney(params: {
  mobile: string
  mobileMoneyOperatorRefId: string
  amount: number
  chargeId: string
  email?: string
  firstName?: string
  lastName?: string
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
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.status !== "success") {
    throw new Error(body.message || "PayChangu could not start the payment.")
  }
  return {
    chargeId: (body.data?.charge_id as string) || params.chargeId,
    initialStatus: (body.data?.status as string) || "pending",
    message: (body.message as string) || "",
  }
}

export type VerifyDirectChargeResult = {
  status: string
  chargeId: string
  amount: number
  currency: string
  mode: string
  completedAt: string | null
  raw: unknown
}

export async function verifyDirectCharge(chargeId: string): Promise<VerifyDirectChargeResult> {
  const res = await fetch(
    `${PAYCHANGU_BASE_URL}/mobile-money/payments/${encodeURIComponent(chargeId)}/verify`,
    {
      headers: { Accept: "application/json", Authorization: `Bearer ${getSecretKey()}` },
      cache: "no-store",
    },
  )
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(body.message || "PayChangu verify failed.") as Error & { status?: number }
    error.status = res.status
    throw error
  }
  return {
    status: String(body.data?.status ?? "pending"),
    chargeId: String(body.data?.charge_id ?? chargeId),
    amount: Number(body.data?.amount),
    currency: String(body.data?.currency ?? ""),
    mode: String(body.data?.mode ?? ""),
    completedAt: body.data?.completed_at ?? null,
    raw: body.data,
  }
}
