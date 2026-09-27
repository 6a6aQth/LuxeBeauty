"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { parseISO, format, isValid, subDays, isAfter } from "date-fns"
import { formatTime } from "@/lib/time-slots"
import { PageHeader } from "@/components/page-header"
import Link from 'next/link'
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
    <div className="min-h-screen bg-pink-50">
      <PageHeader 
        title="Find Your Booking" 
        description="Enter your Ticket ID to view your appointment details"
      />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {!booking ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center mt-12">
              {/* Left Side - Form */}
              <div className="order-2 lg:order-1">
                <Card className="bg-white border-0 shadow-xl">
                  <CardHeader className="text-center pb-6">
                    <div className="mx-auto w-16 h-16 bg-pink-500 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <CardTitle className="text-2xl font-serif text-gray-800">Booking Lookup</CardTitle>
                    <CardDescription className="text-gray-600 text-base">
                      Enter your Ticket ID to view your appointment details
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-8 pb-8">
                    <form onSubmit={handleLookup} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="ticketId" className="text-sm font-medium text-gray-700">
                          Ticket ID
                        </Label>
                        <Input
                          id="ticketId"
                          type="text"
                          placeholder="Enter your Ticket ID (e.g., LLB-1234567890-123456)"
                          value={ticketId}
                          onChange={(e) => setTicketId(e.target.value)}
                          disabled={isLoading}
                          className="h-12 text-base border-gray-200 focus:border-pink-500 focus:ring-pink-500"
                        />
                      </div>
                      
                      {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-red-700 text-sm font-medium">{error}</p>
                          </div>
                        </div>
                      )}
                      
                      <Button 
                        type="submit" 
                        className="w-full h-12 bg-pink-500 hover:bg-pink-600 text-white font-medium text-base shadow-lg hover:shadow-xl transition-all duration-300" 
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <div className="flex items-center">
                            <LuxuryMark size="button" tone="ink" className="mr-2" />
                            Looking up...
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            Find My Booking
                          </div>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Right Side - Illustration/Info */}
              <div className="order-1 lg:order-2">
                <div className="text-center lg:text-left">
                  <div className="mb-8">
                    <h2 className="text-3xl lg:text-4xl font-serif text-gray-800 mb-4">
                      Find Your <span className="text-pink-500">Appointment</span>
                    </h2>
                    <p className="text-lg text-gray-600 leading-relaxed">
                      Lost your booking details? No worries! Simply enter your Ticket ID to retrieve all your appointment information.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-gray-700">View appointment details</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-gray-700">Reschedule if eligible</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-gray-700">No payment required for reschedule</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-gray-700">Can only reschedule once</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 mt-12">
              {/* Booking Details Card */}
              <Card className="bg-white border-0 shadow-xl overflow-hidden">
                <div className="bg-pink-500 p-6">
                  <h3 className="text-2xl font-serif text-white mb-2">Appointment Details</h3>
                  <p className="text-pink-100">Ticket ID: {booking.ticketId}</p>
                </div>
                
                <CardContent className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Name</p>
                          <p className="text-lg font-semibold text-gray-800">{booking.name}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                          <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Date</p>
                          <p className="text-lg font-semibold text-gray-800">{format(parseISO(booking.date), 'MMMM dd, yyyy')}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Time</p>
                          <p className="text-lg font-semibold text-gray-800">{formatTime(booking.timeSlot)}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center mt-1">
                          <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-500">Services</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {(booking.serviceNames || booking.services).map((service, index) => (
                              <span key={index} className="px-3 py-1 bg-pink-100 text-pink-800 text-sm font-medium rounded-full">
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
                      className="px-8 bg-pink-500 hover:bg-pink-600 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Reschedule Appointment
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
                      <div className="mx-auto w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-yellow-800 mb-2">Reschedule Not Available</h3>
                      <p className="text-yellow-700 text-sm">
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
                        className="px-8 border-2 border-gray-300 hover:border-pink-500 hover:text-pink-600 font-medium transition-all duration-300"
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
    </div>
  )
}
