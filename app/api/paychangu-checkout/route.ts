import { after, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/auth/session"
import { canonicalPhone } from "@/lib/phone"
import { reconcile, startPayment } from "@/lib/payments"
import { sumServicePrices } from "@/lib/service-total"
import { getSlotsForDate } from "@/lib/time-slots"
import type { MobileOperator } from "@/lib/mobile-money"

export const maxDuration = 60

type PayMethod = MobileOperator | "bank"

function sweepSoon() {
  after(() => {
    reconcile(3).catch((error) => console.error("[payments] sweep", error))
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { formData, useSession, operator, mobile, submitToken } = body as {
      formData?: Record<string, unknown>
      useSession?: boolean
      operator?: PayMethod
      mobile?: string
      submitToken?: string
    }

    if (!formData) {
      return NextResponse.json({ ok: false, message: "Booking details are required." }, { status: 400 })
    }
    if (operator !== "tnm" && operator !== "airtel" && operator !== "bank") {
      return NextResponse.json({ ok: false, message: "Choose TNM Mpamba, Airtel Money, or Bank Transfer." }, { status: 400 })
    }
    if (!submitToken || typeof submitToken !== "string") {
      return NextResponse.json({ ok: false, message: "Refresh the page and try the payment again." }, { status: 400 })
    }

    if (useSession) {
      const session = await getSessionUser()
      if (!session.configured) {
        return NextResponse.json({ ok: false, message: "Neon Auth is not configured." }, { status: 503 })
      }
      if (!session.user) {
        return NextResponse.json({ ok: false, message: "Sign in required." }, { status: 401 })
      }
      const profile = await prisma.customerProfile.findUnique({
        where: { neonUserId: session.user.id },
      })
      if (!profile) {
        return NextResponse.json({ ok: false, message: "Finish your account details before booking." }, { status: 409 })
      }
      formData.name = profile.name
      formData.email = profile.email
      formData.phone = profile.phone
    }

    const phone = canonicalPhone(String(formData.phone ?? ""))
    if (!phone) {
      return NextResponse.json({ ok: false, message: "That phone number format is not okay." }, { status: 400 })
    }

    const date = String(formData.date ?? "")
    const timeSlot = String(formData.timeSlot ?? "")
    if (date && timeSlot) {
      const possibleSlots = getSlotsForDate(new Date(date))
      if (!possibleSlots.includes(timeSlot)) {
        return NextResponse.json(
          { ok: false, message: `The time slot ${timeSlot} is not available for ${date}.` },
          { status: 400 },
        )
      }
    }

    const name = String(formData.name ?? "").trim()
    const services = Array.isArray(formData.services) ? [...new Set(formData.services.map(String))] : []
    if (!name || !date || !timeSlot || services.length === 0) {
      return NextResponse.json({ ok: false, message: "Booking details are incomplete." }, { status: 400 })
    }

    const priced = await sumServicePrices(services)
    if ("message" in priced) {
      return NextResponse.json({ ok: false, message: priced.message }, { status: 400 })
    }

    const result = await startPayment({
      name,
      phone,
      email: formData.email ? String(formData.email) : null,
      date,
      timeSlot,
      services,
      notes: formData.notes ? String(formData.notes) : null,
      inspirationPhotos: Array.isArray(formData.inspirationPhotos) ? formData.inspirationPhotos.map(String) : [],
      operator,
      mobile: operator === "bank" ? undefined : String(mobile ?? ""),
      submitToken,
    })

    sweepSoon()
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error."
    console.error("[payments] start", error)
    return NextResponse.json(
      { ok: false, message: message.includes("PAYCHANGU_SECRET_KEY") ? "Payments are not available right now." : "We couldn't start your payment. Please try again in a moment." },
      { status: 500 },
    )
  }
}
