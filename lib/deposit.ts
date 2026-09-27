/** Charged amount for Direct Charge. */
export const DEPOSIT_AMOUNT_MWK = 10000

export function formatDeposit(amount = DEPOSIT_AMOUNT_MWK): string {
  return `MWK ${amount.toLocaleString("en-US")}`
}

export function chargedAmountMatches(amount: number): boolean {
  return Number.isFinite(amount) && Math.round(amount) === DEPOSIT_AMOUNT_MWK
}
