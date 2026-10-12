/** UAT test fee. Mobile money is charged this amount. */
export const MOBILE_AMOUNT_MWK = 100

/** UAT test fee. Bank transfer is charged this amount. */
export const BANK_TRANSFER_AMOUNT_MWK = 1000

/** Mobile-money fee. Kept so older call sites stay on the mobile figure. */
export const DEPOSIT_AMOUNT_MWK = MOBILE_AMOUNT_MWK

export function amountForMethod(method: string | null | undefined): number {
  if (method === "bank" || method === "bank_transfer") return BANK_TRANSFER_AMOUNT_MWK
  return MOBILE_AMOUNT_MWK
}

export function formatMwk(amount: number): string {
  return `MWK ${Math.round(amount).toLocaleString("en-US")}`
}

export function chargedAmountMatches(amount: number, expected: number | null | undefined): boolean {
  if (expected == null || !Number.isInteger(expected) || expected <= 0) return false
  if (!Number.isFinite(amount)) return false
  const rounded = Math.round(amount)
  return Math.abs(amount - rounded) < 0.001 && rounded === expected
}

/** `sent` false leaves the column alone. Null or blank clears it. */
export function readServicePrice(
  value: unknown,
  sent: boolean,
): { ok: true; price?: number | null } | { ok: false; error: string } {
  if (!sent) return { ok: true }
  if (value === null || value === "") return { ok: true, price: null }
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : Number.NaN
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return { ok: false, error: "Price must be a whole number of MWK greater than zero." }
  }
  return { ok: true, price: numeric }
}

export function bankExpiryLabel(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null
  let ms: number
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) {
    ms = Date.parse(value)
  } else {
    const n = typeof value === "number" ? value : Number(String(value).trim())
    if (!Number.isFinite(n) || n <= 0) return null
    ms = n < 1e12 ? n * 1000 : n
  }
  if (!Number.isFinite(ms)) return null
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Blantyre",
  }).format(date)
}
