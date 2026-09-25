"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { CalendarDays, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BookingTicket } from "@/components/booking-ticket"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatTime } from "@/lib/time-slots"
import { Service } from "@/types/types"

type Visit = {
  id: string
  ticketId: string
  name: string
  date: string
  timeSlot: string
  services: string[]
  discountApplied: boolean
  rescheduleCount: number
  originalDate: string | null
}

type VisitsPayload = {
  name: string
  phone: string
  loyalty: {
    copy: string
    successfulCount: number
    nextVisitIsDiscount: boolean
  }
  upcoming: Visit[]
  past: Visit[]
}

function visitDate(date: string) {
  const parsed = parseISO(date)
  if (Number.isNaN(parsed.getTime())) return date
  return format(parsed, "EEEE, MMMM d, yyyy")
}

export default function AccountPage() {
  const router = useRouter()
  const [payload, setPayload] = useState<VisitsPayload | null>(null)
  const [error, setError] = useState("")
  const [openTicket, setOpenTicket] = useState<Visit | null>(null)
  const [services, setServices] = useState<Service[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const response = await fetch("/api/account/visits")
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
      if (!cancelled) setPayload(data)
      const servicesResponse = await fetch("/api/services")
      if (servicesResponse.ok && !cancelled) setServices(await servicesResponse.json())
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router])

  function serviceNames(ids: string[]) {
    return ids.map((id) => services.find((service) => service.id === id)?.name || id)
  }

  const firstName = payload?.name.split(" ")[0] || ""
  const filled = (payload?.loyalty.successfulCount ?? 0) % 6

  return (
    <div className="min-h-[70vh] bg-[#faf7f8]">
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <p className="text-xs uppercase tracking-[0.28em] text-brand-pink">Your studio</p>
        <h1 className="mt-2 font-serif text-4xl text-gray-900 md:text-5xl">
          {firstName ? `Hello, ${firstName}` : "Your account"}
        </h1>
        {payload && <p className="mt-2 text-sm text-gray-500">Visits for {payload.phone}</p>}

        {error && (
          <p className="mt-8 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}
        {!payload && !error && <p className="mt-10 text-sm text-gray-500">Loading your visits…</p>}

        {payload && (
          <div className="mt-10 grid gap-8 lg:grid-cols-[280px_1fr]">
            <aside className="h-fit rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-brand-pink">
                <Sparkles className="h-4 w-4" />
                <p className="text-xs uppercase tracking-[0.22em]">Loyalty</p>
              </div>
              <p className="mt-4 font-serif text-2xl leading-snug text-gray-900">{payload.loyalty.copy}</p>
              <p className="mt-2 text-sm text-gray-500">
                {payload.loyalty.successfulCount} successful {payload.loyalty.successfulCount === 1 ? "visit" : "visits"} on this phone.
              </p>
              <div className="mt-6 grid grid-cols-6 gap-2">
                {Array.from({ length: 6 }, (_, index) => {
                  const done = index < filled
                  const reward = index === 5
                  return (
                    <div key={index} className="flex flex-col items-center gap-1">
                      <span
                        className={`h-8 w-8 rounded-full border ${
                          done
                            ? "border-brand-pink bg-brand-pink"
                            : reward
                              ? "border-brand-pink bg-pink-50"
                              : "border-gray-200 bg-white"
                        }`}
                      />
                      {reward && <span className="text-[10px] font-medium text-brand-pink">30%</span>}
                    </div>
                  )
                })}
              </div>
            </aside>

            <div className="space-y-10">
              <section>
                <h2 className="font-serif text-3xl text-gray-900">Upcoming</h2>
                {payload.upcoming.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-pink-200 bg-white px-6 py-10 text-center">
                    <CalendarDays className="mx-auto h-6 w-6 text-brand-pink" />
                    <p className="mt-3 font-medium text-gray-800">No upcoming visits</p>
                    <p className="mt-1 text-sm text-gray-500">Your next appointment shows here after payment.</p>
                  </div>
                ) : (
                  <ul className="mt-4 space-y-4">
                    {payload.upcoming.map((visit) => (
                      <li key={visit.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                        <p className="font-serif text-xl text-gray-900">{visitDate(visit.date)}</p>
                        <p className="mt-1 text-sm text-gray-600">{formatTime(visit.timeSlot)}</p>
                        <p className="mt-3 text-sm text-gray-800">{serviceNames(visit.services).join(", ") || "Services on file"}</p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Button className="rounded-lg" onClick={() => setOpenTicket(visit)}>View ticket</Button>
                          {visit.rescheduleCount < 1 && (
                            <Button asChild variant="outline" className="rounded-lg">
                              <Link href={`/reschedule?ticketId=${encodeURIComponent(visit.ticketId)}&source=account`}>
                                Reschedule
                              </Link>
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h2 className="font-serif text-3xl text-gray-900">Past</h2>
                {payload.past.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">No past visits yet.</p>
                ) : (
                  <ul className="mt-4 divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white">
                    {[...payload.past].reverse().map((visit) => (
                      <li key={visit.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{visitDate(visit.date)}</p>
                          <p className="text-sm text-gray-500">{formatTime(visit.timeSlot)}</p>
                        </div>
                        <p className="text-sm text-gray-600">{serviceNames(visit.services).join(", ")}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
      </div>

      <Dialog open={Boolean(openTicket)} onOpenChange={(open) => !open && setOpenTicket(null)}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-0 bg-gray-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Your ticket</DialogTitle>
            <DialogDescription>Show this at the studio, or download a copy.</DialogDescription>
          </DialogHeader>
          {openTicket && (
            <BookingTicket
              details={{
                name: openTicket.name,
                date: openTicket.date,
                timeSlot: openTicket.timeSlot,
                services: openTicket.services,
                fee: openTicket.rescheduleCount > 0 ? "Rescheduled - No Additional Charge" : "K10,000 (Paid)",
                ticketId: openTicket.ticketId,
                discountApplied: openTicket.discountApplied,
                isReschedule: openTicket.rescheduleCount > 0,
                originalDate: openTicket.originalDate,
              }}
              serviceNames={serviceNames(openTicket.services)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
