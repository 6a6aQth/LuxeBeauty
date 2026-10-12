/** A slot is held by a paid booking, or by a pending one still inside its payment window. */
export function heldBookingWhere(now = new Date()) {
  return {
    OR: [
      { status: "successful" },
      { status: "pending", expiresAt: { gt: now } },
    ],
  }
}
