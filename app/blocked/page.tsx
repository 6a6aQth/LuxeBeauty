"use client"

import { useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { authClient } from "@/lib/auth/client"
import { ShieldAlert } from "lucide-react"

export default function BlockedPage() {
  useEffect(() => {
    // Automatically sign out any active session on the client
    authClient.signOut().catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4 py-16 text-white selection:bg-[#f4c6d4] selection:text-stone-950">
      <div className="relative max-w-lg w-full text-center space-y-8 p-8 sm:p-12 rounded-3xl border border-stone-800/80 bg-stone-900/40 backdrop-blur-md shadow-2xl">
        {/* Soft Pink Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-brand-pink/15 rounded-full blur-3xl pointer-events-none" />

        {/* Studio Mark */}
        <div className="relative flex justify-center">
          <div className="relative w-20 h-20 rounded-full bg-stone-900/80 border border-brand-pink/30 flex items-center justify-center p-3 shadow-inner">
            <Image
              src="/Llogo.png"
              alt="Lauryn Luxe Beauty Studio"
              width={56}
              height={56}
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Block Headline */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-red-500/30 bg-red-950/40 text-red-300 text-xs uppercase tracking-widest">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Account Notice</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-stone-100 tracking-tight leading-tight">
            You Have Been Blocked From Using Lauryn Beauty Studio
          </h1>
          <p className="text-sm sm:text-base text-stone-400 leading-relaxed font-light">
            Your customer profile has been suspended by studio administration. Access to appointments,
            account features, and direct bookings is currently restricted for this account and phone number.
          </p>
        </div>

        <div className="pt-2">
          <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-brand-pink/40 to-transparent" />
        </div>

        {/* Contact/Return Action */}
        <div className="space-y-4 pt-2">
          <p className="text-xs text-stone-500 uppercase tracking-widest">
            Inquiries · Lauryn Luxe Studio Blantyre
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-full border border-stone-700 hover:border-brand-pink text-xs uppercase tracking-[0.2em] text-stone-300 hover:text-white transition duration-200"
          >
            Return to Studio Home
          </Link>
        </div>
      </div>
    </div>
  )
}

