import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { logPaymentEvent } from "@/lib/paymentLogger"
import { getSlotsForDate } from "@/lib/time-slots"
import { canonicalPhone } from "@/lib/phone"
import { getSessionUser } from "@/lib/auth/session"
import { DEPOSIT_AMOUNT_MWK } from "@/lib/deposit"
import { localMobileMoneyNumber, type MobileOperator } from "@/lib/mobile-money"
import { chargeMobileMoney, operatorRefId } from "@/lib/paychangu-direct"

export async function POST(req: Request) {
  let chargeId = "unknown"
  try {
    const body = await req.json()
    const { formData, useSession, operator, mobile } = body as {
      formData?: Record<string, unknown>
      useSession?: boolean
      operator?: MobileOperator
      mobile?: string
    }

    if (!formData) {
      return NextResponse.json({ message: "Booking details are required." }, { status: 400 })
    }
    if (operator !== "tnm" && operator !== "airtel") {
      return NextResponse.json({ message: "Choose TNM Mpamba or Airtel Money." }, { status: 400 })
    }

    const payer = localMobileMoneyNumber(String(mobile ?? ""), operator)
    if (!payer) {
      const hint = operator === "tnm" ? "TNM Mpamba needs a number starting with 08." : "Airtel Money needs a number starting with 09."
      return NextResponse.json({ message: hint }, { status: 400 })
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
    const services = Array.isArray(formData.services) ? formData.services.map(String) : []
    if (!name || !date || !timeSlot || services.length === 0) {
      return NextResponse.json({ message: "Booking details are incomplete." }, { status: 400 })
    }

    chargeId = `LLB-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
    await logPaymentEvent({
      txRef: chargeId,
      eventType: "charge_initiated",
      status: "pending",
      message: "Direct Charge started",
      payload: { operator, amount: DEPOSIT_AMOUNT_MWK },
    })

    const nameParts = name.split(/\s+/)
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
      },
    })

    await logPaymentEvent({
      txRef: chargeId,
      bookingId: booking.id,
      eventType: "booking_created",
      status: "pending",
      message: "Pending booking stored",
    })

    const refId = await operatorRefId(operator)
    const charged = await chargeMobileMoney({
      mobile: payer,
      mobileMoneyOperatorRefId: refId,
      amount: DEPOSIT_AMOUNT_MWK,
      chargeId,
      email: booking.email ?? undefined,
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(" ") || nameParts[0],
    })

    await logPaymentEvent({
      txRef: chargeId,
      bookingId: booking.id,
      eventType: "paychangu_initialize",
      status: charged.initialStatus,
      message: charged.message || "PayChangu accepted the charge",
    })
    await logPaymentEvent({
      txRef: chargeId,
      bookingId: booking.id,
      eventType: "awaiting_pin",
      status: "pending",
      message: "Waiting for the customer to approve the phone prompt",
    })

    return NextResponse.json({
      chargeId: charged.chargeId,
      status: "pending",
      amount: DEPOSIT_AMOUNT_MWK,
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
