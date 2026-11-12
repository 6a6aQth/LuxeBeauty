"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LuxuryMark } from "@/components/luxury-mark"
import { VoucherTicket } from "@/components/voucher-ticket"
import { formatMwk } from "@/lib/money"
import { Gift, Search, CreditCard, Building2, Smartphone, CheckCircle2, AlertCircle } from "lucide-react"

const MIN_AMOUNT = 100_000

export default function GiftVoucherHubPage() {
  const router = useRouter()

  // Form states
  const [recipientName, setRecipientName] = useState("")
  const [recipientEmail, setRecipientEmail] = useState("")
  const [purchaserName, setPurchaserName] = useState("")
  const [message, setMessage] = useState("")
  const [amount, setAmount] = useState<number>(MIN_AMOUNT)
  const [operator, setOperator] = useState<"tnm" | "airtel" | "bank">("tnm")
  const [mobile, setMobile] = useState("")

  // Flow & Payment states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  // Pending payment state
  const [paymentState, setPaymentState] = useState<{
    voucherId: string
    chargeId: string
    method: string
    amount: number
    account?: { bank: string; name: string; number: string }
  } | null>(null)

  const [verifying, setVerifying] = useState(false)
  const [confirmedVoucher, setConfirmedVoucher] = useState<any | null>(null)

  // Lookup state
  const [lookupId, setLookupId] = useState("")

  const handleStartPurchase = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (amount < MIN_AMOUNT) {
      setErrorMsg(`Minimum gift voucher amount is ${formatMwk(MIN_AMOUNT)}.`)
      return
    }

    if (operator !== "bank" && !mobile) {
      setErrorMsg("Please provide your mobile money phone number.")
      return
    }

    try {
      setIsSubmitting(true)
      const res = await fetch("/api/gift-vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          recipientName,
          recipientEmail,
          purchaserName,
          message,
          operator,
          mobile: operator !== "bank" ? mobile : undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to initialize voucher purchase.")
      }

      setPaymentState(json)

      // Start polling if mobile money
      if (json.method !== "bank_transfer") {
        pollVerification(json.chargeId)
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const pollVerification = async (chargeId: string, attempts = 0) => {
    if (attempts > 30) return // Stop after ~2.5 mins
    try {
      const res = await fetch("/api/gift-vouchers/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeId }),
      })
      const data = await res.json()
      if (data.status === "active" && data.voucher) {
        setConfirmedVoucher(data.voucher)
        return
      }
      if (data.status === "failed") {
        setErrorMsg("Payment was declined or timed out. Please try again.")
        setPaymentState(null)
        return
      }
      setTimeout(() => pollVerification(chargeId, attempts + 1), 5000)
    } catch {
      setTimeout(() => pollVerification(chargeId, attempts + 1), 5000)
    }
  }

  const handleManualVerify = async () => {
    if (!paymentState?.chargeId) return
    setVerifying(true)
    setErrorMsg(null)
    try {
      const res = await fetch("/api/gift-vouchers/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeId: paymentState.chargeId }),
      })
      const data = await res.json()
      if (data.status === "active" && data.voucher) {
        setConfirmedVoucher(data.voucher)
      } else {
        setErrorMsg(data.message || "Payment has not yet been detected. Please ensure transfer is complete and click verify again.")
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Verification failed.")
    } finally {
      setVerifying(false)
    }
  }

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault()
    if (!lookupId.trim()) return
    router.push(`/gift-voucher/${lookupId.trim().toUpperCase()}`)
  }

  return (
    <div className="min-h-screen bg-black text-white py-14 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-semibold uppercase tracking-wider">
            <Gift className="w-3.5 h-3.5" />
            Lauryn Luxe Studio
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Gift Vouchers</h1>
          <p className="text-neutral-400 text-sm max-w-lg mx-auto">
            Give the ultimate experience of luxury, nails, and beauty. Purchase an official studio voucher or check an existing balance.
          </p>
        </div>

        {confirmedVoucher ? (
          <div className="space-y-6 text-center">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Voucher Confirmed & Issued!</h2>
                <p className="text-neutral-400 text-sm mt-1">
                  We have dispatched the official voucher details and QR code to{" "}
                  <span className="text-white font-medium">{confirmedVoucher.recipientEmail}</span>.
                </p>
              </div>

              <div className="flex justify-center pt-2">
                <VoucherTicket
                  details={{
                    voucherId: confirmedVoucher.voucherId,
                    purchaseAmount: confirmedVoucher.purchaseAmount,
                    recipientName: confirmedVoucher.recipientName,
                    purchaserName: confirmedVoucher.purchaserName,
                    message: confirmedVoucher.message,
                    createdAt: confirmedVoucher.createdAt,
                  }}
                />
              </div>

              <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
                <Button
                  onClick={() => router.push(`/gift-voucher/${confirmedVoucher.voucherId}`)}
                  className="bg-white text-black hover:bg-neutral-200"
                >
                  View Public Live Balance Page
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmedVoucher(null)
                    setPaymentState(null)
                  }}
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                >
                  Buy Another Voucher
                </Button>
              </div>
            </div>
          </div>
        ) : paymentState ? (
          /* Payment Processing Screen */
          <Card className="bg-neutral-900 border-neutral-800 text-white">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Complete Your Voucher Payment</CardTitle>
              <CardDescription className="text-neutral-400">
                Voucher ID: <span className="text-pink-300 font-mono font-bold">{paymentState.voucherId}</span> • Total: {formatMwk(paymentState.amount)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {paymentState.method === "bank_transfer" ? (
                <div className="space-y-4">
                  <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 text-sm space-y-2">
                    <p className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Bank Transfer Instructions</p>
                    <div className="flex justify-between py-1 border-b border-neutral-800">
                      <span className="text-neutral-400">Bank Name</span>
                      <strong className="text-white">{paymentState.account?.bank || "Standard Bank / National Bank"}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-neutral-800">
                      <span className="text-neutral-400">Account Name</span>
                      <strong className="text-white">{paymentState.account?.name || "LaurynStudio"}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-neutral-800">
                      <span className="text-neutral-400">Account Number</span>
                      <strong className="text-pink-300 font-mono text-base">{paymentState.account?.number}</strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-neutral-400">Exact Amount</span>
                      <strong className="text-white">{formatMwk(paymentState.amount)}</strong>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-400 text-center">
                    Transfer the exact amount using your banking app, then click the button below to verify.
                  </p>

                  <Button
                    onClick={handleManualVerify}
                    disabled={verifying}
                    className="w-full bg-pink-500 hover:bg-pink-600 text-white font-semibold py-6"
                  >
                    {verifying ? "Checking Transfer Details..." : "Verify Payment & Generate Voucher"}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6 space-y-4">
                  <LuxuryMark size="sm" label="Awaiting Mobile Money Prompt Approval..." />
                  <p className="text-sm text-neutral-400 max-w-sm mx-auto">
                    Please check your phone for the USSD PIN prompt to approve {formatMwk(paymentState.amount)}. This screen will update automatically once verified.
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleManualVerify}
                    disabled={verifying}
                    className="border-neutral-700 text-neutral-300 text-xs"
                  >
                    {verifying ? "Checking..." : "I have approved the prompt"}
                  </Button>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-red-950/40 border border-red-800/80 rounded-xl text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <Button
                variant="ghost"
                onClick={() => setPaymentState(null)}
                className="w-full text-xs text-neutral-500 hover:text-neutral-400"
              >
                Cancel and Start Over
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Tabs: Buy or Lookup */
          <Tabs defaultValue="buy" className="w-full">
            <TabsList className="grid grid-cols-2 w-full bg-neutral-900 border border-neutral-800 p-1 rounded-xl">
              <TabsTrigger value="buy" className="data-[state=active]:bg-neutral-800 text-sm font-medium">
                Buy a Voucher
              </TabsTrigger>
              <TabsTrigger value="lookup" className="data-[state=active]:bg-neutral-800 text-sm font-medium">
                Look Up Voucher
              </TabsTrigger>
            </TabsList>

            <TabsContent value="buy" className="mt-6">
              <Card className="bg-neutral-900 border-neutral-800 text-white">
                <CardHeader>
                  <CardTitle className="text-xl">Purchaser & Recipient Details</CardTitle>
                  <CardDescription className="text-neutral-400">
                    Prepaid credit starting at {formatMwk(MIN_AMOUNT)}. The recipient can redeem this against any studio service.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleStartPurchase} className="space-y-5">
                    {/* Amount */}
                    <div className="space-y-2">
                      <Label htmlFor="amount" className="text-xs uppercase tracking-wider text-neutral-400">
                        Voucher Amount (MWK) *
                      </Label>
                      <Input
                        id="amount"
                        type="number"
                        min={MIN_AMOUNT}
                        step={5000}
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        required
                        className="bg-neutral-950 border-neutral-800 text-white text-lg font-semibold"
                      />
                      <div className="flex gap-2 pt-1">
                        {[100_000, 150_000, 200_000, 300_000].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setAmount(preset)}
                            className={`text-xs px-2.5 py-1 rounded-md border transition ${
                              amount === preset
                                ? "bg-pink-500/20 border-pink-500/40 text-pink-300"
                                : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                            }`}
                          >
                            {formatMwk(preset)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Recipient Name */}
                      <div className="space-y-2">
                        <Label htmlFor="recipientName" className="text-xs uppercase tracking-wider text-neutral-400">
                          Recipient Name *
                        </Label>
                        <Input
                          id="recipientName"
                          placeholder="Lucky person's name"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          required
                          className="bg-neutral-950 border-neutral-800 text-white"
                        />
                      </div>

                      {/* Recipient Email */}
                      <div className="space-y-2">
                        <Label htmlFor="recipientEmail" className="text-xs uppercase tracking-wider text-neutral-400">
                          Recipient Email *
                        </Label>
                        <Input
                          id="recipientEmail"
                          type="email"
                          placeholder="recipient@example.com"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          required
                          className="bg-neutral-950 border-neutral-800 text-white"
                        />
                      </div>
                    </div>

                    {/* Purchaser Name */}
                    <div className="space-y-2">
                      <Label htmlFor="purchaserName" className="text-xs uppercase tracking-wider text-neutral-400">
                        Your Name (Purchaser) *
                      </Label>
                      <Input
                        id="purchaserName"
                        placeholder="Your full name"
                        value={purchaserName}
                        onChange={(e) => setPurchaserName(e.target.value)}
                        required
                        className="bg-neutral-950 border-neutral-800 text-white"
                      />
                    </div>

                    {/* Optional Message */}
                    <div className="space-y-2">
                      <Label htmlFor="message" className="text-xs uppercase tracking-wider text-neutral-400">
                        Personal Message (Optional)
                      </Label>
                      <Textarea
                        id="message"
                        placeholder="Happy Birthday! Enjoy your luxury nail appointment on me ✨"
                        rows={3}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="bg-neutral-950 border-neutral-800 text-white resize-none"
                      />
                    </div>

                    {/* Payment Rail Selection */}
                    <div className="space-y-3 pt-2">
                      <Label className="text-xs uppercase tracking-wider text-neutral-400">
                        Select Payment Rail *
                      </Label>
                      <div className="grid grid-cols-3 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setOperator("tnm")}
                          className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1.5 transition ${
                            operator === "tnm"
                              ? "bg-pink-500/10 border-pink-500 text-white"
                              : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                          }`}
                        >
                          <Smartphone className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-semibold">TNM Mpamba</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setOperator("airtel")}
                          className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1.5 transition ${
                            operator === "airtel"
                              ? "bg-pink-500/10 border-pink-500 text-white"
                              : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                          }`}
                        >
                          <Smartphone className="w-4 h-4 text-red-400" />
                          <span className="text-xs font-semibold">Airtel Money</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setOperator("bank")}
                          className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1.5 transition ${
                            operator === "bank"
                              ? "bg-pink-500/10 border-pink-500 text-white"
                              : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                          }`}
                        >
                          <Building2 className="w-4 h-4 text-blue-400" />
                          <span className="text-xs font-semibold">Bank Transfer</span>
                        </button>
                      </div>
                    </div>

                    {operator !== "bank" && (
                      <div className="space-y-2">
                        <Label htmlFor="mobile" className="text-xs uppercase tracking-wider text-neutral-400">
                          {operator === "tnm" ? "TNM Mpamba Number (08...)" : "Airtel Money Number (09...)"} *
                        </Label>
                        <Input
                          id="mobile"
                          type="tel"
                          placeholder={operator === "tnm" ? "0881234567" : "0991234567"}
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value)}
                          required
                          className="bg-neutral-950 border-neutral-800 text-white"
                        />
                      </div>
                    )}

                    {errorMsg && (
                      <div className="p-3 bg-red-950/40 border border-red-800/80 rounded-xl text-red-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-pink-500 hover:bg-pink-600 text-white font-semibold py-6 text-base"
                    >
                      {isSubmitting ? "Initializing Payment..." : `Proceed to Pay ${formatMwk(amount)}`}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lookup" className="mt-6">
              <Card className="bg-neutral-900 border-neutral-800 text-white">
                <CardHeader>
                  <CardTitle className="text-xl">Voucher Balance & Redemption Lookup</CardTitle>
                  <CardDescription className="text-neutral-400">
                    Enter any official studio Voucher ID (e.g. LB-A4K89Z) to inspect remaining balance and past redemptions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLookup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="lookupId" className="text-xs uppercase tracking-wider text-neutral-400">
                        Voucher ID *
                      </Label>
                      <Input
                        id="lookupId"
                        placeholder="LB-XXXXXX"
                        value={lookupId}
                        onChange={(e) => setLookupId(e.target.value.toUpperCase())}
                        required
                        className="bg-neutral-950 border-neutral-800 text-white font-mono tracking-widest text-lg"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-white text-black hover:bg-neutral-200 font-semibold"
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Look Up Voucher
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}

