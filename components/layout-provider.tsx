'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Header from "@/components/header"
import Footer from "@/components/footer"
import WhatsAppButton from "@/components/whatsapp-button"
import { FirstVisitGuide } from "@/components/first-visit-guide"

export default function LayoutProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isAdminLogin = pathname === '/admin'

  if (isAdminLogin) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
      <FirstVisitGuide />
    </div>
  )
} 