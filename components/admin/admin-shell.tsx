"use client"

import { useState, type ReactNode } from "react"
import { LogOut, Menu, X } from "lucide-react"
import { AdminNav, type AdminSectionId } from "@/components/admin/admin-nav"

type AdminShellProps = {
  section: AdminSectionId
  onSectionChange: (section: AdminSectionId) => void
  onLogout: () => void
  children: ReactNode
}

export function AdminShell({ section, onSectionChange, onLogout, children }: AdminShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const choose = (next: AdminSectionId) => {
    onSectionChange(next)
    setMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-[#f6f3ef] text-stone-900">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] overflow-hidden lg:block">
        <AdminNav section={section} onSectionChange={choose} onLogout={onLogout} />
      </aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(100%,320px)] max-w-[86vw] flex-col overflow-hidden shadow-2xl">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-full p-2 text-stone-300 hover:bg-white/10 hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            <AdminNav section={section} onSectionChange={choose} onLogout={onLogout} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[280px]">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200/80 bg-[#f6f3ef]/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-full p-2 text-stone-800 hover:bg-black/5"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="font-serif text-lg tracking-[0.18em]">LAURYN</p>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-full p-2 text-stone-500 hover:bg-black/5 hover:text-stone-900"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">{children}</div>
      </div>
    </div>
  )
}
