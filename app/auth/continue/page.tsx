"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { canonicalPhone, sanitizePhoneInput } from "@/lib/phone"
import { authClient } from "@/lib/auth/client"
import { LuxuryMark } from "@/components/luxury-mark"

const EMAIL_ALREADY_HAS_ACCOUNT = "email_already_has_account"

export default function ContinuePage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [ready, setReady] = useState(false)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const response = await fetch("/api/account/profile")
      if (cancelled) return
      if (response.ok) {
        router.replace("/account")
        return
      }
      if (response.status === 409) {
        const data = await response.json().catch(() => ({}))
        if (data.code === EMAIL_ALREADY_HAS_ACCOUNT) {
          await authClient.signOut().catch(() => {})
          if (!cancelled) {
            setError(data.error || "This email already has an account.")
            setBlocked(true)
            setReady(true)
          }
          router.refresh()
          return
        }
      }
      if (response.status === 404) {
        const data = await response.json().catch(() => ({}))
        if (!cancelled) {
          setName(data.suggested?.name || "")
          setEmail(data.suggested?.email || "")
          setReady(true)
        }
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
    if (!name.trim() || !email.trim() || !canonicalPhone(phone)) {
      setError("Name, email, and a valid phone number are required.")
      return
    }
    setPending(true)
    try {
      const response = await fetch("/api/account/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone }),
      })
      const data = await response.json()
      if (response.status === 409 && data.code === EMAIL_ALREADY_HAS_ACCOUNT) {
        await authClient.signOut().catch(() => {})
        setError(data.error || "This email already has an account.")
        setBlocked(true)
        router.refresh()
        return
      }
      if (!response.ok) throw new Error(data.error || "Could not save your details.")
      router.replace("/account")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your details.")
    } finally {
      setPending(false)
    }
  }

  if (!ready) {
    return <LuxuryMark variant="page" label="Finishing sign-in…" />
  }

  return (
    <div className="bg-[#faf7f8]">
      <div className="mx-auto max-w-md px-4 py-12 md:py-16">
        <p className="text-xs uppercase tracking-[0.28em] text-brand-pink">{blocked ? "Already registered" : "One more step"}</p>
        <h1 className="mt-2 font-serif text-4xl text-gray-900">{blocked ? "This email already has an account" : "Your studio details"}</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          {blocked
            ? "Sign in with the password for this email."
            : "Confirm the name and email for this account, and add the phone number your visits use."}
        </p>
        {blocked ? (
          <div className="mt-8 space-y-5 rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
            {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Link href="/sign-in" className="inline-flex text-sm font-medium text-pink-600 hover:text-pink-700">
              Back to sign in
            </Link>
          </div>
        ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="bg-gray-50" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="bg-gray-50" />
          </div>
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
            {pending ? <LuxuryMark size="button" tone="ink" /> : null}
            {pending ? "Saving…" : "Continue"}
          </Button>
        </form>
        )}
      </div>
    </div>
  )
}
