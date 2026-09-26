"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { MenuIcon, UserRound } from "lucide-react"
import Logo from "@/components/logo"
import { authClient } from "@/lib/auth/client"
import { useEffect, useRef, useState } from "react"

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/prices", label: "Prices" },
  { href: "/booking", label: "Booking" },
  { href: "/lookup", label: "Reschedule" },
  { href: "/contact", label: "Contact" },
  { href: "/policies", label: "Policies" },
]

function AccountMenu({ signedIn, onNavigate, onSignedOut }: { signedIn: boolean; onNavigate?: () => void; onSignedOut: () => void }) {
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [canHover, setCanHover] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)")
    const update = () => setCanHover(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    if (!open) return
    function closeOnOutside(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", closeOnOutside)
    return () => document.removeEventListener("pointerdown", closeOnOutside)
  }, [open])

  async function signOut() {
    setOpen(false)
    onNavigate?.()
    await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => {})
    await authClient.signOut().catch(() => {})
    onSignedOut()
    router.push("/")
    router.refresh()
  }

  if (!signedIn) {
    return (
      <Button asChild className="rounded-lg bg-brand-pink text-white hover:bg-brand-pink/90">
        <Link href="/sign-in" onClick={() => onNavigate?.()}>
          Sign in
        </Link>
      </Button>
    )
  }

  return (
    <div
      ref={menuRef}
      className="relative"
      onMouseEnter={() => {
        if (canHover) setOpen(true)
      }}
      onMouseLeave={() => {
        if (canHover) setOpen(false)
      }}
    >
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 hover:border-pink-400 hover:text-pink-600"
      >
        <UserRound className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 pt-2">
          <div className="w-40 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
            <Link href="/account" onClick={() => { setOpen(false); onNavigate?.() }} className="block rounded-md px-3 py-2 text-sm font-medium text-gray-800 hover:bg-pink-50 hover:text-pink-600">
              Profile
            </Link>
            <button type="button" onClick={signOut} className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-gray-800 hover:bg-pink-50 hover:text-pink-600">
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const Header = () => {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const response = await fetch("/api/account/profile", { cache: "no-store" })
      if (cancelled) return
      setSignedIn(response.status === 200 || response.status === 404)
      setChecked(true)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [pathname])

  const isAdminPage = pathname.startsWith('/admin')

  return (
    <header id="main-header" className="bg-white shadow-md">
      <div className="container mx-auto px-4 min-h-20 py-2 flex justify-between items-center">
        <Logo />

        {/* Desktop Navigation */}
        {!isAdminPage && (
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-pink-500 ${
                  pathname === link.href
                    ? "text-pink-600 font-bold"
                    : "text-gray-600"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="hidden md:block">
          {isAdminPage ? (
            <div className="flex items-center pr-4">
              <span className="font-semibold text-pink-600">Admin</span>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              {!isAdminPage && checked && (
                <AccountMenu signedIn={signedIn} onSignedOut={() => setSignedIn(false)} />
              )}
              <Button asChild className="rounded-lg">
                <Link href="/booking">Book Appointment</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Navigation */}
        <div className="flex items-center gap-2 md:hidden">
          {!isAdminPage && checked && (
            <AccountMenu signedIn={signedIn} onNavigate={() => setIsMobileMenuOpen(false)} onSignedOut={() => setSignedIn(false)} />
          )}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <MenuIcon className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs bg-white">
              <SheetTitle className="sr-only">Mobile Menu</SheetTitle>
              <SheetDescription className="sr-only">
                A list of navigation links for the website.
              </SheetDescription>
              <div className="flex flex-col h-full">
                <div className="p-6">
                  <Logo />
                </div>
                {!isAdminPage && (
                  <nav className="flex flex-col items-center justify-center flex-1 gap-6 text-lg">
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`font-medium transition-colors hover:text-pink-500 ${
                          pathname === link.href
                            ? "text-pink-600 font-bold"
                            : "text-gray-700"
                        }`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                )}
                <div className="p-6 mt-auto">
                  {isAdminPage ? (
                     <div className="text-center">
                      <span className="font-semibold text-pink-600">Admin Mode</span>
                    </div>
                  ) : (
                    <Button asChild className="w-full rounded-none">
                      <Link href="/booking" onClick={() => setIsMobileMenuOpen(false)}>
                        Book Appointment
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

export default Header
