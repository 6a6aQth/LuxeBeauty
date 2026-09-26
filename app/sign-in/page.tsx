"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GoogleAuthButton } from "@/components/google-auth-button"
import { authClient } from "@/lib/auth/client"
import { LuxuryMark } from "@/components/luxury-mark"

export default function SignInPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setPending(true)
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch("/api/account/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Sign-in failed")
      await authClient.getSession()
      router.push("/auth/continue")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="bg-[#faf7f8]">
      <div className="mx-auto max-w-md px-4 py-12 md:py-16">
        <p className="text-xs uppercase tracking-[0.28em] text-brand-pink">Welcome back</p>
        <h1 className="mt-2 font-serif text-4xl text-gray-900">Sign in</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          Continue with Google, or use your email and password.
        </p>

        <div className="mt-8 space-y-5 rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
          <GoogleAuthButton />
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-gray-400">
            <span className="h-px flex-1 bg-gray-200" />
            or
            <span className="h-px flex-1 bg-gray-200" />
          </div>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" className="bg-gray-50" />
            </div>
            {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" className="w-full rounded-lg bg-brand-pink text-white hover:bg-brand-pink/90" disabled={pending}>
              {pending ? <LuxuryMark size="button" tone="ink" /> : null}
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="text-center text-sm text-gray-600">
            New here?{" "}
            <Link href="/sign-up" className="font-medium text-pink-600 hover:text-pink-700">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
