"use client"

// Ensure this interactive page is dynamically rendered and not prerendered
export const dynamic = 'force-dynamic'

import type React from "react"
import { useState, useEffect, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { parseISO, format, isValid } from "date-fns"
import { LuxuryMark } from "@/components/luxury-mark"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getSlotsForDate, formatTime } from "@/lib/time-slots"
import { PageHeader } from "@/components/page-header"

interface Booking {
  id: string;
  ticketId: string;
  name: string;
  phone: string;
  email?: string;
  date: string;
  timeSlot: string;
  services: string[];
  serviceNames?: string[];
  notes?: string;
  rescheduleCount: number;
  originalDate?: string;
}

export default function ReschedulePage() {
  return (
    <Suspense fallback={<LuxuryMark variant="page" />}>
      <RescheduleContent />
    </Suspense>
  )
}

function RescheduleContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ticketId = searchParams.get('ticketId')
  const fromAccount = searchParams.get('source') === 'account'

  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [date, setDate] = useState<Date | undefined>()
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("")
  const [unavailableSlots, setUnavailableSlots] = useState<Record<string, string[]>>({})
  const [bookedSlots, setBookedSlots] = useState<Record<string, string[]>>({})

  function getMaxBookingDate() {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    return d
  }

  // Load booking details
  useEffect(() => {
    if (!ticketId) {
      toast({
        title: "Invalid Ticket",
        description: "No ticket ID provided. Please use the link from your booking confirmation.",
        variant: "destructive",
      })
      router.push('/booking')
      return
    }

    const fetchBooking = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/reschedule?ticketId=${ticketId}${fromAccount ? "&source=account" : ""}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch booking details')
        }

        setBooking(data.booking)
        
        // Set current date and time slot
        const currentDate = parseISO(data.booking.date)
        if (isValid(currentDate)) {
          setDate(currentDate)
        }
        setSelectedTimeSlot(data.booking.timeSlot)

      } catch (error: any) {
        console.error('Error fetching booking:', error)
        toast({
          title: "Error",
          description: error.message || "Failed to load booking details",
          variant: "destructive",
        })
        router.push('/booking')
      } finally {
        setLoading(false)
      }
    }

    fetchBooking()
  }, [ticketId, fromAccount, router])

  useEffect(() => {
    const loadAvailability = async () => {
      try {
        const [blockedResponse, bookingsResponse] = await Promise.all([
          fetch('/api/unavailable-dates'),
          fetch('/api/bookings?status=successful'),
        ])
        if (blockedResponse.ok) {
          const blocked = await blockedResponse.json()
          const byDate: Record<string, string[]> = {}
          if (Array.isArray(blocked)) {
            blocked.forEach((item: { date: string; timeSlots: string[] }) => {
              byDate[item.date] = item.timeSlots || []
            })
          }
          setUnavailableSlots(byDate)
        }
        if (bookingsResponse.ok) {
          const bookings = await bookingsResponse.json()
          const byDate: Record<string, string[]> = {}
          if (Array.isArray(bookings)) {
            bookings.forEach((item: { ticketId?: string; status?: string; date: string; timeSlot: string }) => {
              if (item.status && item.status !== 'successful') return
              if (ticketId && item.ticketId === ticketId) return
              if (!byDate[item.date]) byDate[item.date] = []
              byDate[item.date].push(item.timeSlot)
            })
          }
          setBookedSlots(byDate)
        }
      } catch (error) {
        console.error('Error fetching availability:', error)
      }
    }

    loadAvailability()
  }, [ticketId])

  const slotTaken = (dateStr: string, slot: string) =>
    (bookedSlots[dateStr] || []).includes(slot) || (unavailableSlots[dateStr] || []).includes(slot)

  const closedOrFullDates = useMemo(() => {
    const dates = new Set([...Object.keys(bookedSlots), ...Object.keys(unavailableSlots)])
    const blocked: Date[] = []
    dates.forEach((dateStr) => {
      const slots = getSlotsForDate(parseISO(dateStr))
      if (slots.length === 0) return
      if (slots.every((slot) => slotTaken(dateStr, slot))) {
        const parsed = parseISO(dateStr)
        if (isValid(parsed)) blocked.push(parsed)
      }
    })
    return blocked
  }, [bookedSlots, unavailableSlots])

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate)
    setSelectedTimeSlot("") // Reset time slot when date changes
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!booking) return

    if (!date || !selectedTimeSlot) {
      toast({
        title: "Missing Information",
        description: "Please select both a new date and time slot.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId: booking.ticketId,
          newDate: format(date, "yyyy-MM-dd"),
          newTimeSlot: selectedTimeSlot,
          fromAccount,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reschedule booking')
      }

      sessionStorage.setItem('lauryn-luxe-booking', JSON.stringify({
        ...data.booking,
        fee: 'Rescheduled - No Additional Charge',
        isReschedule: true,
      }))

      router.push(`/booking/confirmation?ticketId=${encodeURIComponent(data.booking.ticketId)}`)

    } catch (error: any) {
      console.error('Reschedule error:', error)
      setIsSubmitting(false)
      toast({
        title: "Reschedule Failed",
        description: error.message || "Could not reschedule your appointment. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (loading || isSubmitting) {
    return <LuxuryMark variant="page" label={isSubmitting ? "Updating your appointment" : undefined} />
  }

  if (!booking) {
    return (
      <div className="bg-[#fdf6f8] px-4 py-20 text-center">
        <h1 className="font-serif text-3xl text-stone-900">Booking not found</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-stone-500">
          We could not find a visit with that ticket.
        </p>
        <Button onClick={() => router.push('/booking')} className="mt-8 rounded-md bg-stone-950 text-white hover:bg-stone-800">
          Back to booking
        </Button>
      </div>
    )
  }

  const dateStr = date ? format(date, "yyyy-MM-dd") : ""
  const daySlots = date ? getSlotsForDate(date) : []
  const selectedSlotTaken = Boolean(dateStr && selectedTimeSlot && slotTaken(dateStr, selectedTimeSlot))

  const names = booking.serviceNames?.length ? booking.serviceNames : booking.services

  return (
    <div className="bg-[#fdf6f8]">
      <PageHeader
        title="Reschedule"
        description="Move this visit once, with 24 hours' notice. There is no extra charge."
      />

      <div className="mx-auto max-w-xl px-4 py-12 md:py-16">
        <section className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.28em] text-brand-pink">This visit</p>
          <h2 className="mt-2 font-serif text-3xl text-stone-900">{booking.name}</h2>
          <p className="mt-3 text-sm text-stone-600">
            {format(parseISO(booking.date), "EEEE, MMMM d, yyyy")} · {formatTime(booking.timeSlot)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{names.join(" · ")}</p>
          {booking.originalDate && (
            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-stone-400">
              First booked {format(parseISO(booking.originalDate), "MMMM d, yyyy")}
            </p>
          )}
        </section>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="font-serif text-2xl text-stone-900">New date and time</h2>
            <p className="mt-2 text-sm text-stone-500">Once this visit is moved, it cannot be moved again.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start rounded-md border-stone-300 bg-stone-50 text-left font-normal text-stone-900",
                    !date && "text-stone-400"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleDateSelect}
                  disabled={(day) => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const tomorrow = new Date(today)
                    tomorrow.setDate(today.getDate() + 1)
                    const key = format(day, "yyyy-MM-dd")
                    const noSlots = getSlotsForDate(day).length === 0
                    const fullyTaken = closedOrFullDates.some(
                      (booked) => booked.toDateString() === day.toDateString()
                    )
                    return day < tomorrow || day > getMaxBookingDate() || noSlots || fullyTaken
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeSlot">Time</Label>
            <Select value={selectedTimeSlot} onValueChange={setSelectedTimeSlot}>
              <SelectTrigger className="rounded-md border-stone-300 bg-stone-50">
                <SelectValue placeholder="Select a time" />
              </SelectTrigger>
              <SelectContent>
                {daySlots.map((slot) => {
                  const taken = slotTaken(dateStr, slot)
                  return (
                    <SelectItem key={slot} value={slot} disabled={taken}>
                      {formatTime(slot)}{taken ? " · Taken" : ""}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {date && daySlots.length > 0 && daySlots.every((slot) => slotTaken(dateStr, slot)) && (
              <p className="text-sm text-stone-500">Every time on this date is taken.</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full rounded-md bg-brand-pink text-white hover:bg-brand-pink/90"
            disabled={!date || !selectedTimeSlot || selectedSlotTaken || isSubmitting}
          >
            Reschedule appointment
          </Button>
          <button
            type="button"
            onClick={() => router.push(fromAccount ? "/account" : "/lookup")}
            className="block w-full text-center text-sm tracking-wide text-stone-500 underline underline-offset-4 hover:text-stone-900"
          >
            {fromAccount ? "Back to account" : "Back to lookup"}
          </button>
        </form>
      </div>
    </div>
  )
}
