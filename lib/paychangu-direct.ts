import { randomInt } from "crypto"

const BASE_URL = "https://api.paychangu.com"

export type Method = "airtel_money" | "tnm_mpamba" | "bank_transfer"
export const isBank = (method: Method) => method === "bank_transfer"
export const holdMinutes = (method: Method) => (isBank(method) ? 10 : 5)
export const TRACK_HOURS = 24

const CHARGE_PREFIX: Record<Method, string> = {
  airtel_money: "airtel",
  tnm_mpamba: "tnm",
  bank_transfer: "bank",
}

type ApiResponse = { http: number; body: unknown }

async function call(path: string, init: { method?: string; json?: unknown } = {}): Promise<ApiResponse> {
  const key = process.env.PAYCHANGU_SECRET_KEY
  if (!key) throw new Error("PAYCHANGU_SECRET_KEY is not set")
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(BASE_URL + path, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: init.json ? JSON.stringify(init.json) : undefined,
      signal: controller.signal,
      cache: "no-store",
    })
    const body = await res.json().catch(() => null)
    return { http: res.status, body }
  } catch {
    return { http: 0, body: null }
  } finally {
    clearTimeout(timer)
  }
}

export type ErrorKind = "auth" | "rate_limited" | "server" | "network" | "not_found" | "rejected"

function errorKind(http: number): ErrorKind {
  if (http === 0) return "network"
  if (http === 401 || http === 403) return "auth"
  if (http === 404) return "not_found"
  if (http === 429) return "rate_limited"
  if (http >= 500) return "server"
  return "rejected"
}

function bodyRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {}
}

/** Paychangu sometimes returns `message` as an object. For logs, never for customers. */
export function paychanguText(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (Array.isArray(value)) return value.map(paychanguText).filter(Boolean).join(" ")
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return paychanguText(record.message) || paychanguText(record.error) || paychanguText(record.detail) || JSON.stringify(value)
  }
  return ""
}

function flatten(message: unknown): string {
  return paychanguText(message)
}

export async function checkSecretKey(): Promise<"ok" | "bad_key" | "unreachable"> {
  const result = await call("/mobile-money/payments/key-check-0000/verify")
  if (result.http === 404) return "ok"
  if (result.http === 401 || result.http === 403) return "bad_key"
  return "unreachable"
}

export interface Operator {
  name: string
  ref_id: string
  short_code: string
}

let operatorCache: { at: number; list: Operator[] } | null = null

function operatorMatches(operator: Operator, kind: "airtel" | "tnm") {
  if (operator.short_code === kind) return true
  const haystack = `${operator.name} ${operator.short_code}`.toLowerCase()
  return kind === "tnm"
    ? haystack.includes("tnm") || haystack.includes("mpamba")
    : haystack.includes("airtel")
}

export async function getOperatorRefId(kind: "airtel" | "tnm"): Promise<string | null> {
  if (!operatorCache || Date.now() - operatorCache.at > 6 * 3_600_000) {
    const result = await call("/mobile-money")
    const data = bodyRecord(result.body).data
    if (result.http === 200 && Array.isArray(data)) {
      operatorCache = { at: Date.now(), list: data as Operator[] }
    }
  }
  return operatorCache?.list.find((operator) => operatorMatches(operator, kind))?.ref_id ?? null
}

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"
export function newChargeId(method: Method): string {
  let suffix = ""
  for (let i = 0; i < 10; i++) suffix += ALPHABET[randomInt(ALPHABET.length)]
  return `${CHARGE_PREFIX[method]}-${suffix}`
}

export type InitiateOutcome =
  | {
      outcome: "accepted"
      refId: string | null
      traceId: string | null
      account?: { bank: string; name: string; number: string }
    }
  | { outcome: "rejected" | "auth" | "rate_limited" | "unknown"; message: string }

function initiateFailure(result: ApiResponse): InitiateOutcome {
  const kind = errorKind(result.http)
  const message = flatten(bodyRecord(result.body).message) || `HTTP ${result.http}`
  if (kind === "auth") return { outcome: "auth", message }
  if (kind === "rate_limited") return { outcome: "rate_limited", message }
  if (kind === "network" || kind === "server") return { outcome: "unknown", message }
  return { outcome: "rejected", message }
}

interface Customer {
  email?: string
  firstName?: string
  lastName?: string
}

export async function initiateMobileMoney(params: Customer & {
  chargeId: string
  mobileLocal: string
  operatorRefId: string
  amount: number
}): Promise<InitiateOutcome> {
  const result = await call("/mobile-money/payments/initialize", {
    method: "POST",
    json: {
      mobile: params.mobileLocal,
      mobile_money_operator_ref_id: params.operatorRefId,
      amount: String(params.amount),
      charge_id: params.chargeId,
      email: params.email,
      first_name: params.firstName,
      last_name: params.lastName,
    },
  })
  const data = bodyRecord(bodyRecord(result.body).data)
  if (result.http === 200 && data.charge_id) {
    return {
      outcome: "accepted",
      refId: typeof data.ref_id === "string" ? data.ref_id : null,
      traceId: typeof data.trace_id === "string" ? data.trace_id : null,
    }
  }
  return initiateFailure(result)
}

export async function initiateBankTransfer(params: Customer & {
  chargeId: string
  amount: number
}): Promise<InitiateOutcome> {
  const result = await call("/direct-charge/payments/initialize", {
    method: "POST",
    json: {
      amount: String(params.amount),
      currency: "MWK",
      payment_method: "mobile_bank_transfer",
      charge_id: params.chargeId,
      create_permanent_account: false,
      email: params.email,
      first_name: params.firstName,
      last_name: params.lastName,
    },
  })
  const data = bodyRecord(bodyRecord(result.body).data)
  const transaction = bodyRecord(data.transaction)
  const account = bodyRecord(data.payment_account_details)
  if (result.http === 200 && transaction && typeof account.account_number === "string" && account.account_number) {
    return {
      outcome: "accepted",
      refId: typeof transaction.ref_id === "string" ? transaction.ref_id : null,
      traceId: typeof transaction.trace_id === "string" ? transaction.trace_id : null,
      account: {
        bank: String(account.bank_name ?? ""),
        name: String(account.account_name ?? ""),
        number: String(account.account_number),
      },
    }
  }
  return initiateFailure(result)
}

export type ChargeState = "success" | "failed" | "pending" | "unknown"

export type StatusResult =
  | {
      ok: true
      state: ChargeState
      amount: number | null
      completedAt: string | null
      lastLog: string | null
      lastLogAt: string | null
      receipt: string | null
      raw: unknown
    }
  | { ok: false; http: number; kind: ErrorKind; message: string }

const FAILED = new Set(["failed", "declined", "timed_out", "cancelled", "expired", "insufficient_funds"])

function classify(status: unknown): ChargeState {
  const value = String(status ?? "").toLowerCase()
  if (value === "success") return "success"
  if (value === "pending") return "pending"
  return FAILED.has(value) ? "failed" : "unknown"
}

export async function getChargeStatus(method: Method, chargeId: string): Promise<StatusResult> {
  const id = encodeURIComponent(chargeId)
  const result = await call(
    isBank(method)
      ? `/direct-charge/transactions/${id}/details`
      : `/mobile-money/payments/${id}/verify`,
  )
  const data = bodyRecord(result.body).data
  const transaction = isBank(method) ? bodyRecord(bodyRecord(data).transaction) : bodyRecord(data)

  if (result.http !== 200 || !data || (isBank(method) && !bodyRecord(data).transaction)) {
    return {
      ok: false,
      http: result.http,
      kind: errorKind(result.http),
      message: flatten(bodyRecord(result.body).message),
    }
  }

  const logs = Array.isArray(transaction.logs) ? transaction.logs : []
  const last = logs.length ? bodyRecord(logs[logs.length - 1]) : {}
  const authorization = bodyRecord(transaction.authorization)
  const receipt = authorization.mobile_money_trans_id ?? authorization.payer_bank_receipt_number ?? null
  const amount = transaction.amount != null ? Number(transaction.amount) : null

  return {
    ok: true,
    state: classify(transaction.status),
    amount: amount != null && Number.isFinite(amount) ? amount : null,
    completedAt: typeof transaction.completed_at === "string" ? transaction.completed_at : null,
    lastLog: typeof last.message === "string" ? last.message : null,
    lastLogAt: typeof last.created_at === "string" ? last.created_at : null,
    receipt: typeof receipt === "string" ? receipt : null,
    raw: result.body,
  }
}
