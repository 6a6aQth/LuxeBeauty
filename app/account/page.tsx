"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { Button } from "@/components/ui/button"
import { TicketFace, downloadTicketPng, TicketDetails } from "@/components/booking-ticket"
import { formatTime } from "@/lib/time-slots"
import { LuxuryMark } from "@/components/luxury-mark"
import { authClient } from "@/lib/auth/client"

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

function TicketStub({ visit }: { visit: Visit }) {
  const when = dayParts(visit.date)
  return (
    <div className="flex items-center gap-4 bg-stone-950 px-4 py-4 text-white">
      <div className="w-14 shrink-0 text-center">
        <p className="text-[10px] uppercase tracking-[0.22em] text-brand-pink">{when.month}</p>
        <p className="font-serif text-3xl leading-none">{when.day}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-white/60">{when.weekday.slice(0, 3)}</p>
      </div>
      <div className="h-14 border-l border-dashed border-white/25" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-lg leading-tight">{visit.name}</p>
        <p className="mt-1 text-xs text-white/75">{formatTime(visit.timeSlot)}</p>
        <p className="mt-1 truncate text-[11px] uppercase tracking-[0.16em] text-white/45">{visit.ticketId}</p>
      </div>
    </div>
  )
}

function ServiceLine({ names }: { names: string[] }) {
  return <p className="mt-2 text-sm leading-relaxed text-stone-600">{names.join(" · ")}</p>
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

  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => {})
    await authClient.signOut().catch(() => {})
    router.push("/")
    router.refresh()
  }

  return (
    <div className="min-h-[70vh] bg-[#fdf6f8]">
      <div className="bg-stone-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-7 sm:gap-8 sm:py-10 md:py-12">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.32em] text-brand-pink">Your studio</p>
            <h1 className="mt-2 font-serif text-3xl text-white sm:mt-3 sm:text-4xl md:text-5xl">
              {firstName ? `Hi, ${firstName}` : "Your account"}
            </h1>
            {payload && (
              <button
                type="button"
                onClick={signOut}
                className="mt-3 text-sm tracking-wide text-white/80 underline underline-offset-4 hover:text-white"
              >
                Sign out
              </button>
            )}
          </div>
          <img
            src="/llogo-mark.png"
            alt="Lauryn Luxe Beauty Studio"
            className="h-[4.5rem] w-auto max-w-[42%] shrink-0 object-contain sm:h-28 sm:max-w-[46%] md:h-32"
          />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 md:pb-16">

        {error && (
          <p className="mt-8 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}
        {!payload && !error && <LuxuryMark variant="page" label="Loading your visits…" />}

        {payload && (
          <>
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
                          <div className="pointer-events-none fixed left-[-4000px] top-0" aria-hidden>
                            <TicketFace
                              ref={(node) => {
                                if (node) ticketNodes.current.set(visit.id, node)
                                else ticketNodes.current.delete(visit.id)
                              }}
                              details={ticketDetails(visit)}
                              serviceNames={visit.serviceNames}
                            />
                          </div>
                          <TicketStub visit={visit} />
                          <div className="px-5 py-5">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="font-serif text-lg text-stone-900">
                                {dayParts(visit.date).weekday}, {dayParts(visit.date).full}
                              </p>
                              <p className="text-sm text-stone-500">{formatTime(visit.timeSlot)}</p>
                            </div>
                            <ServiceLine names={visit.serviceNames} />
                            <div className="mt-5 flex flex-wrap gap-3">
                              <Button
                                className="rounded-md bg-brand-pink text-white hover:bg-brand-pink/90"
                                disabled={downloadingId === visit.id}
                                onClick={() => downloadVisit(visit)}
                              >
                                {downloadingId === visit.id ? "Preparing…" : "Download Ticket"}
                              </Button>
                              {visit.rescheduleCount < 1 ? (
                                <Button asChild variant="outline" className="rounded-md border-stone-300 text-stone-800 hover:bg-stone-50">
                                  <Link href={`/reschedule?ticketId=${encodeURIComponent(visit.ticketId)}&source=account`}>
                                    Reschedule
                                  </Link>
                                </Button>
                              ) : (
                                <span className="inline-flex items-center rounded-md border border-stone-300 bg-stone-200 px-4 py-2 text-sm tracking-wide text-stone-500">
                                  Rescheduled
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </div>
          </div>

          <section className="mt-12">
            <div className="flex items-end justify-between border-b border-stone-200 pb-3">
              <h2 className="font-serif text-3xl text-stone-900">
                {payload.pastTotal === 1 ? "Past Booking" : "Past Bookings"}
              </h2>
              <span className="text-xs uppercase tracking-[0.2em] text-stone-400">{payload.pastTotal}</span>
            </div>
            {payload.pastTotal === 0 ? (
              <p className="mt-6 text-sm text-stone-500">No past visits yet.</p>
            ) : (
              <>
                <ul className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white">
                  {payload.past.map((visit) => {
                    const when = dayParts(visit.date)
                    return (
                      <li key={visit.id} className="flex gap-4 border-b border-stone-100 px-4 py-4 last:border-b-0 sm:px-5">
                        <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-stone-950 py-2 text-white">
                          <span className="text-[10px] uppercase tracking-[0.16em] text-brand-pink">{when.month}</span>
                          <span className="font-serif text-2xl leading-none">{when.day}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="font-serif text-lg text-stone-900">{when.weekday}</p>
                            <p className="shrink-0 text-sm text-stone-500">{formatTime(visit.timeSlot)}</p>
                          </div>
                          <p className="text-xs text-stone-400">{when.full}</p>
                          <ServiceLine names={visit.serviceNames} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
                {payload.pastHasMore && (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={() => {
                        setLoadingMore(true)
                        setPastPage((page) => page + 1)
                      }}
                      className="inline-flex items-center gap-2 text-sm tracking-wide text-stone-700 underline underline-offset-4 hover:text-stone-950"
                    >
                      {loadingMore ? <LuxuryMark size="button" /> : null}
                      {`Show earlier visits (${payload.past.length} of ${payload.pastTotal})`}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
          </>
        )}
      </div>
    </div>
  )
}
