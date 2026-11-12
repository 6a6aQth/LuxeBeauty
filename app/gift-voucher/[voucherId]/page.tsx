"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import { LuxuryMark } from "@/components/luxury-mark"
import { VoucherTicket } from "@/components/voucher-ticket"
import { formatMwk } from "@/lib/money"
import { format, parseISO } from "date-fns"
import { ArrowLeft, Gift, ShieldCheck, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface RedemptionItem {
  id: string
  amountDeducted: number
  serviceNames: string[]
  note?: string | null
  redeemedAt: string
}

interface VoucherData {
  voucherId: string
  status: string
  purchaseAmount: number
  remainingBalance: number
  recipientName: string
  purchaserName: string
  message?: string | null
  createdAt: string
  redemptions: RedemptionItem[]
}

export default function VoucherDetailsPage({
  params,
}: {
  params: Promise<{ voucherId: string }>
}) {
  const resolvedParams = use(params)
  const voucherId = resolvedParams.voucherId

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<VoucherData | null>(null)

  useEffect(() => {
    async function fetchVoucher() {
      try {
        setLoading(true)
        const res = await fetch(`/api/gift-vouchers/${voucherId}`)
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || "Failed to find voucher")
        }
        const json = await res.json()
        setData(json)
      } catch (err: any) {
        setError(err.message || "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    if (voucherId) {
      fetchVoucher()
    }
  }, [voucherId])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <LuxuryMark size="lg" label="Looking up voucher details..." />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-950/50 border border-red-800 text-red-400 mx-auto flex items-center justify-center text-2xl font-bold">
            !
          </div>
          <h1 className="text-2xl font-bold">Voucher Not Found</h1>
          <p className="text-neutral-400 text-sm">{error || "No voucher found matching that ID."}</p>
          <div className="pt-4">
            <Link
              href="/gift-voucher"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-900 border border-neutral-700 text-sm hover:bg-neutral-800 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Gift Vouchers
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const isDepleted = data.remainingBalance <= 0 || data.status === "depleted"

  return (
    <div className="min-h-screen bg-neutral-950 text-white py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
          <Link
            href="/gift-voucher"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Gift Vouchers
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-400 uppercase tracking-widest font-mono">
              {data.voucherId}
            </span>
            <Badge
              variant={isDepleted ? "secondary" : "default"}
              className={
                isDepleted
                  ? "bg-neutral-800 text-neutral-400 border-neutral-700"
                  : "bg-pink-500/20 text-pink-300 border-pink-500/30"
              }
            >
              {isDepleted ? "Fully Redeemed" : "Active Balance"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Left Column: Digital Voucher Card / Ticket */}
          <div className="md:col-span-5 flex justify-center">
            <VoucherTicket
              details={{
                voucherId: data.voucherId,
                purchaseAmount: data.purchaseAmount,
                remainingBalance: data.remainingBalance,
                recipientName: data.recipientName,
                purchaserName: data.purchaserName,
                message: data.message,
                createdAt: data.createdAt,
              }}
            />
          </div>

          {/* Right Column: Balance Overview & Redemption History */}
          <div className="md:col-span-7 space-y-6">
            {/* Live Balance Card */}
            <Card className="bg-neutral-900 border-neutral-800 text-white overflow-hidden shadow-xl">
              <div className="bg-gradient-to-r from-pink-950/40 via-neutral-900 to-neutral-900 p-6 border-b border-neutral-800/80">
                <p className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
                  Current Remaining Balance
                </p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-3xl sm:text-4xl font-extrabold text-pink-300 tracking-tight">
                    {formatMwk(data.remainingBalance)}
                  </span>
                  <span className="text-sm text-neutral-400">
                    of {formatMwk(data.purchaseAmount)} original
                  </span>
                </div>
              </div>

              <CardContent className="p-6 space-y-4 text-sm text-neutral-300">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-neutral-500 block uppercase">Recipient</span>
                    <strong className="text-neutral-200 text-sm">{data.recipientName}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block uppercase">Purchased By</span>
                    <strong className="text-neutral-200 text-sm">{data.purchaserName}</strong>
                  </div>
                </div>

                {data.message && (
                  <div className="bg-neutral-950/60 rounded-lg p-3 text-xs italic text-pink-200/90 border border-neutral-800">
                    &ldquo;{data.message}&rdquo;
                  </div>
                )}

                <div className="pt-2 flex items-center gap-2 text-xs text-neutral-400">
                  <ShieldCheck className="w-4 h-4 text-pink-400 shrink-0" />
                  <span>Verified studio gift voucher with live real-time balance tracking.</span>
                </div>
              </CardContent>
            </Card>

            {/* Redemption History Log */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-pink-400" />
                  Redemption History
                </h2>
                <span className="text-xs text-neutral-400">
                  {data.redemptions.length} {data.redemptions.length === 1 ? "entry" : "entries"}
                </span>
              </div>

              {data.redemptions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-800 p-8 text-center text-neutral-500 text-sm">
                  <Gift className="w-8 h-8 mx-auto mb-2 text-neutral-600" />
                  No redemptions logged yet. This voucher is intact!
                </div>
              ) : (
                <div className="space-y-3">
                  {data.redemptions.map((redemption) => (
                    <div
                      key={redemption.id}
                      className="rounded-xl bg-neutral-900/80 border border-neutral-800/80 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-pink-300">
                          -{formatMwk(redemption.amountDeducted)}
                        </span>
                        <span className="text-xs text-neutral-400">
                          {format(parseISO(redemption.redeemedAt), "dd MMM yyyy, HH:mm")}
                        </span>
                      </div>

                      {redemption.serviceNames && redemption.serviceNames.length > 0 && (
                        <div className="text-xs text-neutral-200">
                          <span className="text-neutral-400">Services: </span>
                          {redemption.serviceNames.join(", ")}
                        </div>
                      )}

                      {redemption.note && (
                        <div className="text-xs text-neutral-400 italic">
                          &ldquo;{redemption.note}&rdquo;
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

