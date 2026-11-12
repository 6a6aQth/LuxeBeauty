import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { newVoucherId } from "@/lib/voucher-id"
import { localMobileMoneyNumber } from "@/lib/mobile-money"
import {
  getOperatorRefId,
  initiateBankTransfer,
  initiateMobileMoney,
  isBank,
  newChargeId,
  type Method,
} from "@/lib/paychangu-direct"
import { logPaymentEvent } from "@/lib/paymentLogger"

export const MIN_VOUCHER_AMOUNT_MWK = 100_000

function methodFor(operator: string): Method {
  if (operator === "bank") return "bank_transfer"
  if (operator === "airtel") return "airtel_money"
  return "tnm_mpamba"
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      amount,
      recipientName,
      recipientEmail,
      purchaserName,
      message,
      operator,
      mobile,
    } = body

    const cleanAmount = typeof amount === "number" ? Math.round(amount) : parseInt(String(amount || 0), 10)
    if (isNaN(cleanAmount) || cleanAmount < MIN_VOUCHER_AMOUNT_MWK) {
      return NextResponse.json(
        { error: `Vouchers require a minimum purchase amount of MWK ${MIN_VOUCHER_AMOUNT_MWK.toLocaleString("en-US")}.` },
        { status: 400 }
      )
    }

    if (!recipientName?.trim()) {
      return NextResponse.json({ error: "Recipient name is required." }, { status: 400 })
    }
    if (!recipientEmail?.trim() || !recipientEmail.includes("@")) {
      return NextResponse.json({ error: "Valid recipient email is required." }, { status: 400 })
    }
    if (!purchaserName?.trim()) {
      return NextResponse.json({ error: "Purchaser name is required." }, { status: 400 })
    }

    const opStr = String(operator || "bank").toLowerCase()
    const method = methodFor(opStr)

    let localMobile: string | null = null
    let operatorRefId: string | null = null

    if (opStr !== "bank") {
      const mobileOperator = opStr === "airtel" ? "airtel" : "tnm"
      const phone = mobile ? localMobileMoneyNumber(mobile, mobileOperator) : null
      if (!phone) {
        return NextResponse.json(
          {
            error:
              mobileOperator === "tnm"
                ? "TNM Mpamba needs a number starting with 08."
                : "Airtel Money needs a number starting with 09.",
          },
          { status: 400 }
        )
      }
      localMobile = phone
      operatorRefId = await getOperatorRefId(mobileOperator)
      if (!operatorRefId) {
        return NextResponse.json(
          { error: "Mobile money operator service is currently unavailable. Please try again." },
          { status: 503 }
        )
      }
    }

    const chargeId = newChargeId(method)
    const voucherId = await newVoucherId()

    // Create the pending GiftVoucher row
    const voucher = await prisma.giftVoucher.create({
      data: {
        voucherId,
        status: "pending",
        purchaseAmount: cleanAmount,
        remainingBalance: cleanAmount,
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim().toLowerCase(),
        purchaserName: purchaserName.trim(),
        message: message?.trim() || null,
        chargeId,
        method,
      },
    })

    await logPaymentEvent({
      txRef: voucherId,
      bookingId: null,
      eventType: "voucher_charge_initiated",
      status: "pending",
      message: `Initiated voucher purchase for ${voucherId} via ${method}`,
    })

    const nameParts = purchaserName.trim().split(/\s+/)
    const firstName = nameParts[0] || "Customer"
    const lastName = nameParts.slice(1).join(" ") || firstName

    let initiateResult
    if (opStr === "bank") {
      initiateResult = await initiateBankTransfer({
        chargeId,
        amount: cleanAmount,
        email: recipientEmail.trim(),
        firstName,
        lastName,
      })
    } else {
      initiateResult = await initiateMobileMoney({
        chargeId,
        mobileLocal: localMobile!,
        operatorRefId: operatorRefId!,
        amount: cleanAmount,
        email: recipientEmail.trim(),
        firstName,
        lastName,
      })
    }

    if (initiateResult.outcome !== "accepted") {
      // Mark failed
      await prisma.giftVoucher.update({
        where: { id: voucher.id },
        data: { status: "failed" },
      })
      return NextResponse.json(
        { error: initiateResult.message || "Failed to initialize payment with PayChangu." },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok: true,
      voucherId,
      chargeId,
      method,
      amount: cleanAmount,
      account: initiateResult.account,
    })
  } catch (error: any) {
    console.error("[api/gift-vouchers] error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

