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
import { useState } from "react"

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

function AccountMenu({ signedIn, onNavigate }: { signedIn: boolean; onNavigate?: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function signOut() {
    setOpen(false)
    onNavigate?.()
    await authClient.signOut()
    router.push("/")
    router.refresh()
  }

  if (!signedIn) {
    return (
      <Button asChild variant="outline" className="rounded-lg">
        <Link href="/sign-in" onClick={() => onNavigate?.()}>
          Sign in
        </Link>
      </Button>
    )
  }

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 hover:border-pink-400 hover:text-pink-600"
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
  const { data: session, isPending } = authClient.useSession()
  const signedIn = Boolean(session?.user)

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
              {!isPending && <AccountMenu signedIn={signedIn} />}
              <Button asChild className="rounded-lg">
                <Link href="/booking">Book Appointment</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Navigation */}
        <div className="flex items-center gap-2 md:hidden">
          {!isAdminPage && !isPending && (
            <AccountMenu signedIn={signedIn} onNavigate={() => setIsMobileMenuOpen(false)} />
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
