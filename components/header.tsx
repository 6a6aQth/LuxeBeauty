"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { MenuIcon } from "lucide-react"
import Logo from "@/components/logo"
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

const Header = () => {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
            <Button asChild className="rounded-none">
              <Link href="/booking">Book Appointment</Link>
            </Button>
          )}
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden">
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
