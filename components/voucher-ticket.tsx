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
      <div
        ref={ref}
        className="relative w-full max-w-[340px] rounded-2xl bg-white text-stone-900 shadow-2xl overflow-hidden border border-rose-100/60"
      >
        <div className="absolute -top-6 left-1/2 h-12 w-12 -translate-x-1/2 rounded-full bg-gray-200" />

        <div className="p-7 text-center">
          {/* Studio Brand Logo Header */}
          <div className="mb-4 flex justify-center">
            <Logo className="text-stone-900" />
          </div>

          {/* Luxury Badge */}
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-pink-200 bg-pink-50/80 px-3.5 py-1 text-[10px] font-semibold tracking-[0.22em] uppercase text-[#6e243f]">
            <span>✦</span>
            <span>Official Gift Voucher</span>
            <span>✦</span>
          </div>

          {/* Gifted Value */}
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-stone-400 font-medium">Gifted Value</p>
            <p className="font-serif text-3xl sm:text-4xl font-normal text-stone-900 tracking-tight mt-1">
              {formatMwk(details.purchaseAmount)}
            </p>
            {details.remainingBalance !== undefined && details.remainingBalance !== details.purchaseAmount ? (
              <p className="text-xs font-semibold text-pink-700 mt-1">
                Remaining Balance: {formatMwk(details.remainingBalance)}
              </p>
            ) : null}
          </div>

          {/* Luxury Parchment Card */}
          <div className="space-y-3 text-sm text-stone-700 bg-stone-50/90 rounded-2xl p-4 text-left border border-stone-200/70">
            <div>
              <span className="text-[9px] uppercase tracking-[0.22em] text-pink-900/70 font-semibold block">
                Presented To
              </span>
              <p className="font-serif text-lg font-medium text-stone-900 leading-snug">
                {details.recipientName}
              </p>
            </div>

            <div className="border-t border-stone-200/60 pt-2 flex items-baseline justify-between">
              <div>
                <span className="text-[9px] uppercase tracking-[0.22em] text-stone-400 font-semibold block">
                  With Love From
                </span>
                <p className="text-sm font-medium text-stone-800">{details.purchaserName}</p>
              </div>
              {details.createdAt ? (
                <span className="text-[10px] text-stone-400 font-mono">
                  {format(parseISO(details.createdAt), "dd MMM yyyy")}
                </span>
              ) : null}
            </div>

            {details.message ? (
              <div className="rounded-xl bg-pink-50/70 border border-pink-100/70 p-2.5 mt-2">
                <p className="font-serif italic text-xs text-[#6e243f] leading-relaxed">
                  &ldquo;{details.message}&rdquo;
                </p>
              </div>
            ) : null}
          </div>

          {/* Perforated ticket divider */}
          <div className="my-5 relative flex items-center justify-center">
            <div className="w-full border-t border-dashed border-stone-300" />
          </div>

          {/* QR Code & Voucher Redemption */}
          <div className="flex flex-col items-center justify-center">
            <div className="p-2.5 bg-white rounded-2xl shadow-sm border border-stone-200/80">
              <QRCodeSVG
                value={lookupUrl}
                size={120}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="font-mono text-sm font-bold tracking-[0.25em] text-stone-900 mt-3">
              {details.voucherId}
            </p>

            <div className="mt-2.5 max-w-[260px] text-center space-y-1">
              <p className="text-[11px] font-medium text-stone-700 leading-snug">
                Scan QR code to view live balance & studio details.
              </p>
              <p className="text-[10px] text-stone-500 leading-tight">
                Please contact the studio at least <strong>24 hours in advance</strong> to reserve your appointment slot.
              </p>
            </div>
          </div>
        </div>

        <div className="absolute -bottom-6 left-1/2 h-12 w-12 -translate-x-1/2 rounded-full bg-gray-200" />
      </div>
    )
  }
)

export async function downloadVoucherTicketPng(node: HTMLElement, voucherId: string) {
  const { default: html2canvas } = await import("html2canvas")
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#e5e7eb" })
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
