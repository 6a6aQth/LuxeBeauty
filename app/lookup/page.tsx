"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { parseISO, format, isValid, subDays, isAfter } from "date-fns"
import { formatTime } from "@/lib/time-slots"
import { PageHeader } from "@/components/page-header"
import { LuxuryMark } from "@/components/luxury-mark"

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
  status?: string;
}

export default function BookingLookupPage() {
  const router = useRouter()
  const [ticketId, setTicketId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [error, setError] = useState('')

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ticketId.trim()) {
      setError('Please enter your Ticket ID')
      return
    }

    setIsLoading(true)
    setError('')
    setBooking(null)

    try {
      // First, try to get booking details (this will work for all bookings)
      const response = await fetch(`/api/bookings?ticketId=${ticketId.trim()}`)
      const bookings = await response.json()

      if (!response.ok || !bookings || bookings.length === 0) {
        throw new Error('Booking not found')
      }

      const foundBooking = bookings[0]
      setBooking(foundBooking)
    } catch (error: any) {
      setError(error.message || 'Failed to find booking')
    } finally {
      setIsLoading(false)
    }
  }

  const isEligibleForReschedule = (booking: Booking) => {
    // Check if booking is successful
    if (booking.status !== 'successful') {
      return false
    }

    // Check if already rescheduled
    if (booking.rescheduleCount >= 1) {
      return false
    }

    // Check if appointment date has passed
    const appointmentDate = parseISO(booking.date)
    if (!isValid(appointmentDate)) {
      return false
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const appointmentDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate())
    
    if (appointmentDay < today) {
      return false
    }

    // Check if reschedule is within 24 hours of booking date
    const twentyFourHoursBeforeBooking = subDays(appointmentDate, 1)
    if (isAfter(now, twentyFourHoursBeforeBooking)) {
      return false
    }

    return true
  }

  const handleReschedule = () => {
    if (!booking) return
    
    // Store booking data in sessionStorage for auto-filling the booking form
    sessionStorage.setItem('lauryn-luxe-reschedule-data', JSON.stringify({
      ticketId: booking.ticketId,
      name: booking.name,
      phone: booking.phone,
      email: booking.email,
      services: booking.services,
      notes: booking.notes,
      inspirationPhotos: [],
      isReschedule: true
    }))
    
    // Redirect to booking page with reschedule flag and ticketId for refresh fallback
    router.push(`/booking?reschedule=true&ticketId=${encodeURIComponent(booking.ticketId)}`)
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      <PageHeader
        title="Find Your Booking"
        description="Enter your Ticket ID to view your appointment details"
      />
      <div className={`mx-auto px-4 pb-16 text-center ${booking ? "max-w-3xl" : "max-w-lg"}`}>

          {!booking ? (
            <div className="mt-10 rounded-2xl border border-zinc-200 bg-white px-6 py-8 text-left shadow-sm sm:px-8">
                    <form onSubmit={handleLookup} className="space-y-6">
                      <div className="space-y-3">
                        <Label htmlFor="ticketId">Ticket ID</Label>
                        <Input
                          id="ticketId"
                          type="text"
                          placeholder="LLB-1234567890-123456"
                          value={ticketId}
                          onChange={(e) => setTicketId(e.target.value)}
                          disabled={isLoading}
                          className="bg-zinc-50"
                        />
                      </div>

                      {error && (
                        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
                      )}

                      <Button
                        type="submit"
                        className="w-full rounded-lg bg-zinc-950 text-white hover:bg-zinc-800"
                        disabled={isLoading}
                      >
                        {isLoading ? <LuxuryMark size="button" tone="ink" /> : null}
                        {isLoading ? "Looking up…" : "Find my booking"}
                      </Button>
                    </form>
                    <ul className="mt-8 space-y-4 border-t border-zinc-200 pt-6 text-sm leading-6 text-zinc-700">
                      <li>View the appointment details</li>
                      <li>Reschedule only if the visit is confirmed</li>
                      <li>No extra payment</li>
                      <li>One change, and not within 24 hours of the appointment</li>
                    </ul>
            </div>
          ) : (
            <div className="mt-8 space-y-8 text-left">
              {/* Booking Details Card */}
              <Card className="bg-white border-0 shadow-xl overflow-hidden">
                <div className="bg-zinc-950 p-6 text-center">
                  <h3 className="mb-2 font-serif text-2xl text-white">Appointment details</h3>
                  <p className="text-sm tracking-wide text-zinc-300">Ticket ID: {booking.ticketId}</p>
                </div>
                
                <CardContent className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Name</p>
                          <p className="text-lg font-semibold text-gray-800">{booking.name}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Phone</p>
                          <p className="text-lg font-semibold text-gray-800">{booking.phone}</p>
                        </div>
                      </div>
                      
                      {booking.email && (
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Email</p>
                            <p className="text-lg font-semibold text-gray-800">{booking.email}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Date</p>
                          <p className="text-lg font-semibold text-gray-800">{format(parseISO(booking.date), 'MMMM dd, yyyy')}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Time</p>
                          <p className="text-lg font-semibold text-gray-800">{formatTime(booking.timeSlot)}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center mt-1">
                          <svg className="w-5 h-5 text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-500">Services</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {(booking.serviceNames || booking.services).map((service, index) => (
                              <span key={index} className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-800">
                                {service}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Reschedule history intentionally hidden per request */}
                  
                  {booking.notes && (
                    <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 mb-2">Notes</p>
                      <p className="text-gray-600 whitespace-pre-wrap">{booking.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Section */}
              <div className="space-y-4">
                {isEligibleForReschedule(booking) ? (
                  <div className="flex justify-center">
                    <Button 
                      onClick={handleReschedule} 
                      className="rounded-lg bg-zinc-950 px-8 text-white hover:bg-zinc-800"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Reschedule Appointment
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center">
                      <h3 className="mb-2 font-serif text-lg text-zinc-950">Reschedule not available</h3>
                      <p className="text-sm text-zinc-600">
                        {booking.status !== 'successful' 
                          ? 'Only confirmed bookings can be rescheduled'
                          : booking.rescheduleCount >= 1
                          ? 'This booking has already been rescheduled once'
                          : 'Cannot reschedule after the appointment date has passed or within 24 hours of the appointment'
                        }
                      </p>
                    </div>
                    
                    <div className="flex justify-center">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setBooking(null)
                          setTicketId('')
                          setError('')
                        }} 
                        className="rounded-lg border-zinc-300 px-8 hover:border-zinc-950 hover:bg-white hover:text-zinc-950"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Lookup Another Booking
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
      </div>
    </div>
  )
}
