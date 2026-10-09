import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { logPaymentEvent } from "@/lib/paymentLogger"
import { getSlotsForDate } from "@/lib/time-slots"
import { canonicalPhone } from "@/lib/phone"
import { getSessionUser } from "@/lib/auth/session"
import { localMobileMoneyNumber, type MobileOperator } from "@/lib/mobile-money"
import { chargeMobileMoney, initializeBankTransfer, operatorRefId } from "@/lib/paychangu-direct"
import { sumServicePrices } from "@/lib/service-total"

type PayMethod = MobileOperator | "bank"

function splitName(name: string) {
  const parts = name.trim().split(/\s+/)
  return { firstName: parts[0] || name, lastName: parts.slice(1).join(" ") || parts[0] || name }
}

function bankView(booking: {
  bankName: string | null
  bankAccountNumber: string | null
  bankAccountName: string | null
  bankExpiresAt: string | null
  serviceTotal: number | null
}) {
  if (!booking.bankName || !booking.bankAccountNumber) return null
  return {
    bankName: booking.bankName,
    accountNumber: booking.bankAccountNumber,
    accountName: booking.bankAccountName ?? "",
    expiresAt: booking.bankExpiresAt,
    amount: booking.serviceTotal,
  }
}

export async function POST(req: Request) {
  let chargeId = "unknown"
  try {
    const body = await req.json()
    const { formData, useSession, operator, mobile, action, chargeId: existingChargeId } = body as {
      formData?: Record<string, unknown>
      useSession?: boolean
      operator?: PayMethod
      mobile?: string
      action?: string
      chargeId?: string
    }

    if (!formData) {
      return NextResponse.json({ message: "Booking details are required." }, { status: 400 })
    }
    if (operator !== "tnm" && operator !== "airtel" && operator !== "bank") {
      return NextResponse.json({ message: "Choose TNM Mpamba, Airtel Money, or Bank Transfer." }, { status: 400 })
    }

    let payer = ""
    if (operator !== "bank") {
      const local = localMobileMoneyNumber(String(mobile ?? ""), operator)
      if (!local) {
        const hint = operator === "tnm" ? "TNM Mpamba needs a number starting with 08." : "Airtel Money needs a number starting with 09."
        return NextResponse.json({ message: hint }, { status: 400 })
      }
      payer = local
    }

    if (useSession) {
      const session = await getSessionUser()
      if (!session.configured) {
        return NextResponse.json({ message: "Neon Auth is not configured." }, { status: 503 })
      }
      if (!session.user) {
        return NextResponse.json({ message: "Sign in required." }, { status: 401 })
      }
      const profile = await prisma.customerProfile.findUnique({
        where: { neonUserId: session.user.id },
      })
      if (!profile) {
        return NextResponse.json({ message: "Finish your account details before booking." }, { status: 409 })
      }
      formData.name = profile.name
      formData.email = profile.email
      formData.phone = profile.phone
    }

    const phone = canonicalPhone(String(formData.phone ?? ""))
    if (!phone) {
      return NextResponse.json({ message: "That phone number format is not okay." }, { status: 400 })
    }
    formData.phone = phone

    const date = String(formData.date ?? "")
    const timeSlot = String(formData.timeSlot ?? "")
    if (date && timeSlot) {
      const possibleSlots = getSlotsForDate(new Date(date))
      if (!possibleSlots.includes(timeSlot)) {
        return NextResponse.json(
          { message: `The time slot ${timeSlot} is not available for ${date}.` },
          { status: 400 },
        )
      }
    }

    const name = String(formData.name ?? "").trim()
    const services = Array.isArray(formData.services) ? [...new Set(formData.services.map(String))] : []
    if (!name || !date || !timeSlot || services.length === 0) {
      return NextResponse.json({ message: "Booking details are incomplete." }, { status: 400 })
    }

    if (action === "initialize") {
      chargeId = String(existingChargeId || "")
      if (!chargeId) {
        return NextResponse.json({ message: "Missing charge id." }, { status: 400 })
      }
      const booking = await prisma.booking.findUnique({ where: { ticketId: chargeId } })
      if (!booking) {
        return NextResponse.json({ message: "Booking not found." }, { status: 404 })
      }
      if (booking.status === "successful") {
        return NextResponse.json({ chargeId, status: "success", amount: booking.serviceTotal })
      }
      if (booking.serviceTotal == null || booking.serviceTotal <= 0) {
        return NextResponse.json({ message: "This booking has no service total." }, { status: 400 })
      }

      const { firstName, lastName } = splitName(booking.name)
      if (booking.paymentMethod === "bank" || operator === "bank") {
        const saved = bankView(booking)
        if (saved) {
          return NextResponse.json({ chargeId, status: "pending", amount: booking.serviceTotal, bank: saved })
        }
        const opened = await initializeBankTransfer({
          amount: booking.serviceTotal,
          chargeId,
          email: booking.email ?? undefined,
          firstName,
          lastName,
        })
        const updated = await prisma.booking.update({
          where: { id: booking.id },
          data: {
            paymentMethod: "bank",
            bankName: opened.bankName,
            bankAccountNumber: opened.accountNumber,
            bankAccountName: opened.accountName,
            bankExpiresAt: opened.expiresAt,
          },
        })
        await logPaymentEvent({
          txRef: chargeId,
          bookingId: booking.id,
          eventType: "paychangu_initialize",
          status: opened.status || "pending",
          message: "Bank transfer account opened",
          payload: { amount: booking.serviceTotal, bankName: opened.bankName },
        })
        return NextResponse.json({
          chargeId,
          status: "pending",
          amount: booking.serviceTotal,
          bank: bankView(updated),
        })
      }

      const refId = await operatorRefId(operator)
      const charged = await chargeMobileMoney({
        mobile: payer,
        mobileMoneyOperatorRefId: refId,
        amount: booking.serviceTotal,
        chargeId,
        email: booking.email ?? undefined,
        firstName,
        lastName,
      })
      await logPaymentEvent({
        txRef: chargeId,
        bookingId: booking.id,
        eventType: "paychangu_initialize",
        status: charged.initialStatus,
        message: charged.message || "PayChangu accepted the charge",
        payload: { amount: booking.serviceTotal },
      })
      await logPaymentEvent({
        txRef: chargeId,
        bookingId: booking.id,
        eventType: "awaiting_pin",
        status: "pending",
        message: "Waiting for the customer to approve the phone prompt",
      })
      return NextResponse.json({ chargeId, status: "pending", amount: booking.serviceTotal })
    }

    const priced = await sumServicePrices(services)
    if ("message" in priced) {
      return NextResponse.json({ message: priced.message }, { status: 400 })
    }

    chargeId = `LLB-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
    await logPaymentEvent({
      txRef: chargeId,
      eventType: "charge_initiated",
      status: "pending",
      message: "Direct Charge started",
      payload: { operator, amount: priced.total },
    })

    const booking = await prisma.booking.create({
      data: {
        name,
        phone,
        email: formData.email ? String(formData.email) : null,
        date,
        timeSlot,
        services,
        notes: formData.notes ? String(formData.notes) : null,
        inspirationPhotos: Array.isArray(formData.inspirationPhotos) ? formData.inspirationPhotos.map(String) : [],
        ticketId: chargeId,
        discountApplied: false,
        rescheduleCount: 0,
        originalDate: null,
        status: "pending",
        serviceTotal: priced.total,
        paymentMethod: operator,
      },
    })

    await logPaymentEvent({
      txRef: chargeId,
      bookingId: booking.id,
      eventType: "booking_created",
      status: "pending",
      message: "Pending booking stored",
      payload: { amount: priced.total },
    })

    return NextResponse.json({
      chargeId,
      status: "pending",
      amount: priced.total,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error."
    if (chargeId !== "unknown") {
      await logPaymentEvent({
        txRef: chargeId,
        eventType: "paychangu_initialize",
        status: "error",
        message,
      })
    }
    const status = message === "Internal server error." ? 500 : 400
    return NextResponse.json({ message }, { status: message.includes("PAYCHANGU_SECRET_KEY") ? 500 : status })
  }
}
