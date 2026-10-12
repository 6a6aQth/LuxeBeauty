import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { confirmPaidBooking } from "@/lib/confirm-booking"
import { amountForMethod } from "@/lib/money"
import { localMobileMoneyNumber, type MobileOperator } from "@/lib/mobile-money"
import { successfulBookingsForPhone } from "@/lib/booking-phones"
import { heldBookingWhere } from "@/lib/slots"
import {
  TRACK_HOURS,
  getChargeStatus,
  getOperatorRefId,
  holdMinutes,
  initiateBankTransfer,
  initiateMobileMoney,
  isBank,
  newChargeId,
  type InitiateOutcome,
  type Method,
} from "@/lib/paychangu-direct"

class SlotTaken extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const GENERIC_START_ERROR = "We couldn't start your payment. Please try again in a moment."

export function alertOps(message: string) {
  console.error("[payments]", message)
}

type BankJson = { bank?: string; name?: string; number?: string; receipt?: string | null }

function asBank(value: unknown): BankJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as BankJson
}

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/)
  return { firstName: parts[0] || name, lastName: parts.slice(1).join(" ") || parts[0] || name }
}

function newReference() {
  return `LLB-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

function methodFor(operator: MobileOperator | "bank"): Method {
  if (operator === "bank") return "bank_transfer"
  if (operator === "airtel") return "airtel_money"
  return "tnm_mpamba"
}

export interface StartBookingInput {
  name: string
  phone: string
  email?: string | null
  date: string
  timeSlot: string
  services: string[]
  notes?: string | null
  inspirationPhotos?: string[]
  operator: MobileOperator | "bank"
  mobile?: string
  submitToken: string
}

export type StartResult =
  | {
      ok: true
      chargeId: string
      reference: string
      method: Method
      expiresAt: string
      amount: number
      account?: { bank: string; name: string; number: string }
    }
  | { ok: false; message: string }

type PaymentWithBooking = Prisma.PaymentGetPayload<{ include: { booking: true } }>

function accountFrom(payment: { method: string; bankDetails: unknown }) {
  if (!isBank(payment.method as Method)) return undefined
  const details = asBank(payment.bankDetails)
  if (!details.number) return undefined
  return { bank: details.bank ?? "", name: details.name ?? "", number: details.number }
}

async function openView(payment: PaymentWithBooking): Promise<StartResult> {
  return {
    ok: true,
    chargeId: payment.id,
    reference: payment.booking.reference,
    method: payment.method as Method,
    expiresAt: (payment.booking.expiresAt ?? payment.createdAt).toISOString(),
    amount: amountForMethod(payment.method),
    account: accountFrom(payment),
  }
}

export async function startPayment(input: StartBookingInput): Promise<StartResult> {
  let method: Method = "bank_transfer"
  let local: string | null = null
  let operatorRefId: string | null = null
  if (input.operator !== "bank") {
    const phone = input.mobile ? localMobileMoneyNumber(input.mobile, input.operator) : null
    if (!phone) {
      return {
        ok: false,
        message: input.operator === "tnm"
          ? "TNM Mpamba needs a number starting with 08."
          : "Airtel Money needs a number starting with 09.",
      }
    }
    method = methodFor(input.operator)
    local = phone
    const network = input.operator === "airtel" ? "airtel" : "tnm"
    operatorRefId = await getOperatorRefId(network)
    if (!operatorRefId) {
      alertOps("Mobile money operator list unavailable")
      return { ok: false, message: GENERIC_START_ERROR }
    }
  }

  const amount = amountForMethod(method)
  if (!Number.isInteger(amount) || amount <= 0) {
    alertOps("Test amount is not a positive integer")
    return { ok: false, message: GENERIC_START_ERROR }
  }

  const existing = await prisma.booking.findUnique({
    where: { submitToken: input.submitToken },
    include: { payment: true },
  })
  if (existing?.payment && ["pending", "expired"].includes(existing.payment.status)) {
    return openView({ ...existing.payment, booking: existing })
  }
  if (existing?.payment?.status === "success" && existing.status === "successful") {
    return openView({ ...existing.payment, booking: existing })
  }
  if (existing) {
    return { ok: false, message: "This payment attempt already finished. Please try again." }
  }

  const holdSeconds = holdMinutes(method) * 60
  const provisional = new Date(Date.now() + (holdSeconds + 30) * 1000)
  let chargeId = ""
  let bookingId = ""
  let reference = ""

  for (let attempt = 0; attempt < 3 && !chargeId; attempt++) {
    const id = newChargeId(method)
    reference = reference || newReference()
    try {
      const created = await prisma.$transaction(async (tx) => {
        const clash = await tx.booking.findFirst({
          where: { date: input.date, timeSlot: input.timeSlot, ...heldBookingWhere() },
          select: { id: true },
        })
        if (clash) throw new SlotTaken()
        const booking = await tx.booking.create({
          data: {
            name: input.name,
            phone: input.phone,
            email: input.email || null,
            date: input.date,
            timeSlot: input.timeSlot,
            services: input.services,
            notes: input.notes || null,
            inspirationPhotos: input.inspirationPhotos ?? [],
            reference,
            status: "pending",
            expiresAt: provisional,
            submitToken: input.submitToken,
          },
        })
        const payment = await tx.payment.create({
          data: {
            id,
            bookingId: booking.id,
            reference: booking.reference,
            customerName: booking.name,
            method,
            mobile: local,
            status: "pending",
          },
        })
        return { booking, payment }
      })
      chargeId = created.payment.id
      bookingId = created.booking.id
      reference = created.booking.reference
    } catch (error) {
      if (error instanceof SlotTaken) {
        return { ok: false, message: "That time was just taken. Please choose another slot." }
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = String(error.meta?.target ?? "")
        if (target.includes("submitToken")) {
          const raced = await prisma.booking.findUnique({
            where: { submitToken: input.submitToken },
            include: { payment: true },
          })
          if (raced?.payment) return openView({ ...raced.payment, booking: raced })
        }
        if (target.includes("reference")) {
          reference = ""
          continue
        }
        continue
      }
      throw error
    }
  }

  if (!chargeId || !bookingId) return { ok: false, message: GENERIC_START_ERROR }

  const { firstName, lastName } = splitName(input.name)
  const customer = { email: input.email || undefined, firstName, lastName }
  const initiate = (): Promise<InitiateOutcome> =>
    isBank(method)
      ? initiateBankTransfer({ chargeId, amount, ...customer })
      : initiateMobileMoney({
          chargeId,
          mobileLocal: local!,
          operatorRefId: operatorRefId!,
          amount,
          ...customer,
        })

  let result = await initiate()
  if (result.outcome === "rate_limited") {
    await sleep(3000)
    result = await initiate()
  }

  if (result.outcome === "unknown" && !isBank(method)) {
    for (let i = 0; i < 2; i++) {
      await sleep(4000)
      const status = await getChargeStatus(method, chargeId)
      if (status.ok) {
        result = { outcome: "accepted", refId: null, traceId: null }
        break
      }
      if (status.kind === "not_found") break
    }
  }

  if (result.outcome === "accepted") {
    const expiresAt = new Date(Date.now() + holdSeconds * 1000)
    await prisma.payment.update({
      where: { id: chargeId },
      data: {
        ids: { ref: result.refId, trace: result.traceId },
        bankDetails: result.account
          ? { bank: result.account.bank, name: result.account.name, number: result.account.number }
          : undefined,
      },
    })
    await prisma.booking.update({ where: { id: bookingId }, data: { expiresAt } })
    return {
      ok: true,
      chargeId,
      reference,
      method,
      expiresAt: expiresAt.toISOString(),
      amount,
      account: result.account,
    }
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: chargeId },
      data: { status: "failed", note: result.message },
    }),
    prisma.booking.updateMany({
      where: { id: bookingId, status: "pending" },
      data: { status: "failed" },
    }),
  ])
  alertOps(`Could not start ${chargeId} (${result.outcome}): ${result.message}`)
  return { ok: false, message: GENERIC_START_ERROR }
}

export function customerMessage(status: string, method: Method, reference: string): string | null {
  switch (status) {
    case "failed":
      return isBank(method)
        ? "The transfer wasn't completed. Please try again."
        : "The payment wasn't completed. Check your PIN and balance, then try again."
    case "expired":
      return "This payment session has ended. Please start again."
    case "cancelled":
      return "Payment cancelled."
    case "review":
      return `We received a payment that doesn't match the amount due. Please contact us and quote ${reference}.`
    case "refund":
      return `We received your payment after the session ended and will refund it. Please quote ${reference}.`
    default:
      return null
  }
}

async function loadPayment(paymentId: string) {
  return prisma.payment.findUnique({ where: { id: paymentId }, include: { booking: true } })
}

export async function settle(paymentId: string): Promise<void> {
  const payment = await loadPayment(paymentId)
  if (!payment || !["pending", "expired"].includes(payment.status)) return
  if (payment.method !== "airtel_money" && payment.method !== "tnm_mpamba" && payment.method !== "bank_transfer") {
    alertOps(`Unknown method on ${payment.id}`)
    return
  }

  const status = await getChargeStatus(payment.method, payment.id)
  if (!status.ok) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { note: `HTTP ${status.http}: ${status.message || status.kind}` },
    })
    if (status.kind === "auth") {
      alertOps("Paychangu rejected the secret key. Every payment looks unpaid until this is fixed.")
    }
    return
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { lastVerifiedAt: new Date(), note: null },
  })

  if (status.state === "unknown") {
    alertOps(`Unrecognised status for ${payment.id}: ${JSON.stringify(status.raw)}`)
    return
  }

  if (status.state === "pending") {
    if (
      payment.booking.status === "pending" &&
      payment.booking.expiresAt &&
      payment.booking.expiresAt.getTime() <= Date.now()
    ) {
      await expire(payment.id)
    }
    return
  }

  if (status.state === "failed") {
    await prisma.$transaction(async (tx) => {
      const hit = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: ["pending", "expired"] } },
        data: { status: "failed", note: status.lastLog, finalizedAt: asDate(status.lastLogAt) },
      })
      if (hit.count !== 1) return
      await tx.booking.updateMany({
        where: { id: payment.bookingId, status: "pending" },
        data: { status: "failed" },
      })
    })
    return
  }

  const received = status.amount
  const expected = amountForMethod(payment.method)
  if (received !== expected) {
    const detail = `Expected ${expected}, got ${received}`
    await prisma.$transaction(async (tx) => {
      const hit = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: ["pending", "expired"] } },
        data: {
          status: "review",
          note: detail,
          finalizedAt: asDate(status.completedAt),
          bankDetails: { ...asBank(payment.bankDetails), receipt: status.receipt },
        },
      })
      if (hit.count !== 1) return
      await tx.booking.updateMany({
        where: { id: payment.bookingId },
        data: { status: "review" },
      })
    })
    alertOps(`Amount problem on ${payment.id}: ${detail}`)
    return
  }

  const completed = asDate(status.completedAt) ?? new Date()
  const priorCount = (await successfulBookingsForPhone(payment.booking.phone, payment.booking.reference)).length
  const discountApplied = (priorCount + 1) % 6 === 0

  const won = await prisma.$transaction(async (tx) => {
    const hit = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: ["pending", "expired"] } },
      data: {
        status: "success",
        finalizedAt: asDate(status.completedAt),
        bankDetails: { ...asBank(payment.bankDetails), receipt: status.receipt },
      },
    })
    if (hit.count !== 1) return null
    const booking = await tx.booking.findUnique({ where: { id: payment.bookingId } })
    if (!booking) return null
    const inWindow =
      booking.status === "pending" &&
      booking.expiresAt != null &&
      completed.getTime() <= booking.expiresAt.getTime() + 30_000
    const next = booking.status === "successful" || inWindow ? "successful" : "refund"
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: next,
        paidAt: next === "successful" && booking.status !== "successful" ? new Date() : booking.paidAt,
        discountApplied: next === "successful" && booking.status === "pending" ? discountApplied : booking.discountApplied,
      },
    })
    return { status: next, becameSuccessful: booking.status === "pending" && next === "successful" }
  })

  if (won?.status === "refund") alertOps(`Payment arrived after the session ended: ${payment.id}. A refund is due.`)
  if (won?.becameSuccessful) await confirmPaidBooking(payment.bookingId)
}

async function expire(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { id: true, bookingId: true } })
  if (!payment) return
  await prisma.$transaction(async (tx) => {
    const hit = await tx.payment.updateMany({
      where: { id: payment.id, status: "pending" },
      data: { status: "expired" },
    })
    if (hit.count !== 1) return
    await tx.booking.updateMany({
      where: { id: payment.bookingId, status: "pending" },
      data: { status: "expired" },
    })
  })
}

export async function cancelPayment(chargeId: string): Promise<"cancelled" | "already_paid" | "not_open"> {
  const payment = await prisma.payment.findUnique({ where: { id: chargeId } })
  if (!payment || payment.status !== "pending") return "not_open"

  await settle(payment.id)

  const closed = await prisma.$transaction(async (tx) => {
    const hit = await tx.payment.updateMany({
      where: { id: chargeId, status: "pending" },
      data: { status: "expired" },
    })
    if (hit.count !== 1) return false
    const booking = await tx.booking.updateMany({
      where: { id: payment.bookingId, status: "pending" },
      data: { status: "cancelled" },
    })
    return booking.count === 1
  })
  if (closed) return "cancelled"

  const booking = await prisma.booking.findUnique({ where: { id: payment.bookingId }, select: { status: true } })
  return booking?.status === "successful" ? "already_paid" : "not_open"
}

export async function getPaymentView(chargeId: string) {
  const load = () => loadPayment(chargeId)
  let payment = await load()
  if (!payment) return null

  const stale = !payment.lastVerifiedAt || Date.now() - payment.lastVerifiedAt.getTime() > 4000
  if (stale && ["pending", "expired"].includes(payment.status)) {
    await settle(payment.id)
    payment = await load()
  }
  if (!payment) return null

  const booking = payment.booking
  return {
    status: booking.status,
    paymentStatus: payment.status,
    method: payment.method as Method,
    reference: booking.reference,
    chargeId: payment.id,
    expiresAt: booking.expiresAt?.toISOString() ?? null,
    message: customerMessage(booking.status, payment.method as Method, booking.reference),
    account:
      isBank(payment.method as Method) && booking.status === "pending" ? accountFrom(payment) : undefined,
    booking:
      booking.status === "successful"
        ? {
            id: booking.id,
            name: booking.name,
            date: booking.date,
            timeSlot: booking.timeSlot,
            services: booking.services,
            reference: booking.reference,
            method: payment.method,
            discountApplied: booking.discountApplied,
            email: booking.email,
          }
        : undefined,
  }
}

export async function reconcile(limit = 10): Promise<number> {
  const now = Date.now()
  const trackSince = new Date(now - TRACK_HOURS * 3_600_000)
  const freshSince = new Date(now - 35 * 60_000)
  const minuteAgo = new Date(now - 60_000)
  const quarterAgo = new Date(now - 15 * 60_000)

  const due = await prisma.payment.findMany({
    where: {
      status: { in: ["pending", "expired"] },
      createdAt: { gt: trackSince },
      OR: [
        { lastVerifiedAt: null },
        { createdAt: { gt: freshSince }, lastVerifiedAt: { lt: minuteAgo } },
        { createdAt: { lte: freshSince }, lastVerifiedAt: { lt: quarterAgo } },
      ],
    },
    orderBy: { lastVerifiedAt: { sort: "asc", nulls: "first" } },
    take: limit,
    select: { id: true },
  })

  for (let i = 0; i < due.length; i += 5) {
    await Promise.all(due.slice(i, i + 5).map((row) => settle(row.id)))
  }
  return due.length
}

export async function reconcileUntilQuiet(budgetMs = 40_000): Promise<number> {
  const started = Date.now()
  let checked = 0
  while (Date.now() - started < budgetMs) {
    const count = await reconcile(10)
    checked += count
    if (count < 10) break
  }
  return checked
}
