export type MobileOperator = "tnm" | "airtel"

/** Local Malawi mobile-money number: 10 digits starting with 08 (TNM) or 09 (Airtel). */
export function localMobileMoneyNumber(input: string, operator: MobileOperator): string | null {
  let digits = input.replace(/[\s\-()]/g, "")
  if (digits.startsWith("+")) digits = digits.slice(1)
  if (digits.startsWith("265") && digits.length === 12) {
    digits = `0${digits.slice(3)}`
  }
  if (!/^0[89]\d{8}$/.test(digits)) return null
  if (operator === "tnm" && !digits.startsWith("08")) return null
  if (operator === "airtel" && !digits.startsWith("09")) return null
  return digits
}

export function classifyChargeStatus(status: string): "success" | "failed" | "pending" {
  const value = status.trim().toLowerCase()
  if (value === "success" || value === "paid" || value === "completed") return "success"
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
    return "failed"
  }
  return "pending"
}
