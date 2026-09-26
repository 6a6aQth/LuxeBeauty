/** Charged amount for Direct Charge. Capsule 16.8 restores this to 10000 before real deposits. */
export const DEPOSIT_AMOUNT_MWK = 100

export function formatDeposit(amount = DEPOSIT_AMOUNT_MWK): string {
  return `MWK ${amount.toLocaleString("en-US")}`
}

export function chargedAmountMatches(amount: number): boolean {
  return Number.isFinite(amount) && Math.round(amount) === DEPOSIT_AMOUNT_MWK
}
