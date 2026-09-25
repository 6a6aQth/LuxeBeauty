"use client"

// Ensure this interactive page is dynamically rendered and not prerendered
export const dynamic = 'force-dynamic'

import type React from "react"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { parseISO, format, isValid, addDays } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getSlotsForDate, formatTime } from "@/lib/time-slots"
import { PageHeader } from "@/components/page-header"
import { MultiStepLoader } from "@/components/ui/multi-step-loader"

const loadingStates = [
  { text: "Validating Ticket" },
  { text: "Checking Availability" },
  { text: "Updating Appointment" },
  { text: "Reschedule Complete" },
]

interface Booking {
  id: string;
  ticketId: string;
  name: string;
  phone: string;
  email?: string;
  date: string;
  timeSlot: string;
  services: string[];
  notes?: string;
  rescheduleCount: number;
  originalDate?: string;
}

export default function ReschedulePage() {
  return (
    <Suspense fallback={null}>
      <RescheduleContent />
    </Suspense>
  )
}

function RescheduleContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ticketId = searchParams.get('ticketId')

  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [date, setDate] = useState<Date | undefined>()
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("")
  const [unavailableDates, setUnavailableDates] = useState<any[]>([])
  const [fullyBookedDates, setFullyBookedDates] = useState<Date[]>([])

  // Helper to get minimum booking date (tomorrow)
  function getMinBookingDate() {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d
  }

  // Helper to get max booking date (1 year from now)
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
        const response = await fetch(`/api/reschedule?ticketId=${ticketId}`)
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
  }, [ticketId, router])

  // Load unavailable dates
  useEffect(() => {
    const fetchUnavailableDates = async () => {
      try {
        const response = await fetch('/api/unavailable-dates')
        if (response.ok) {
          const data = await response.json()
          setUnavailableDates(data)
        }
      } catch (error) {
        console.error('Error fetching unavailable dates:', error)
      }
    }

    fetchUnavailableDates()
  }, [])

  // Load fully booked dates
  useEffect(() => {
    const fetchBookedDates = async () => {
      try {
        const response = await fetch('/api/bookings')
        if (response.ok) {
          const bookings = await response.json()
          const bookedDates = bookings
            .filter((b: any) => b.status === 'successful')
            .map((b: any) => {
              const d = parseISO(b.date)
              return isValid(d) ? d : null
            })
            .filter(Boolean) as Date[]
          
          setFullyBookedDates(bookedDates)
        }
      } catch (error) {
        console.error('Error fetching booked dates:', error)
      }
    }

    fetchBookedDates()
  }, [])

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
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reschedule booking')
      }

      toast({
        title: "Reschedule Successful",
        description: `Your appointment has been rescheduled to ${format(date, "MMMM dd, yyyy")} at ${formatTime(selectedTimeSlot)}.`,
      })

      // Redirect to booking status page
      router.push(`/booking/status?ticketId=${booking.ticketId}`)

    } catch (error: any) {
      console.error('Reschedule error:', error)
      toast({
        title: "Reschedule Failed",
        description: error.message || "Could not reschedule your appointment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <MultiStepLoader loadingStates={loadingStates} loading={loading} />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Booking Not Found</CardTitle>
            <CardDescription>
              We couldn't find a booking with the provided ticket ID.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/booking')} className="w-full">
              Back to Booking
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const availableTimeSlots = date ? getSlotsForDate(date, unavailableDates, fullyBookedDates) : []

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <PageHeader 
        title="Reschedule Appointment" 
        description="Change your appointment date and time"
      />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Current Booking Info */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Current Appointment</CardTitle>
              <CardDescription>Your current booking details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Name:</span> {booking.name}
                </div>
                <div>
                  <span className="font-medium">Phone:</span> {booking.phone}
                </div>
                <div>
                  <span className="font-medium">Current Date:</span> {format(parseISO(booking.date), "MMMM dd, yyyy")}
                </div>
                <div>
                  <span className="font-medium">Current Time:</span> {formatTime(booking.timeSlot)}
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Services:</span> {booking.services.join(", ")}
                </div>
                {booking.originalDate && (
                  <div className="col-span-2">
                    <span className="font-medium">Original Date:</span> {format(parseISO(booking.originalDate), "MMMM dd, yyyy")}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Reschedule Form */}
          <Card>
            <CardHeader>
              <CardTitle>Select New Date & Time</CardTitle>
              <CardDescription>
                Choose a new date and time for your appointment. You can only reschedule once.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Date Selection */}
                <div className="space-y-2">
                  <Label htmlFor="date">New Appointment Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !date && "text-muted-foreground"
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
                        disabled={(date) => {
                          const today = new Date()
                          today.setHours(0, 0, 0, 0)
                          return date < today || date < getMinBookingDate() || date > getMaxBookingDate()
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Time Slot Selection */}
                <div className="space-y-2">
                  <Label htmlFor="timeSlot">New Time Slot</Label>
                  <Select value={selectedTimeSlot} onValueChange={setSelectedTimeSlot}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a time slot" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTimeSlots.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {formatTime(slot)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {date && availableTimeSlots.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No available time slots for this date.
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={!date || !selectedTimeSlot || isSubmitting}
                >
                  {isSubmitting ? "Rescheduling..." : "Reschedule Appointment"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Back Button */}
          <div className="mt-6 text-center">
            <Button 
              variant="outline" 
              onClick={() => router.push(`/booking/status?ticketId=${booking.ticketId}`)}
            >
              Back to Booking Status
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
