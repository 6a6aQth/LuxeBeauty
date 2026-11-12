"use client"

import { forwardRef, useRef } from "react"
import { QRCodeSVG } from "qrcode.react"
import Logo from "@/components/logo"
import { formatMwk } from "@/lib/money"
import { format, parseISO } from "date-fns"
import { Button } from "@/components/ui/animated-download-button"

export type VoucherDetails = {
  voucherId: string
  purchaseAmount: number
  remainingBalance?: number
  recipientName: string
  purchaserName: string
  message?: string | null
  createdAt?: string
}

export const VoucherTicketFace = forwardRef<HTMLDivElement, { details: VoucherDetails }>(
  function VoucherTicketFace({ details }, ref) {
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://laurynluxebeauty.com"
    const lookupUrl = `${siteUrl}/gift-voucher/${details.voucherId}`

    return (
      <div ref={ref} className="relative w-full max-w-[340px] rounded-2xl bg-white shadow-2xl overflow-hidden border border-gray-100">
        <div className="absolute -top-6 left-1/2 h-12 w-12 -translate-x-1/2 rounded-full bg-gray-100 border border-gray-200" />
        <div className="p-8 text-center">
          <div className="mb-4 flex justify-center">
            <Logo />
          </div>
          <div className="mb-4 inline-block rounded-full border border-pink-300 bg-pink-50 px-4 py-1 text-xs font-semibold tracking-wider uppercase text-pink-900">
            Official Gift Voucher
          </div>

          <div className="mb-4">
            <p className="text-xs uppercase tracking-widest text-gray-400">Gifted Value</p>
            <p className="text-3xl font-extrabold text-black tracking-tight mt-1">
              {formatMwk(details.purchaseAmount)}
            </p>
          </div>

          <div className="space-y-2.5 text-sm text-gray-700 bg-gray-50/80 rounded-xl p-4 text-left border border-gray-100">
            <p>
              <span className="text-xs uppercase tracking-wider text-gray-400 block">Recipient</span>
              <strong className="text-gray-900 text-base">{details.recipientName}</strong>
            </p>
            <p>
              <span className="text-xs uppercase tracking-wider text-gray-400 block">From</span>
              <strong className="text-gray-900">{details.purchaserName}</strong>
            </p>
            {details.message ? (
              <p className="pt-1 text-xs italic text-pink-950 border-t border-gray-200/60 mt-2">
                &ldquo;{details.message}&rdquo;
              </p>
            ) : null}
            {details.createdAt ? (
              <p className="text-[11px] text-gray-400 pt-1">
                Issued {format(parseISO(details.createdAt), "MMMM dd, yyyy")}
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col items-center justify-center">
            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-200">
              <QRCodeSVG
                value={lookupUrl}
                size={120}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="text-base font-mono font-bold tracking-widest text-black mt-3">
              {details.voucherId}
            </p>
            <p className="mt-1 text-[11px] text-gray-400 text-center max-w-[240px]">
              Scan QR code or present Voucher ID to redeem at Lauryn Luxe Beauty Studio.
            </p>
          </div>
        </div>
        <div className="absolute -bottom-6 left-1/2 h-12 w-12 -translate-x-1/2 rounded-full bg-gray-100 border border-gray-200" />
      </div>
    )
  }
)

export async function downloadVoucherTicketPng(node: HTMLElement, voucherId: string) {
  const { default: html2canvas } = await import("html2canvas")
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#0b0b0b" })
  const link = document.createElement("a")
  link.href = canvas.toDataURL("image/png")
  link.download = `gift-voucher-${voucherId}.png`
  link.click()
}

export function VoucherTicket({ details }: { details: VoucherDetails }) {
  const ticketRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex flex-col items-center">
      <VoucherTicketFace ref={ticketRef} details={details} />
      <div className="mt-6 flex justify-center">
        <Button
          onClick={() => ticketRef.current && downloadVoucherTicketPng(ticketRef.current, details.voucherId)}
          className="bg-black text-white hover:bg-neutral-900 border border-neutral-700"
        >
          Download Voucher Ticket (PNG)
        </Button>
      </div>
    </div>
  )
}

