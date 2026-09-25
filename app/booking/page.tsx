"use client"

// Prevent prerender/static export errors on this interactive page
export const dynamic = 'force-dynamic'

import type React from "react"

import { useState, useEffect, useMemo, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { parseISO, format, isValid } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getSlotsForDate, formatTime } from "@/lib/time-slots"
import { Checkbox } from "@/components/ui/checkbox"
import { StudioPolicies } from "@/components/studio-policies"
import { AnimatedSection } from "@/components/ui/animated-section"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import BookingStatus from "@/components/booking-status"
import { PageHeader } from "@/components/page-header"
import { MultiStepLoader } from "@/components/ui/multi-step-loader"
import { FileUpload } from "@/components/ui/file-upload"
import { BookingForm } from "@/components/booking-form"
import useSWR from 'swr';
import Link from 'next/link';

declare global {
  interface Window {
    PaychanguCheckout?: any;
  }
}

const loadingStates = [
  { text: "Processing Payment" },
  { text: "Payment Received" },
  { text: "Generating Ticket" },
  { text: "Appointment Confirmed" },
]

// Helper to get tomorrow's date in yyyy-mm-dd format
function getMinBookingDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

// Helper to get max booking date (e.g., 1 year from now)
function getMaxBookingDate() {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().split('T')[0]
}

interface Booking {
  id: string;
  date: string;
  timeSlot: string;
}

async function verifyPaymentWithRetry(tx_ref: string, formData: any, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tx_ref, formData }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success' || data.status === 'paid' || data.success) {
        return data;
      }
    }
    await new Promise(r => setTimeout(r, delay));
  }
  throw new Error('Payment verification failed after multiple attempts.');
}


// Wrap the client component that uses useSearchParams in Suspense to satisfy Next.js CSR bailout
export default function Booking() {
  return (
    <Suspense fallback={null}>
      <BookingContent />
    </Suspense>
  );
}

function BookingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    services: [] as string[],
    timeSlot: "",
    date: "",
    notes: "",
    inspirationPhotos: [] as string[],
  })
  const [date, setDate] = useState<Date | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState<'form' | 'payment'>('form')
  const [isPaying, setIsPaying] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const bookingFormRef = useRef<HTMLDivElement>(null);
  const [paymentStarted, setPaymentStarted] = useState(false);
  const [paymentCancelled, setPaymentCancelled] = useState(false);
  const [loyaltyDiscountEligible, setLoyaltyDiscountEligible] = useState(false);
  const [isReschedule, setIsReschedule] = useState(false);
  const [rescheduleTicketId, setRescheduleTicketId] = useState('');

  useEffect(() => {
    // Primary path: sessionStorage handoff from lookup page
    const rescheduleData = sessionStorage.getItem('lauryn-luxe-reschedule-data');
    if (rescheduleData) {
      try {
        const data = JSON.parse(rescheduleData);
        if (data.isReschedule) {
          setFormData({
            name: data.name || "",
            phone: data.phone || "",
            email: data.email || "",
            services: data.services || [], // expects IDs
            timeSlot: "",
            date: "",
            notes: data.notes || "",
            inspirationPhotos: data.inspirationPhotos || [],
          });
          setIsReschedule(true);
          setRescheduleTicketId(data.ticketId);
          sessionStorage.removeItem('lauryn-luxe-reschedule-data');
          return; // done
        }
      } catch (error) {
        console.error('Error parsing reschedule data:', error);
      }
    }

    // Fallback path: if user refreshed, use URL params to rehydrate
    const isRescheduleParam = searchParams?.get('reschedule') === 'true';
    const ticketIdParam = searchParams?.get('ticketId');
    if (isRescheduleParam && ticketIdParam) {
      (async () => {
        try {
          const resp = await fetch(`/api/bookings?ticketId=${encodeURIComponent(ticketIdParam)}`);
          if (!resp.ok) throw new Error('Failed to fetch booking for reschedule');
          const results = await resp.json();
          const booking = results?.[0];
          if (!booking) throw new Error('Booking not found');

          setFormData({
            name: booking.name || "",
            phone: booking.phone || "",
            email: booking.email || "",
            services: booking.services || [], // IDs from API
            timeSlot: "",
            date: "",
            notes: booking.notes || "",
            inspirationPhotos: [],
          });
          setIsReschedule(true);
          setRescheduleTicketId(ticketIdParam);
        } catch (err) {
          console.error('Reschedule fallback load failed:', err);
        }
      })();
      return;
    }

    // New booking: clear stale caches
    sessionStorage.removeItem('lauryn-luxe-booking');
    localStorage.removeItem('lauryn-luxe-booking-form');
  }, [searchParams]);

  useEffect(() => {
    if (step === 'payment') {
      setTimeout(() => {
        bookingFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100); // A small delay to ensure the element is rendered
    }
  }, [step]);

  const fetcher = (url: string) => fetch(url).then(res => res.json());
  const { data: unavailableDatesData = [] } = useSWR('/api/unavailable-dates', fetcher, { refreshInterval: 1000 });
  const { data: bookingsData = [] } = useSWR('/api/bookings?status=successful', fetcher, { refreshInterval: 1000 });
  const { data: latestServices = [] } = useSWR('/api/services', fetcher, { refreshInterval: 0 });

  const unavailableSlots = useMemo(() => {
    const transformed: Record<string, string[]> = {};
    if (Array.isArray(unavailableDatesData)) {
      unavailableDatesData.forEach((item: any) => {
        transformed[item.date] = item.timeSlots;
      });
    }
    return transformed;
  }, [unavailableDatesData]);

  const bookedSlots = useMemo(() => {
    const slots: Record<string, string[]> = {};
    if (Array.isArray(bookingsData)) {
      bookingsData.forEach((booking: any) => {
        // Only count successful bookings for slot availability
        if (booking.status === 'successful') {
          if (!slots[booking.date]) slots[booking.date] = [];
          slots[booking.date].push(booking.timeSlot);
        }
      });
    }
    return slots;
  }, [bookingsData]);

  const availableSlotsForSelectedDate = useMemo(() => {
    if (!date) return [];
    const dateStr = format(date, "yyyy-MM-dd");
    const allPossibleSlots = getSlotsForDate(date);
    const bookedSlotsForDate = bookedSlots[dateStr] || [];
    const unavailableSlotsForDate = unavailableSlots[dateStr] || [];

    // Return only slots that are not booked and not manually unavailable
    return allPossibleSlots.filter(slot =>
      !bookedSlotsForDate.includes(slot) &&
      !unavailableSlotsForDate.includes(slot)
    );
  }, [date, bookedSlots, unavailableSlots]);

  const allUnavailableSlotsForDate = useMemo(() => {
    if (!date) return [];
    const dateStr = format(date, "yyyy-MM-dd");
    const bSlots = bookedSlots[dateStr] || [];
    const uSlots = unavailableSlots[dateStr] || [];
    const combined = [...new Set([...bSlots, ...uSlots])];
    return combined;
  }, [date, bookedSlots, unavailableSlots]);

  const fullyBookedDates = useMemo(() => {
    const allDates = new Set([...Object.keys(bookedSlots), ...Object.keys(unavailableSlots)]);
    const fullyBlockedDates: Date[] = [];

    for (const dateStr of allDates) {
      const allPossibleSlots = getSlotsForDate(parseISO(dateStr));
      if (allPossibleSlots.length === 0) continue;

      const isMorningBlocked = allPossibleSlots.every(slot =>
        (bookedSlots[dateStr]?.includes(slot)) || (unavailableSlots[dateStr]?.includes(slot))
      );

      if (isMorningBlocked) {
        const d = parseISO(dateStr);
        if (isValid(d)) {
          fullyBlockedDates.push(d);
        }
      }
    }

    return fullyBlockedDates;
  }, [bookedSlots, unavailableSlots]);

  // Check loyalty eligibility when phone or step changes to 'payment'
  useEffect(() => {
    const checkLoyalty = async () => {
      if (step === 'payment' && formData.phone) {
        try {
          // Get the user's successful bookings count from backend
          const res = await fetch(`/api/bookings?phone=${encodeURIComponent(formData.phone)}&status=successful`);
          if (res.ok) {
            const bookings = await res.json();
            const count = Array.isArray(bookings) ? bookings.length : 0;
            // Calculate if the next booking (current booking + 1) would be eligible
            if ((count + 1) % 6 === 0) {
              setLoyaltyDiscountEligible(true);
            } else {
              setLoyaltyDiscountEligible(false);
            }
          } else {
            setLoyaltyDiscountEligible(false);
          }
        } catch {
          setLoyaltyDiscountEligible(false);
        }
      } else {
        setLoyaltyDiscountEligible(false);
      }
    };
    checkLoyalty();
  }, [step, formData.phone]);

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
    setFormData((prev) => ({ ...prev, date: dateStr, timeSlot: "" })); // Reset timeslot
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.name || !formData.phone || !formData.email || formData.services.length === 0 || !formData.timeSlot) {
      toast({
        title: "Missing Information",
        description: "Please fill out all required fields, including name, phone, email, services, date, and a time slot.",
        variant: "destructive",
      });
      return;
    }
    // Real-time verification: fetch latest services and check availability
    const res = await fetch('/api/services');
    const services = await res.json();
    if (!Array.isArray(services)) {
      toast({
        title: 'Connection Error',
        description: 'Could not communicate with the server to verify your booking at this time. Please try again later.',
        variant: 'destructive',
      });
      return;
    }
    const unavailable = formData.services.filter(
      (id: string) => !services.some((s: any) => s.id === id && s.isAvailable)
    );
    if (unavailable.length > 0) {
      toast({
        title: 'Service Unavailable',
        description: 'One or more of your selected services became unavailable. Please update your selection.',
        variant: 'destructive',
      });
      return;
    }

    // If this is a reschedule, handle it directly without payment
    if (isReschedule && rescheduleTicketId) {
      setIsSubmitting(true);
      try {
        const response = await fetch('/api/reschedule', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ticketId: rescheduleTicketId,
            newDate: formData.date,
            newTimeSlot: formData.timeSlot,
            newServices: formData.services,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to reschedule booking');
        }

        // Store the updated booking data for ticket generation
        sessionStorage.setItem('lauryn-luxe-booking', JSON.stringify({
          ...data.booking,
          fee: 'Rescheduled - No Additional Charge',
          isReschedule: true,
          originalTicketId: rescheduleTicketId
        }));

        toast({
          title: "Reschedule Successful",
          description: `Your appointment has been rescheduled to ${format(parseISO(formData.date), "MMMM dd, yyyy")} at ${formatTime(formData.timeSlot)}.`,
        });

        // Redirect to confirmation page
        router.push('/booking/confirmation');
      } catch (error: any) {
        console.error('Reschedule error:', error);
        toast({
          title: "Reschedule Failed",
          description: error.message || "Could not reschedule your appointment. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Regular booking flow - proceed to payment
    setStep('payment');
  };

  const handlePayment = async () => {
    setPaymentStarted(true);
    setLoading(true);
    setIsPaying(true); // Indicate payment process has started

    // Save formData to sessionStorage before redirecting to Paychangu
    sessionStorage.setItem('lauryn-luxe-booking-form', JSON.stringify(formData));

    try {
      const response = await fetch('/api/paychangu-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formData,
          loyaltyDiscountEligible,
          // The amount should ideally be calculated on the server-side for security
          // but for now, we'll pass the hardcoded deposit amount
          amount: 10000,
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/booking/verifying`, // Your server's verification URL
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/booking/status`, // URL for failed/cancelled payments
        }),
      });

      const data = await response.json();

      if (response.ok && data.checkout_url) {
        window.location.href = data.checkout_url; // Redirect to Paychangu checkout page
      } else {
        throw new Error(data.message || 'Failed to initiate payment.');
      }
    } catch (error: any) {
      console.error("Payment initiation failed:", error);
      toast({
        title: "Payment Error",
        description: error.message || "Could not initiate payment. Please try again.",
        variant: "destructive",
      });
      setPaymentStarted(false); // Reset payment state
      setLoading(false);
      setIsPaying(false);
      // setPaymentCancelled(true); // You might want to explicitly set this if there's a specific UI for cancelled payments
    }
  };

  const handleFileChange = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];

    toast({ title: "Uploading...", description: "Your inspiration photo is being uploaded." });

    try {
      const response = await fetch(
        `/api/bookings/upload?filename=${file.name}`,
        {
          method: 'POST',
          body: file,
        }
      );

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const newBlob = await response.json();
      setFormData((prev) => ({
        ...prev,
        inspirationPhotos: [...prev.inspirationPhotos, newBlob.url],
      }));

      toast({ title: "Success!", description: "Photo uploaded successfully." });

    } catch (error) {
      console.error(error);
      toast({
        title: "Upload Failed",
        description: "Could not upload your photo. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <MultiStepLoader loadingStates={loadingStates} loading={loading} duration={1500} loop={false} />

      <PageHeader
        title="Book an Appointment"
        description="Schedule your visit to Lauryn Luxe Beauty Studio and treat yourself to a luxurious beauty experience."
        backgroundImage="/images/nails-1.jpeg"
      />

      <div className="container mx-auto py-12 px-4" ref={bookingFormRef}>
        <BookingForm
          formData={formData}
          setFormData={setFormData}
          date={date}
          handleDateSelect={handleDateSelect}
          fullyBookedDates={fullyBookedDates}
          step={step}
          isSubmitting={isSubmitting}
          handleSubmit={handleSubmit}
          handleSelectChange={handleSelectChange}
          availableSlotsForSelectedDate={availableSlotsForSelectedDate}
          unavailableSlots={allUnavailableSlotsForDate}
          formatTime={formatTime}
          isPaying={isPaying}
          agreedToTerms={agreedToTerms}
          setAgreedToTerms={setAgreedToTerms}
          handlePayment={handlePayment}
          setStep={setStep}
          loyaltyDiscountEligible={loyaltyDiscountEligible}
          isReschedule={isReschedule}
        />
      </div>

      <Dialog open={isSubmitting}>
        <DialogContent aria-describedby="booking-processing-description">
          <DialogHeader>
            <DialogTitle>Processing Booking</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600 mx-auto mb-4"></div>
              <p id="booking-processing-description" className="text-gray-600">Please wait while we process your booking...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {paymentCancelled && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-8 rounded shadow text-center">
            <h2 className="text-xl font-bold mb-4 text-red-600">Payment Cancelled</h2>
            <p className="mb-6">You cancelled the payment. Would you like to try booking again?</p>
            <button
              className="bg-brand-pink text-white px-4 py-2 rounded"
              onClick={() => {
                setPaymentCancelled(false);
                setPaymentStarted(false);
                setStep('form'); // Reset to booking form step
                // Optionally reset formData here if you want a full reset
              }}
            >
              Try Booking Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
