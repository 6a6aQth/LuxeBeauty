/** Visits still needed until the next 30% booking. A multiple of 6 starts a new cycle (6 remaining). */
export function visitsUntilDiscount(successfulCount: number): number {
  const remainder = successfulCount % 6;
  return remainder === 0 ? 6 : 6 - remainder;
}

export function nextVisitIsDiscount(successfulCount: number): boolean {
  return (successfulCount + 1) % 6 === 0;
}

export function loyaltyProgressCopy(successfulCount: number): string {
  if (nextVisitIsDiscount(successfulCount)) {
    return "Your next visit is the 30% visit";
  }
  const remaining = visitsUntilDiscount(successfulCount);
  const noun = remaining === 1 ? "visit" : "visits";
  return `${remaining} ${noun} until the 30% visit`;
}
