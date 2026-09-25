/** Visits still needed until the next 30% booking. A multiple of 6 starts a new cycle (6 remaining). */
export function visitsUntilDiscount(successfulCount: number): number {
  const remainder = successfulCount % 6
  return remainder === 0 ? 6 : 6 - remainder
}

export function nextVisitIsDiscount(successfulCount: number): boolean {
  return (successfulCount + 1) % 6 === 0
}

export function loyaltyProgressCopy(successfulCount: number): string {
  const remaining = visitsUntilDiscount(successfulCount)
  if (remaining === 1) return "1 more visit until a 30% discount"
  return `${remaining} more visits until a 30% discount`
}
