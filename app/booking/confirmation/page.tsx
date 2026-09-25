"use client"

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button as PrimitiveButton } from '@/components/ui/button'
import Logo from '@/components/logo'
import { serviceLabel, formatTime } from '@/lib/time-slots'
import { toast } from '@/hooks/use-toast'
import Link from 'next/link'
import { Button } from '@/components/ui/animated-download-button'
import { Mail, Phone, Home } from 'lucide-react'
import { Service } from '@/types/types';
import { format, parseISO } from 'date-fns'

interface BookingDetails {
  id: string
  name: string
  date: string
  timeSlot: string
  services: string[]
  fee: string
  ticketId: string
  email?: string
  discountApplied: boolean
  isReschedule?: boolean
  originalTicketId?: string
  rescheduleCount?: number
  originalDate?: string
}

export default function BookingConfirmationPage() {
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const ticketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);

    const hydrateFromDb = async () => {
      try {
        // We may still have session data (to get ticketId/fee), but booking details come from DB
        const stored = sessionStorage.getItem('lauryn-luxe-booking');
        let fallbackFee: string | undefined = undefined;
        let ticketIdFromSession: string | undefined = undefined;
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            fallbackFee = parsed?.fee;
            ticketIdFromSession = parsed?.ticketId;
          } catch {}
        }

        const ticketId = ticketIdFromSession;
        if (!ticketId) {
          // No ticketId – leave as null; user may have navigated here directly
          setBookingDetails(null);
          return;
        }

        const res = await fetch(`/api/bookings?ticketId=${encodeURIComponent(ticketId)}`);
        if (!res.ok) throw new Error('Failed to fetch booking');
        const arr = await res.json();
        const b = arr?.[0];
        if (!b) {
          setBookingDetails(null);
          return;
        }

        const isReschedule = (b.rescheduleCount ?? 0) > 0;
        const feeString = isReschedule ? 'Rescheduled - No Additional Charge' : (fallbackFee || 'K10,000 (Paid)');

        setBookingDetails({
          id: b.id,
          name: b.name,
          date: b.date,
          timeSlot: b.timeSlot,
          services: b.services,
          fee: feeString,
          ticketId: b.ticketId,
          email: b.email,
          discountApplied: !!b.discountApplied,
          isReschedule,
          rescheduleCount: b.rescheduleCount,
          originalDate: b.originalDate,
        });
      } catch {
        setBookingDetails(null);
      }
    };

    hydrateFromDb();

    const fetchServices = async () => {
      try {
        const response = await fetch('/api/services');
        if (response.ok) {
          const data = await response.json();
          setAllServices(data);
        }
      } catch (error) {
        console.error('Failed to fetch services', error);
      }
    };
    fetchServices();
  }, []);

  const getServiceNames = (serviceIds: string[]) => {
    return serviceIds.map(id => {
      const service = allServices.find(s => s.id === id);
      return service ? service.name : id; // Fallback to ID if name not found
    });
  };

  const handleDownloadTicket = async () => {
    const { default: html2canvas } = await import('html2canvas')
    if (ticketRef.current) {
      const canvas = await html2canvas(ticketRef.current, { scale: 2 })
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `booking-ticket-${bookingDetails?.ticketId}.png`
      link.click()
    }
  }

  const handleSubscribe = async () => {
    if (!bookingDetails?.email) {
      toast({
        title: 'No Email Found',
        description:
          'An email address is required to subscribe. It was not provided during booking.',
        variant: 'destructive',
      })
      return
    }

    toast({
      title: 'Subscribing...',
      description: 'Adding you to our newsletter.',
    })

    try {
      const response = await fetch('/api/newsletter/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: bookingDetails.email }),
      })

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to subscribe')
      }

      toast({
        title: 'Subscribed!',
        description: 'Thank you for subscribing to our newsletter.',
      })
    } catch (error: any) {
      toast({
        title: 'Subscription Failed',
        description: error.message || 'Could not subscribe. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  if (!isClient) {
    return null; // Render nothing on the server
  }

  if (!bookingDetails) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 text-center p-4">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Payment was not successful
        </h1>
        <p className="text-gray-600 mb-8">
          Please try booking again.
        </p>
        <PrimitiveButton asChild>
          <Link href="/booking">Try Booking Again</Link>
        </PrimitiveButton>
      </div>
    );
  }

  return (
    <div className="bg-gray-200 py-12 sm:py-20">
      <div className="w-full max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-serif text-gray-800 mb-3">
          Booking Request Received
        </h1>
        <p className="text-gray-600 mb-10">
          Please download your ticket below.
        </p>

        <div className="max-w-md mx-auto">
          <div
            ref={ticketRef}
            className="bg-white rounded-xl shadow-2xl relative"
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-gray-300 rounded-full"></div>
            
            <div className="p-8">
              <div className="text-center mb-8">
                <Logo />
              </div>
              {bookingDetails.discountApplied && (
                <div className="inline-block mb-4 px-4 py-2 rounded-full bg-green-100 text-green-800 font-semibold text-sm border border-green-300">
                  30% Loyalty Discount Applied
                </div>
              )}
              {bookingDetails.isReschedule && (
                <div className="inline-block mb-4 px-4 py-2 rounded-full bg-blue-100 text-blue-800 font-semibold text-sm border border-blue-300">
                  Rescheduled Appointment
                </div>
              )}
              <div className="space-y-4 text-center text-gray-700">
                <p>
                  <strong>Name:</strong> {bookingDetails.name}
                </p>
                <p>
                  <strong>Date:</strong> {bookingDetails.date}
                </p>
                <p>
                  <strong>Time:</strong> {formatTime(bookingDetails.timeSlot)}
                </p>
                <p>
                  <strong>Services:</strong>{' '}
                  {getServiceNames(bookingDetails.services).join(', ')}
                </p>
                <p>
                  <strong>Booking Fee:</strong> {bookingDetails.fee}
                </p>
                {bookingDetails.isReschedule && bookingDetails.originalDate && (
                  <p>
                    <strong>Originally Scheduled:</strong> {format(parseISO(bookingDetails.originalDate), 'MMMM dd, yyyy')}
                  </p>
                )}
              </div>
              <div className="mt-8 text-center">
                <p className="text-sm font-semibold text-gray-800">
                  Ticket ID: {bookingDetails.ticketId}
                </p>
                {/* Original Ticket line removed per request */}
                <p className="text-xs text-gray-500 mt-1">
                  Show this ticket at the studio for your appointment.
                </p>
              </div>
            </div>

            <div data-html2canvas-ignore="true" className="p-8 border-t border-gray-200 text-center">
                <div className="space-y-3">
                    <PrimitiveButton asChild>
                        <Link href="/?scroll_to=newsletter-signup">Subscribe to Newsletter</Link>
                    </PrimitiveButton>
                </div>
                <p className="text-xs text-gray-500 mt-4 max-w-xs mx-auto">
                    Stay updated with our latest offers and news.
                </p>
            </div>

            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-gray-300 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Post-Booking Section */}
      <div className="w-full max-w-2xl mx-auto mt-12 text-center text-gray-700">
        <p className="mb-4">
            Thank you for booking with Lauryn Luxe Beauty Studio. We have
            received your appointment details.
        </p>
        <div className="flex justify-center mb-8">
          <Button onClick={handleDownloadTicket} className="bg-black text-white hover:ring-black">
            Download Ticket
          </Button>
        </div>
      </div>
    </div>
  )
}
