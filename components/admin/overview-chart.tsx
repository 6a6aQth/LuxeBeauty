"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { LuxuryMark } from "@/components/luxury-mark"
import type { AdminSectionId } from "@/components/admin/admin-nav"
import {
  blantyreToday,
  buildOverviewPoints,
  periodLabel,
  shiftAnchor,
  studioSnapshot,
  upcomingVisits,
  type CalendarDay,
  type OverviewPoint,
  type OverviewRange,
} from "@/lib/admin-overview"
import { cn } from "@/lib/utils"

const ranges: { id: OverviewRange; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
]

type BookingRow = {
  name?: string | null
  date: string
  timeSlot?: string | null
  status?: string | null
}

type StudioBits = {
  services: number
  availableServices: number
  subscribers: number
  hasPriceList: boolean
}

async function readJson(url: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export function OverviewChart({ onOpen }: { onOpen?: (section: AdminSectionId) => void }) {
  const [range, setRange] = useState<OverviewRange>("week")
  const [anchor, setAnchor] = useState<CalendarDay>(() => blantyreToday())
  const [bookings, setBookings] = useState<BookingRow[] | null>(null)
  const [userCount, setUserCount] = useState<number | null>(null)
  const [bits, setBits] = useState<StudioBits | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      readJson("/api/bookings?status=successful"),
      readJson("/api/admin/customers"),
      readJson("/api/services"),
      readJson("/api/newsletter/subscribers"),
      readJson("/api/price-list"),
    ])
      .then(([bookingRows, accounts, services, subscribers, priceList]) => {
        if (cancelled) return
        if (!Array.isArray(bookingRows)) {
          setFailed(true)
          return
        }
        setBookings(bookingRows)
        setUserCount(Array.isArray(accounts) ? accounts.length : 0)
        const serviceRows = Array.isArray(services) ? services : []
        setBits({
          services: serviceRows.length,
          availableServices: serviceRows.filter((service) => service?.isAvailable).length,
          subscribers: Array.isArray(subscribers) ? subscribers.length : 0,
          hasPriceList: Boolean(priceList?.priceListUrl),
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const points = useMemo(
    () => (bookings ? buildOverviewPoints(range, anchor, bookings) : []),
    [bookings, range, anchor],
  )
  const snapshot = useMemo(() => (bookings ? studioSnapshot(bookings) : null), [bookings])
  const upcomingPreview = useMemo(() => (bookings ? upcomingVisits(bookings, 5) : []), [bookings])
  const successfulCount = bookings ? bookings.filter((booking) => booking.status === "successful").length : 0

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-stone-400">Studio</p>
          <h1 className="mt-2 font-serif text-4xl text-stone-900">Overview</h1>
          <p className="mt-2 max-w-lg text-sm text-stone-500">
            Today, this week’s book, users, and what the other sections are holding.
          </p>
        </div>
      </div>

      {snapshot ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SnapshotTile
            label="Today"
            value={snapshot.todaySlots === 0 ? "Closed" : `${snapshot.todayCount} / ${snapshot.todaySlots}`}
            detail={snapshot.todaySlots === 0 ? "No slots today" : "slots booked"}
          />
          <SnapshotTile
            label="This week"
            value={String(snapshot.weekCount)}
            detail={
              snapshot.weekSlots === 0
                ? "No slots this week"
                : `${Math.round((snapshot.weekCount / snapshot.weekSlots) * 100)}% of the week`
            }
          />
          <SnapshotTile
            label="Users"
            value={userCount === null ? "—" : String(userCount)}
            detail="customer accounts"
          />
          <SnapshotTile
            label="Successful"
            value={String(successfulCount)}
            detail="confirmed bookings"
          />
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-3xl border border-stone-200 [border-top-color:#e7b4c4] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-2xl">Upcoming</h2>
            {onOpen ? (
              <button type="button" onClick={() => onOpen("bookings")} className="text-sm text-[#c45c7a] hover:underline">
                All bookings
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-stone-500">The next five successful appointments.</p>
          {bookings === null ? (
            <LuxuryMark size="block" label="Loading bookings" />
          ) : upcomingPreview.length === 0 ? (
            <p className="py-8 text-sm text-stone-500">Nothing upcoming.</p>
          ) : (
            <ul className="mt-4">
              {upcomingPreview.map((visit) => (
                <li
                  key={`${visit.date}-${visit.timeSlot}-${visit.name}`}
                  className="flex items-center justify-between gap-4 border-b border-[#f3d0db] py-3 last:border-b-0"
                >
                  <span className="truncate font-medium text-stone-900">{visit.name}</span>
                  <span className="shrink-0 text-sm text-stone-500">{visitLabel(visit.date, visit.timeSlot)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid gap-3">
          <SummaryLink
            label="Services"
            value={bits ? `${bits.availableServices} of ${bits.services}` : "—"}
            detail="available on the menu"
            onClick={onOpen ? () => onOpen("services") : undefined}
          />
          <SummaryLink
            label="Newsletter"
            value={bits ? String(bits.subscribers) : "—"}
            detail="subscribers"
            onClick={onOpen ? () => onOpen("newsletter") : undefined}
          />
          <SummaryLink
            label="Price list"
            value={bits ? (bits.hasPriceList ? "On the site" : "Not uploaded") : "—"}
            detail="what guests see on prices"
            onClick={onOpen ? () => onOpen("price-list") : undefined}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl">Bookings</h2>
            <p className="text-sm text-stone-500">The top of the line is a full book.</p>
          </div>
          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAnchor((current) => shiftAnchor(range, current, -1))}
            className="rounded-full border border-stone-200 bg-white p-2 text-stone-600 hover:border-stone-300"
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="min-w-[9.5rem] text-center text-sm text-stone-700">{periodLabel(range, anchor)}</p>
          <button
            type="button"
            onClick={() => setAnchor((current) => shiftAnchor(range, current, 1))}
            className="rounded-full border border-stone-200 bg-white p-2 text-stone-600 hover:border-stone-300"
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="inline-flex rounded-full bg-stone-100 p-1">
            {ranges.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRange(item.id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm transition",
                  range === item.id ? "bg-black text-white" : "text-stone-500 hover:text-stone-800",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          </div>
        </div>

        {failed ? (
          <p className="py-16 text-center text-sm text-stone-500">The booking line could not be loaded.</p>
        ) : bookings === null ? (
          <LuxuryMark size="block" label="Loading bookings" />
        ) : (
          <BookingLine points={points} />
        )}
      </div>
    </section>
  )
}

function visitLabel(date: string, timeSlot: string): string {
  const [year, month, day] = date.split("-").map(Number)
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
  return timeSlot ? `${label} · ${timeSlot}` : label
}

function SnapshotTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-stone-200 [border-top-color:#e7b4c4] bg-white px-5 py-5">
      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">{label}</p>
      <p className="mt-3 font-serif text-3xl text-stone-900">{value}</p>
      <p className="mt-1 text-sm text-stone-500">{detail}</p>
    </div>
  )
}

function SummaryLink({
  label,
  value,
  detail,
  onClick,
}: {
  label: string
  value: string
  detail: string
  onClick?: () => void
}) {
  const className = "rounded-3xl border border-stone-200 [border-top-color:#e7b4c4] bg-white px-5 py-4 text-left"
  const body = (
    <>
      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">{label}</p>
      <p className="mt-2 font-serif text-2xl text-stone-900">{value}</p>
      <p className="text-sm text-stone-500">{detail}</p>
    </>
  )
  if (!onClick) return <div className={className}>{body}</div>
  return (
    <button type="button" onClick={onClick} className={`${className} hover:bg-stone-50`}>
      {body}
    </button>
  )
}

function BookingLine({ points }: { points: OverviewPoint[] }) {
  const dense = points.length > 14
  const width = dense ? points.length * 44 : 720
  const height = 280
  const padLeft = 16
  const padRight = 16
  const padTop = 36
  const padBottom = 48
  const plotWidth = width - padLeft - padRight
  const plotHeight = height - padTop - padBottom
  const step = points.length <= 1 ? 0 : plotWidth / (points.length - 1)

  const coords = points.map((point, index) => ({
    ...point,
    x: padLeft + index * step,
    y: padTop + (1 - point.fullness) * plotHeight,
  }))

  const line = smoothLine(coords)
  const baseline = padTop + plotHeight
  const area = coords.length
    ? `${line} L ${coords[coords.length - 1].x} ${baseline} L ${coords[0].x} ${baseline} Z`
    : ""

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={dense ? width : undefined}
        height={dense ? height : undefined}
        role="img"
        aria-label="Successful bookings"
        className={dense ? "max-w-none" : "h-auto w-full"}
      >
        <title>Successful bookings</title>
        {[0, 0.5, 1].map((mark) => {
          const y = padTop + (1 - mark) * plotHeight
          return (
            <line
              key={mark}
              x1={padLeft}
              x2={width - padRight}
              y1={y}
              y2={y}
              stroke="#e7e2dc"
              strokeWidth="1"
            />
          )
        })}
        <path d={area} fill="rgba(233, 30, 99, 0.14)" />
        <path d={line} fill="none" stroke="#d7a3b4" strokeWidth="2.5" strokeLinejoin="round" />
        {coords.map((point) => (
          <g key={point.key}>
            <circle cx={point.x} cy={point.y} r="4.5" fill="white" stroke="#c9899d" strokeWidth="2" />
            <text
              x={point.x}
              y={point.y - 12}
              textAnchor="middle"
              className="fill-stone-700"
              fontSize="11"
              fontFamily="var(--font-sans), sans-serif"
            >
              {point.count}
            </text>
            <text
              x={point.x}
              y={height - 22}
              textAnchor="middle"
              className="fill-stone-500"
              fontSize="11"
              fontFamily="var(--font-sans), sans-serif"
            >
              {point.label}
            </text>
            {point.sublabel ? (
              <text
                x={point.x}
                y={height - 8}
                textAnchor="middle"
                className="fill-stone-400"
                fontSize="10"
                fontFamily="var(--font-sans), sans-serif"
              >
                {point.sublabel}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      <ul className="sr-only">
        {points.map((point) => (
          <li key={point.key}>
            {point.label}
            {point.sublabel ? ` ${point.sublabel}` : ""}: {point.count} successful
            {point.slots === 0 ? ", no slots" : ` of ${point.slots} slots`}
          </li>
        ))}
      </ul>
    </div>
  )
}

function smoothLine(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ""
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const mid = (current.x + next.x) / 2
    path += ` C ${mid} ${current.y}, ${mid} ${next.y}, ${next.x} ${next.y}`
  }
  return path
}
