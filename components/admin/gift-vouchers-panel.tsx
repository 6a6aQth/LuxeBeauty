"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatMwk } from "@/lib/money"
import { format, parseISO } from "date-fns"
import { VoucherTicketFace, downloadVoucherTicketPng } from "@/components/voucher-ticket"
import { Gift, Search, Download, Clock, CheckCircle2, AlertCircle } from "lucide-react"

interface ServiceItem {
  id: string
  name: string
  price: number | null
}

interface RedemptionItem {
  id: string
  amountDeducted: number
  serviceNames: string[]
  note?: string | null
  redeemedAt: string
}

interface GiftVoucherRow {
  id: string
  voucherId: string
  status: string
  purchaseAmount: number
  remainingBalance: number
  recipientName: string
  recipientEmail: string
  purchaserName: string
  message?: string | null
  createdAt: string
  redemptions: RedemptionItem[]
}

export function GiftVouchersPanel({
  adminPassword,
  services,
}: {
  adminPassword: string
  services: ServiceItem[]
}) {
  const [vouchers, setVouchers] = useState<GiftVoucherRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  // Detail / Modal state
  const [selectedVoucher, setSelectedVoucher] = useState<GiftVoucherRow | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isRedeemOpen, setIsRedeemOpen] = useState(false)

  // Redemption Form state
  const [redeemMode, setRedeemMode] = useState<"services" | "amount">("services")
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [customAmount, setCustomAmount] = useState<string>("")
  const [mandatoryNote, setMandatoryNote] = useState<string>("")
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [redeemError, setRedeemError] = useState<string | null>(null)

  const ticketFaceRef = useRef<HTMLDivElement>(null)

  const fetchVouchers = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/gift-vouchers", {
        headers: { "x-admin-password": adminPassword },
      })
      if (!res.ok) {
        throw new Error("Failed to load active gift vouchers.")
      }
      const data = await res.json()
      setVouchers(data)
    } catch (err: any) {
      setError(err.message || "Failed to load vouchers.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVouchers()
  }, [adminPassword])

  const filteredVouchers = vouchers.filter((v) => {
    const q = searchTerm.toLowerCase().trim()
    return (
      v.voucherId.toLowerCase().includes(q) ||
      v.recipientName.toLowerCase().includes(q) ||
      v.purchaserName.toLowerCase().includes(q) ||
      v.recipientEmail.toLowerCase().includes(q)
    )
  })

  // Calculate sum of selected services
  const selectedServicesTotal = selectedServiceIds.reduce((sum, id) => {
    const s = services.find((svc) => svc.id === id)
    return sum + (s?.price || 0)
  }, 0)

  const handleOpenRedeem = () => {
    setRedeemMode("services")
    setSelectedServiceIds([])
    setCustomAmount("")
    setMandatoryNote("")
    setRedeemError(null)
    setIsRedeemOpen(true)
  }

  const handleExecuteRedemption = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVoucher) return
    setRedeemError(null)

    const amountToDeduct =
      redeemMode === "services" ? selectedServicesTotal : parseInt(customAmount || "0", 10)

    if (amountToDeduct <= 0) {
      setRedeemError("Redemption amount must be greater than zero.")
      return
    }

    if (amountToDeduct > selectedVoucher.remainingBalance) {
      setRedeemError(
        `Deduction amount (${formatMwk(amountToDeduct)}) exceeds remaining balance (${formatMwk(
          selectedVoucher.remainingBalance
        )}).`
      )
      return
    }

    if (redeemMode === "amount" && !mandatoryNote.trim()) {
      setRedeemError("A mandatory note is required for custom amount redemptions.")
      return
    }

    try {
      setIsRedeeming(true)
      const payload: any = {
        adminPassword,
        note: mandatoryNote.trim() || undefined,
      }

      if (redeemMode === "services") {
        payload.serviceIds = selectedServiceIds
      } else {
        payload.amount = amountToDeduct
      }

      const res = await fetch(`/api/admin/gift-vouchers/${selectedVoucher.voucherId}/redeem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to redeem against voucher.")
      }

      // Update local state
      setSelectedVoucher(data.voucher)
      setVouchers((prev) =>
        prev.map((v) => (v.id === data.voucher.id ? data.voucher : v))
      )
      setIsRedeemOpen(false)
    } catch (err: any) {
      setRedeemError(err.message || "Failed to process redemption.")
    } finally {
      setIsRedeeming(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif tracking-tight text-stone-900">
            Gift Vouchers
          </h2>
          <p className="text-sm text-stone-500">
            Active gift vouchers with remaining credit. Manage live balances and execute redemptions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search by ID, name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white border-stone-200 text-sm h-9 w-[220px]"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchVouchers}
            className="border-stone-300 text-stone-700 hover:bg-stone-100"
          >
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-stone-500">Loading active vouchers...</div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      ) : filteredVouchers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center text-stone-500 text-sm">
          <Gift className="w-8 h-8 mx-auto mb-2 text-stone-400" />
          No active vouchers found.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-stone-600">
              <thead className="bg-stone-50/80 text-xs uppercase tracking-wider text-stone-400 border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Voucher ID</th>
                  <th className="py-3 px-4 font-semibold">Recipient</th>
                  <th className="py-3 px-4 font-semibold">Original Amount</th>
                  <th className="py-3 px-4 font-semibold">Remaining Balance</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredVouchers.map((voucher) => (
                  <tr key={voucher.id} className="hover:bg-stone-50/60 transition">
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">
                      {voucher.voucherId}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-stone-900">{voucher.recipientName}</div>
                      <div className="text-xs text-stone-400">{voucher.recipientEmail}</div>
                    </td>
                    <td className="py-3 px-4 text-stone-600">
                      {formatMwk(voucher.purchaseAmount)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-emerald-700">
                        {formatMwk(voucher.remainingBalance)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedVoucher(voucher)
                          setIsDetailOpen(true)
                        }}
                        className="border-stone-300 text-stone-700 hover:bg-stone-100 text-xs h-8"
                      >
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Voucher Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedVoucher && (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex items-center justify-between gap-4">
                  <DialogTitle className="font-serif text-xl flex items-center gap-2">
                    <Gift className="w-5 h-5 text-pink-600" />
                    Voucher {selectedVoucher.voucherId}
                  </DialogTitle>
                  <Badge className="bg-pink-100 text-pink-800 border-pink-200">
                    Remaining: {formatMwk(selectedVoucher.remainingBalance)}
                  </Badge>
                </div>
                <DialogDescription>
                  Purchased by {selectedVoucher.purchaserName} on{" "}
                  {format(parseISO(selectedVoucher.createdAt), "dd MMM yyyy")}
                </DialogDescription>
              </DialogHeader>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="text-[10px] uppercase tracking-wider text-stone-400 block font-semibold">
                    Original
                  </span>
                  <strong className="text-stone-900 text-sm">
                    {formatMwk(selectedVoucher.purchaseAmount)}
                  </strong>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <span className="text-[10px] uppercase tracking-wider text-emerald-600 block font-semibold">
                    Remaining
                  </span>
                  <strong className="text-emerald-800 text-sm">
                    {formatMwk(selectedVoucher.remainingBalance)}
                  </strong>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="text-[10px] uppercase tracking-wider text-stone-400 block font-semibold">
                    Recipient
                  </span>
                  <strong className="text-stone-900 text-sm truncate block">
                    {selectedVoucher.recipientName}
                  </strong>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="text-[10px] uppercase tracking-wider text-stone-400 block font-semibold">
                    Redemptions
                  </span>
                  <strong className="text-stone-900 text-sm">
                    {selectedVoucher.redemptions.length}
                  </strong>
                </div>
              </div>

              {selectedVoucher.message && (
                <div className="p-3 bg-stone-50 rounded-xl text-xs italic text-stone-600 border border-stone-200">
                  &ldquo;{selectedVoucher.message}&rdquo;
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  onClick={handleOpenRedeem}
                  disabled={selectedVoucher.remainingBalance <= 0}
                  className="bg-black hover:bg-stone-800 text-white font-medium text-xs h-9"
                >
                  Redeem Against Voucher
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    if (ticketFaceRef.current) {
                      downloadVoucherTicketPng(ticketFaceRef.current, selectedVoucher.voucherId)
                    }
                  }}
                  className="border-stone-300 text-stone-700 hover:bg-stone-100 text-xs h-9 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Ticket PNG
                </Button>
              </div>

              {/* Hidden Ticket for PNG rendering */}
              <div className="hidden">
                <VoucherTicketFace
                  ref={ticketFaceRef}
                  details={{
                    voucherId: selectedVoucher.voucherId,
                    purchaseAmount: selectedVoucher.purchaseAmount,
                    remainingBalance: selectedVoucher.remainingBalance,
                    recipientName: selectedVoucher.recipientName,
                    purchaserName: selectedVoucher.purchaserName,
                    message: selectedVoucher.message,
                    createdAt: selectedVoucher.createdAt,
                  }}
                />
              </div>

              {/* Full Redemption Log */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-stone-500" />
                  Redemption History Log
                </h3>

                {selectedVoucher.redemptions.length === 0 ? (
                  <p className="text-xs text-stone-400 italic">No redemptions logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedVoucher.redemptions.map((r) => (
                      <div
                        key={r.id}
                        className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-red-700">
                            -{formatMwk(r.amountDeducted)}
                          </span>
                          <span className="text-stone-400">
                            {format(parseISO(r.redeemedAt), "dd MMM yyyy, HH:mm")}
                          </span>
                        </div>
                        {r.serviceNames && r.serviceNames.length > 0 && (
                          <div className="text-stone-700">
                            <span className="text-stone-400">Services: </span>
                            {r.serviceNames.join(", ")}
                          </div>
                        )}
                        {r.note && (
                          <div className="text-stone-500 italic">&ldquo;{r.note}&rdquo;</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Redemption Execution Dialog */}
      <Dialog open={isRedeemOpen} onOpenChange={setIsRedeemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">
              Redeem Voucher {selectedVoucher?.voucherId}
            </DialogTitle>
            <DialogDescription>
              Available Balance:{" "}
              <strong className="text-stone-900 font-semibold">
                {selectedVoucher ? formatMwk(selectedVoucher.remainingBalance) : ""}
              </strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleExecuteRedemption} className="space-y-4 pt-2">
            {/* Mode switch */}
            <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setRedeemMode("services")}
                className={`text-xs py-2 rounded-lg font-medium transition ${
                  redeemMode === "services"
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-900"
                }`}
              >
                Pick Services
              </button>
              <button
                type="button"
                onClick={() => setRedeemMode("amount")}
                className={`text-xs py-2 rounded-lg font-medium transition ${
                  redeemMode === "amount"
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-900"
                }`}
              >
                Custom Amount
              </button>
            </div>

            {redeemMode === "services" ? (
              <div className="space-y-2">
                <Label className="text-xs uppercase text-stone-500 font-semibold">
                  Select Services to Deduct
                </Label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-stone-200 rounded-xl p-2 bg-stone-50/50">
                  {services
                    .filter((s) => s.price && s.price > 0)
                    .map((svc) => {
                      const isChecked = selectedServiceIds.includes(svc.id)
                      return (
                        <label
                          key={svc.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-white text-xs cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedServiceIds((prev) => [...prev, svc.id])
                                } else {
                                  setSelectedServiceIds((prev) =>
                                    prev.filter((id) => id !== svc.id)
                                  )
                                }
                              }}
                              className="rounded border-stone-300 text-pink-600 focus:ring-pink-500"
                            />
                            <span className="font-medium text-stone-800">{svc.name}</span>
                          </div>
                          <span className="text-stone-500 font-mono">
                            {formatMwk(svc.price || 0)}
                          </span>
                        </label>
                      )
                    })}
                </div>
                <div className="flex justify-between items-center text-xs px-1">
                  <span className="text-stone-500">Selected total:</span>
                  <span className="font-bold text-stone-900 font-mono">
                    {formatMwk(selectedServicesTotal)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="customAmt" className="text-xs uppercase text-stone-500 font-semibold">
                    Deduction Amount (MWK) *
                  </Label>
                  <Input
                    id="customAmt"
                    type="number"
                    min={1}
                    max={selectedVoucher?.remainingBalance}
                    placeholder="e.g. 25000"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    required
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="note" className="text-xs uppercase text-stone-500 font-semibold">
                    Mandatory Reason Note *
                  </Label>
                  <Textarea
                    id="note"
                    placeholder="Reason for custom deduction (e.g. Nail repair + custom cuticle treatment)"
                    rows={2}
                    value={mandatoryNote}
                    onChange={(e) => setMandatoryNote(e.target.value)}
                    required
                    className="text-xs resize-none"
                  />
                </div>
              </div>
            )}

            {redeemError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{redeemError}</span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRedeemOpen(false)}
                className="text-xs border-stone-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isRedeeming}
                className="bg-black hover:bg-stone-800 text-white text-xs"
              >
                {isRedeeming ? "Redeeming..." : "Confirm Deduction"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

