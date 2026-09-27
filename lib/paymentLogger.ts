type PaymentEventInput = {
  txRef: string
  bookingId?: string | null
  eventType: string
  status?: string | null
  httpStatus?: number | null
  message?: string | null
  payload?: unknown
  attempt?: number | null
}

/** Payment audit rows were removed before launch. Calls stay so the charge flow is unchanged. */
export async function logPaymentEvent(_event: PaymentEventInput): Promise<void> {}
