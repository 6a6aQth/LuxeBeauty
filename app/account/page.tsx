"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { Button } from "@/components/ui/button"
import { TicketFace, downloadTicketPng, TicketDetails } from "@/components/booking-ticket"
import { formatTime } from "@/lib/time-slots"

type Visit = {
  id: string
  ticketId: string
  name: string
  date: string
  timeSlot: string
  services: string[]
  serviceNames: string[]
  discountApplied: boolean
  rescheduleCount: number
  originalDate: string | null
}

type VisitsPayload = {
  name: string
  phone: string
  pastTotal: number
  pastHasMore: boolean
  loyalty: {
    copy: string
    successfulCount: number
    visitsUntilDiscount: number
  }
  upcoming: Visit[]
  past: Visit[]
}

function dayParts(date: string) {
  const parsed = parseISO(date)
  if (Number.isNaN(parsed.getTime())) return { month: "", day: date, weekday: "" }
  return {
    month: format(parsed, "MMM"),
    day: format(parsed, "d"),
    weekday: format(parsed, "EEEE"),
    full: format(parsed, "MMMM d, yyyy"),
  }
}

function ServiceChips({ names }: { names: string[] }) {
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {names.map((name, index) => (
        <li key={`${name}-${index}`} className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-xs tracking-wide text-pink-900">
          {name}
        </li>
      ))}
    </ul>
  )
}

export default function AccountPage() {
  const router = useRouter()
  const [payload, setPayload] = useState<VisitsPayload | null>(null)
  const [error, setError] = useState("")
  const [pastPage, setPastPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const ticketNodes = useRef(new Map<string, HTMLDivElement>())

  useEffect(() => {
    let cancelled = false
    async function load() {
      const response = await fetch(`/api/account/visits?pastPage=${pastPage}`)
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
      if (!cancelled) setLoadingMore(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router, pastPage])

  function ticketDetails(visit: Visit): TicketDetails {
    return {
      name: visit.name,
      date: visit.date,
      timeSlot: visit.timeSlot,
      services: visit.services,
      fee: visit.rescheduleCount > 0 ? "Rescheduled - No Additional Charge" : "K10,000 (Paid)",
      ticketId: visit.ticketId,
      discountApplied: visit.discountApplied,
      isReschedule: visit.rescheduleCount > 0,
      originalDate: visit.originalDate,
    }
  }

  async function downloadVisit(visit: Visit) {
    const node = ticketNodes.current.get(visit.id)
    if (!node) return
    setDownloadingId(visit.id)
    try {
      await downloadTicketPng(node, visit.ticketId)
    } finally {
      setDownloadingId(null)
    }
  }
  const firstName = payload?.name.split(" ")[0] || ""
  const filled = payload ? 6 - payload.loyalty.visitsUntilDiscount : 0

  return (
    <div className="min-h-[70vh] bg-[#fdf6f8]">
      <div className="bg-stone-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-8 px-4 py-10 md:py-12">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-brand-pink">Your studio</p>
            <h1 className="mt-3 font-serif text-4xl text-white md:text-5xl">
              {firstName ? `Hi, ${firstName}` : "Your account"}
            </h1>
            {payload && <p className="mt-2 text-sm text-white/70">Visits for {payload.phone}</p>}
          </div>
          <img
            src="/llogo-mark.png"
            alt="Lauryn Luxe Beauty Studio"
            className="hidden h-28 w-auto max-w-[46%] shrink-0 object-contain sm:block md:h-32"
          />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 md:pb-16">

        {error && (
          <p className="mt-8 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}
        {!payload && !error && <p className="mt-10 text-sm text-stone-500">Loading your visits…</p>}

        {payload && (
          <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
            <aside className="h-fit rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.28em] text-brand-pink">Loyalty</p>
              <p className="mt-4 font-serif text-[1.65rem] leading-snug text-stone-900">{payload.loyalty.copy}</p>
              <p className="mt-3 text-sm text-stone-500">
                {payload.loyalty.successfulCount} successful {payload.loyalty.successfulCount === 1 ? "visit" : "visits"}
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
                              : "border-pink-200 bg-white"
                        }`}
                      />
                      {reward && <span className="text-[10px] font-medium text-brand-pink">30%</span>}
                    </div>
                  )
                })}
              </div>
            </aside>

            <div className="space-y-12">
              <section>
                <div className="flex items-end justify-between border-b border-pink-100 pb-3">
                  <h2 className="font-serif text-3xl text-stone-900">
                    {payload.upcoming.length === 1 ? "Upcoming Booking" : "Upcoming Bookings"}
                  </h2>
                  <span className="text-xs uppercase tracking-[0.2em] text-pink-400">{payload.upcoming.length}</span>
                </div>
                {payload.upcoming.length === 0 ? (
                  <p className="mt-6 text-sm text-stone-500">No upcoming visits. The next confirmed appointment will appear here.</p>
                ) : (
                  <ul className="mt-6 space-y-5">
                    {payload.upcoming.map((visit) => {
                      return (
                        <li key={visit.id} className="overflow-hidden rounded-2xl border border-pink-100 bg-white shadow-sm">
                          <div className="flex flex-col sm:flex-row">
                            <div className="relative h-64 overflow-hidden border-b border-pink-100 bg-gray-200 sm:h-auto sm:w-52 sm:border-b-0 sm:border-r">
                              <div className="pointer-events-none absolute left-1/2 top-3 origin-top -translate-x-1/2 scale-[0.5]">
                                <TicketFace details={ticketDetails(visit)} serviceNames={visit.serviceNames} />
                              </div>
                              <div className="pointer-events-none fixed left-[-4000px] top-0">
                                <TicketFace
                                  ref={(node) => {
                                    if (node) ticketNodes.current.set(visit.id, node)
                                    else ticketNodes.current.delete(visit.id)
                                  }}
                                  details={ticketDetails(visit)}
                                  serviceNames={visit.serviceNames}
                                />
                              </div>
                            </div>
                            <div className="flex-1 px-5 py-5">
                              <p className="text-sm tracking-wide text-stone-800">{formatTime(visit.timeSlot)}</p>
                              <ServiceChips names={visit.serviceNames} />
                              <div className="mt-5 flex flex-wrap gap-3">
                                <Button
                                  className="rounded-md bg-brand-pink text-white hover:bg-brand-pink/90"
                                  disabled={downloadingId === visit.id}
                                  onClick={() => downloadVisit(visit)}
                                >
                                  {downloadingId === visit.id ? "Preparing…" : "Download Ticket"}
                                </Button>
                                {visit.rescheduleCount < 1 && (
                                  <Button asChild variant="outline" className="rounded-md border-pink-200 text-pink-900 hover:bg-pink-50">
                                    <Link href={`/reschedule?ticketId=${encodeURIComponent(visit.ticketId)}&source=account`}>
                                      Reschedule
                                    </Link>
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              <section>
                <div className="flex items-end justify-between border-b border-pink-100 pb-3">
                  <h2 className="font-serif text-3xl text-stone-900">
                    {payload.pastTotal === 1 ? "Past Booking" : "Past Bookings"}
                  </h2>
                  <span className="text-xs uppercase tracking-[0.2em] text-pink-400">{payload.pastTotal}</span>
                </div>
                {payload.pastTotal === 0 ? (
                  <p className="mt-6 text-sm text-stone-500">No past visits yet.</p>
                ) : (
                  <>
                    <ul className="mt-4 divide-y divide-pink-50 overflow-hidden rounded-2xl border border-pink-100 bg-white">
                      {payload.past.map((visit) => {
                        const when = dayParts(visit.date)
                        return (
                          <li key={visit.id} className="px-5 py-5">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="font-serif text-lg text-stone-900">{when.weekday}, {when.full}</p>
                              <p className="text-sm text-stone-500">{formatTime(visit.timeSlot)}</p>
                            </div>
                            <ServiceChips names={visit.serviceNames} />
                          </li>
                        )
                      })}
                    </ul>
                    {payload.pastHasMore && (
                      <button
                        type="button"
                        disabled={loadingMore}
                        onClick={() => {
                          setLoadingMore(true)
                          setPastPage((page) => page + 1)
                        }}
                        className="mt-4 text-sm tracking-wide text-brand-pink underline underline-offset-4 hover:text-pink-700"
                      >
                        {loadingMore ? "Loading…" : `Show earlier visits (${payload.past.length} of ${payload.pastTotal})`}
                      </button>
                    )}
                  </>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
