"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { canonicalPhone, sanitizePhoneInput } from "@/lib/phone"

export default function ContinuePage() {
  const router = useRouter()
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const response = await fetch("/api/account/profile")
      if (cancelled) return
      if (response.ok || response.status === 404) {
        if (response.ok) {
          router.replace("/account")
          return
        }
        setReady(true)
        return
      }
      if (response.status === 401) {
        router.replace("/sign-in")
        return
      }
      const data = await response.json().catch(() => ({}))
      setError(data.error || "Could not finish sign-in.")
      setReady(true)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (!canonicalPhone(phone)) {
      setError("That phone number format is not okay.")
      return
    }
    setPending(true)
    try {
      const response = await fetch("/api/account/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not save your phone.")
      router.replace("/account")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your phone.")
    } finally {
      setPending(false)
    }
  }

  if (!ready) {
    return <p className="px-4 py-16 text-center text-sm text-gray-500">Finishing sign-in…</p>
  }

  return (
    <div className="bg-[#faf7f8]">
      <div className="mx-auto max-w-md px-4 py-12 md:py-16">
        <p className="text-xs uppercase tracking-[0.28em] text-brand-pink">One more step</p>
        <h1 className="mt-2 font-serif text-4xl text-gray-900">Your phone number</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          Google does not give us the number you book with. Visits and loyalty use that phone.
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              required
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(sanitizePhoneInput(event.target.value))}
              className="bg-gray-50"
            />
          </div>
          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full rounded-lg bg-brand-pink text-white hover:bg-brand-pink/90" disabled={pending}>
            {pending ? "Saving…" : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  )
}
