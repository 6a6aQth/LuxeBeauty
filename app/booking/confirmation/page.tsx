"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button as PrimitiveButton } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import Link from 'next/link'
import { BookingTicket } from '@/components/booking-ticket'
import { Service } from '@/types/types';

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
          <BookingTicket
            details={{
              name: bookingDetails.name,
              date: bookingDetails.date,
              timeSlot: bookingDetails.timeSlot,
              services: bookingDetails.services,
              fee: bookingDetails.fee,
              ticketId: bookingDetails.ticketId,
              discountApplied: bookingDetails.discountApplied,
              isReschedule: bookingDetails.isReschedule,
              originalDate: bookingDetails.originalDate,
            }}
            serviceNames={getServiceNames(bookingDetails.services)}
          />
          <div className="mt-6 text-center">
            <PrimitiveButton asChild>
              <Link href="/?scroll_to=newsletter-signup">Subscribe to Newsletter</Link>
            </PrimitiveButton>
          </div>
        </div>
      </div>

      {/* Post-Booking Section */}
      <div className="w-full max-w-2xl mx-auto mt-12 text-center text-gray-700">
        <p className="mb-4">
            Thank you for booking with Lauryn Luxe Beauty Studio. We have
            received your appointment details.
        </p>
      </div>
    </div>
  )
}
