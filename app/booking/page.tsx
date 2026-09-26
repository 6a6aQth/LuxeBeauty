"use client"

// Prevent prerender/static export errors on this interactive page
export const dynamic = 'force-dynamic'

import type React from "react"

import { useState, useEffect, useMemo, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { canonicalPhone } from "@/lib/phone"
import { parseISO, format, isValid } from "date-fns"
import { getSlotsForDate, formatTime } from "@/lib/time-slots"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PageHeader } from "@/components/page-header"
import { MultiStepLoader } from "@/components/ui/multi-step-loader"
import { BookingForm } from "@/components/booking-form"
import useSWR from 'swr';
import { authClient } from "@/lib/auth/client"
import { formatDeposit } from "@/lib/deposit"
import { LuxuryMark } from "@/components/luxury-mark"
import { localMobileMoneyNumber, type MobileOperator } from "@/lib/mobile-money"
import type { TicketDetails } from "@/components/booking-ticket"

const loadingStates = [
  { text: "Processing Payment" },
  { text: "Payment Received" },
  { text: "Generating Ticket" },
  { text: "Appointment Confirmed" },
]

const PENDING_CHARGE_KEY = "lauryn-luxe-pending-charge"

type PendingCharge = {
  chargeId: string
  operator: MobileOperator
  mobile: string
  formData: Record<string, unknown>
  useSession: boolean
}

function readPendingCharge(): PendingCharge | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CHARGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingCharge>
    if (!parsed.chargeId || !parsed.mobile || !parsed.formData) return null
    if (parsed.operator !== "tnm" && parsed.operator !== "airtel") return null
    return {
      chargeId: parsed.chargeId,
      operator: parsed.operator,
      mobile: parsed.mobile,
      formData: parsed.formData,
      useSession: Boolean(parsed.useSession),
    }
  } catch {
    return null
  }
}

function writePendingCharge(charge: PendingCharge) {
  sessionStorage.setItem(PENDING_CHARGE_KEY, JSON.stringify(charge))
}

function clearPendingCharge() {
  sessionStorage.removeItem(PENDING_CHARGE_KEY)
}

// Wrap the client component that uses useSearchParams in Suspense to satisfy Next.js CSR bailout
export default function Booking() {
  return (
    <Suspense fallback={<LuxuryMark variant="page" />}>
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
  const [step, setStep] = useState<'form' | 'payment' | 'awaiting' | 'failed' | 'ticket'>('form')
  const [operator, setOperator] = useState<MobileOperator>('airtel')
  const [payerNumber, setPayerNumber] = useState('')
  const [chargeId, setChargeId] = useState('')
  const [failureMessage, setFailureMessage] = useState('')
  const [ticketDetails, setTicketDetails] = useState<TicketDetails | null>(null)
  const [isPaying, setIsPaying] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const bookingFormRef = useRef<HTMLDivElement>(null);
  const skipAccountFill = useRef(false);
  const [loyaltyDiscountEligible, setLoyaltyDiscountEligible] = useState(false);
  const [isReschedule, setIsReschedule] = useState(false);
  const [rescheduleTicketId, setRescheduleTicketId] = useState('');
  const [accountBooking, setAccountBooking] = useState(false);
  const { data: session } = authClient.useSession();

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
          skipAccountFill.current = true;
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
      skipAccountFill.current = true;
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

    // New booking: clear the finished-ticket cache, then resume an open charge
    // so a refresh does not start a second MWK payment.
    sessionStorage.removeItem('lauryn-luxe-booking');
    localStorage.removeItem('lauryn-luxe-booking-form');
    const openCharge = readPendingCharge();
    if (openCharge) {
      setChargeId(openCharge.chargeId);
      setStep('awaiting');
      setIsPaying(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isReschedule || skipAccountFill.current) return
    let cancelled = false
    async function loadProfile() {
      const response = await fetch("/api/account/profile")
      if (cancelled) return
      if (response.status === 401 || response.status === 503) return
      if (response.status === 404) {
        router.replace("/auth/continue")
        return
      }
      if (!response.ok) return
      const profile = await response.json()
      if (cancelled) return
      setFormData((prev) => ({
        ...prev,
        name: profile.name || prev.name,
        phone: profile.phone || prev.phone,
        email: profile.email || prev.email,
      }))
      setAccountBooking(true)
      void authClient.getSession()
    }
    loadProfile()
    return () => {
      cancelled = true
    }
  }, [isReschedule, router]);

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
    if (formData.phone && !canonicalPhone(formData.phone)) {
      toast({
        title: "Phone number",
        description: "That phone number format is not okay.",
        variant: "destructive",
      });
      return;
    }
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
        router.push(`/booking/confirmation?ticketId=${encodeURIComponent(data.booking.ticketId)}`);
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

  const payLock = useRef(false);
  const initializeSent = useRef('');

  const showTicket = (booking: {
    name: string
    date: string
    timeSlot: string
    services: string[]
    ticketId: string
    discountApplied?: boolean
  }) => {
    clearPendingCharge();
    sessionStorage.setItem('lauryn-luxe-booking', JSON.stringify({
      ticketId: booking.ticketId,
      fee: formatDeposit(),
    }));
    setTicketDetails({
      name: booking.name,
      date: booking.date,
      timeSlot: booking.timeSlot,
      services: booking.services,
      fee: formatDeposit(),
      ticketId: booking.ticketId,
      discountApplied: booking.discountApplied,
    });
    setFailureMessage('');
    setStep('ticket');
    setIsPaying(false);
    payLock.current = false;
  };

  const handlePayment = async () => {
    const openCharge = readPendingCharge();
    if (openCharge) {
      setChargeId(openCharge.chargeId);
      setStep('awaiting');
      setIsPaying(true);
      toast({
        title: "Payment still open",
        description: "Finish the payment already started. A new one would charge you again.",
      });
      return;
    }

    const payer = localMobileMoneyNumber(payerNumber, operator);
    if (!payer) {
      toast({
        title: "Mobile money number",
        description: operator === "tnm"
          ? "TNM Mpamba needs a Malawi number starting with 08."
          : "Airtel Money needs a Malawi number starting with 09.",
        variant: "destructive",
      });
      return;
    }

    if (payLock.current) return;
    payLock.current = true;
    setIsPaying(true);
    setFailureMessage('');
    try {
      const response = await fetch('/api/paychangu-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData,
          useSession: accountBooking || Boolean(session?.user),
          operator,
          mobile: payer,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.chargeId) {
        throw new Error(data.message || 'Failed to start the payment.');
      }
      const pending: PendingCharge = {
        chargeId: data.chargeId,
        operator,
        mobile: payer,
        formData,
        useSession: accountBooking || Boolean(session?.user),
      };
      writePendingCharge(pending);
      setChargeId(data.chargeId);
      setStep('awaiting');
    } catch (error: any) {
      payLock.current = false;
      toast({
        title: "Payment Error",
        description: error.message || "Could not start the payment. Please try again.",
        variant: "destructive",
      });
      setIsPaying(false);
    }
  };

  const handleRetryPayment = () => {
    clearPendingCharge();
    payLock.current = false;
    setChargeId('');
    setFailureMessage('');
    setIsPaying(false);
    setLoading(false);
    setStep('payment');
  };

  const handleAwaitingRetry = async () => {
    const openCharge = readPendingCharge();
    const id = chargeId || openCharge?.chargeId || '';
    if (!id) {
      handleRetryPayment();
      return;
    }
    try {
      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chargeId: id }),
      });
      const data = await response.json();
      if (data.status === 'success' && data.booking) {
        showTicket(data.booking);
        return;
      }
      if (data.status === 'failed' || data.status === 'absent') {
        handleRetryPayment();
        return;
      }
      toast({
        title: "Payment still open",
        description: "Stay on this page. Starting again would charge you a second time.",
      });
    } catch {
      toast({
        title: "Still checking",
        description: "The connection dropped. Stay on this page if you already approved the PIN.",
      });
    }
  };

  useEffect(() => {
    if (step !== 'awaiting' || !chargeId) return;
    const pending = readPendingCharge();
    if (!pending || pending.chargeId !== chargeId) return;
    if (initializeSent.current === chargeId) return;
    initializeSent.current = chargeId;

    void fetch('/api/paychangu-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'initialize',
        chargeId: pending.chargeId,
        formData: pending.formData,
        useSession: pending.useSession,
        operator: pending.operator,
        mobile: pending.mobile,
      }),
    }).then(async (initResponse) => {
      if (initResponse.ok) return;
      const body = await initResponse.json().catch(() => ({}));
      const message = String(body.message || '');
      const lower = message.toLowerCase();
      if (message && !lower.includes('expired') && !lower.includes('already')) {
        setFailureMessage(message);
      }
    }).catch(() => {
      initializeSent.current = '';
      setFailureMessage('The connection dropped. If you already approved the PIN, stay on this page.');
    });
  }, [step, chargeId]);

  useEffect(() => {
    if (step !== 'awaiting' || !chargeId) return;
    let stopped = false;

    const tick = async () => {
      try {
        const response = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chargeId }),
        });
        const data = await response.json();
        if (stopped) return;
        if (data.status === 'success' && data.booking) {
          showTicket(data.booking);
        } else if (data.status === 'failed') {
          clearPendingCharge();
          setFailureMessage(data.message || 'Payment was not approved.');
          setStep('failed');
          setIsPaying(false);
          payLock.current = false;
        } else if (data.status === 'review' && data.message) {
          setFailureMessage(data.message);
        }
      } catch {
        // Keep polling. A closed request is not a failed payment.
      }
    };

    tick();
    const interval = setInterval(tick, 4000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [step, chargeId]);

  return (
    <div>
      <MultiStepLoader loadingStates={loadingStates} loading={loading} duration={1500} loop={false} />

      <PageHeader
        title="Book an Appointment"
        description="Schedule your visit to Lauryn Luxe Beauty Studio and treat yourself to a luxurious beauty experience."
        backgroundImage="/IMG_7410.png"
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
          accountBooking={accountBooking}
          operator={operator}
          setOperator={setOperator}
          payerNumber={payerNumber}
          setPayerNumber={setPayerNumber}
          failureMessage={failureMessage}
          onRetry={handleRetryPayment}
          onAwaitingRetry={handleAwaitingRetry}
          ticketDetails={ticketDetails}
        />
      </div>

      <Dialog open={isSubmitting}>
        <DialogContent aria-describedby="booking-processing-description">
          <DialogHeader>
            <DialogTitle>Processing Booking</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <LuxuryMark size="block" className="py-2" />
              <p id="booking-processing-description" className="text-gray-600">Please wait while we process your booking...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
