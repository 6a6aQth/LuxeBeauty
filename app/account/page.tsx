"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function AccountPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      const response = await fetch("/api/account/profile")
      if (response.status === 401) {
        router.replace("/sign-in")
        return
      }
      if (response.status === 404) {
        router.replace("/auth/continue")
        return
      }
      const data = await response.json()
      if (!response.ok) {
        if (!cancelled) setError(data.error || "Could not load your account.")
        return
      }
      if (!cancelled) {
        setName(data.name)
        setPhone(data.phone)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router])

  const firstName = name.split(" ")[0]

  return (
    <div className="bg-[#faf7f8]">
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <p className="text-xs uppercase tracking-[0.28em] text-brand-pink">Your studio</p>
        <h1 className="mt-2 font-serif text-4xl text-gray-900">{firstName ? `Hello, ${firstName}` : "Your account"}</h1>
        {phone && <p className="mt-2 text-sm text-gray-500">Visits for {phone}</p>}
        {error && <p className="mt-6 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  )
}
