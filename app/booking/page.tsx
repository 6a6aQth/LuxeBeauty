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
import { amountForMethod, formatMwk } from "@/lib/money"
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

type PayMethod = MobileOperator | "bank"

type BankDetails = {
  bank: string
  name: string
  number: string
}

type PendingCharge = {
  chargeId: string
  reference: string
  operator: PayMethod
  mobile: string
  formData: Record<string, unknown>
  useSession: boolean
  expiresAt: string | null
  submitToken: string
  bank?: BankDetails | null
}

function readPendingCharge(): PendingCharge | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CHARGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingCharge>
    if (!parsed.chargeId || !parsed.formData) return null
    if (parsed.operator !== "tnm" && parsed.operator !== "airtel" && parsed.operator !== "bank") return null
    if (parsed.operator !== "bank" && !parsed.mobile) return null
    return {
      chargeId: parsed.chargeId,
      reference: parsed.reference || "",
      operator: parsed.operator,
      mobile: parsed.mobile || "",
      formData: parsed.formData,
      useSession: Boolean(parsed.useSession),
      expiresAt: parsed.expiresAt ?? null,
      submitToken: parsed.submitToken || "",
      bank: parsed.bank,
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
  const [step, setStep] = useState<'form' | 'payment' | 'awaiting' | 'bank' | 'failed' | 'ticket'>('form')
  const [operator, setOperator] = useState<PayMethod | null>(null)
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null)
  const [bankWatching, setBankWatching] = useState(false)
  const [paymentExpiresAt, setPaymentExpiresAt] = useState<string | null>(null)
  const [reference, setReference] = useState("")
  const submitToken = useRef("")
  const [payerNumber, setPayerNumber] = useState('')
  const [chargeId, setChargeId] = useState('')
  const [failureMessage, setFailureMessage] = useState('')
  const [allowRetry, setAllowRetry] = useState(true)
  const [cancelConfirm, setCancelConfirm] = useState(false)
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
      setReference(openCharge.reference);
      setOperator(openCharge.operator);
      setPayerNumber(openCharge.mobile);
      setPaymentExpiresAt(openCharge.expiresAt);
      submitToken.current = openCharge.submitToken;
      if (openCharge.operator === "bank") {
        setBankDetails(openCharge.bank ?? null);
        setStep("bank");
      } else {
        setStep("awaiting");
      }
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
  const { data: bookingsData = [] } = useSWR('/api/bookings?availability=1', fetcher, { refreshInterval: 1000 });

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
      bookingsData.forEach((booking: { date?: string; timeSlot?: string }) => {
        if (!booking.date || !booking.timeSlot) return;
        if (!slots[booking.date]) slots[booking.date] = [];
        slots[booking.date].push(booking.timeSlot);
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
        router.push(`/booking/confirmation?ticketId=${encodeURIComponent(data.booking.reference || data.booking.ticketId)}`);
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

  const showTicket = (booking: {
    name: string
    date: string
    timeSlot: string
    services: string[]
    reference?: string
    ticketId?: string
    discountApplied?: boolean
    method?: string
  }) => {
    clearPendingCharge();
    submitToken.current = "";
    const ticket = booking.reference || booking.ticketId || "";
    const fee = `${formatMwk(amountForMethod(booking.method))} (Paid)`
    sessionStorage.setItem('lauryn-luxe-booking', JSON.stringify({
      ticketId: ticket,
      reference: ticket,
      fee,
    }));
    setTicketDetails({
      name: booking.name,
      date: booking.date,
      timeSlot: booking.timeSlot,
      services: booking.services,
      fee,
      ticketId: ticket,
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
      setReference(openCharge.reference);
      setPaymentExpiresAt(openCharge.expiresAt);
      setOperator(openCharge.operator);
      submitToken.current = openCharge.submitToken;
      if (openCharge.operator === "bank") {
        setBankDetails(openCharge.bank ?? null);
        setStep("bank");
      } else {
        setStep("awaiting");
      }
      setIsPaying(true);
      toast({
        title: "Payment still open",
        description: "Finish the payment already started. A new one would charge you again.",
      });
      return;
    }

    if (operator !== "tnm" && operator !== "airtel" && operator !== "bank") {
      toast({
        title: "Choose how to pay",
        description: "Select TNM Mpamba, Airtel Money, or Bank Transfer.",
        variant: "destructive",
      });
      return;
    }

    let payer = "";
    if (operator !== "bank") {
      const local = localMobileMoneyNumber(payerNumber, operator);
      if (!local) {
        toast({
          title: "Mobile money number",
          description: operator === "tnm"
            ? "TNM Mpamba needs a Malawi number starting with 08."
            : "Airtel Money needs a Malawi number starting with 09.",
          variant: "destructive",
        });
        return;
      }
      payer = local;
    }

    if (payLock.current) return;
    payLock.current = true;
    setIsPaying(true);
    setFailureMessage('');
    try {
      const token = submitToken.current || crypto.randomUUID();
      submitToken.current = token;
      const response = await fetch('/api/paychangu-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData,
          useSession: accountBooking || Boolean(session?.user),
          operator,
          mobile: payer,
          submitToken: token,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !data.chargeId) {
        submitToken.current = "";
        throw new Error(data.message || 'Failed to start the payment.');
      }
      const details: BankDetails | null = data.account?.number
        ? { bank: String(data.account.bank || ""), name: String(data.account.name || ""), number: String(data.account.number) }
        : null;
      const pending: PendingCharge = {
        chargeId: data.chargeId,
        reference: String(data.reference || ""),
        operator,
        mobile: payer,
        formData,
        useSession: accountBooking || Boolean(session?.user),
        expiresAt: data.expiresAt ? String(data.expiresAt) : null,
        submitToken: token,
        bank: details,
      };
      writePendingCharge(pending);
      setChargeId(data.chargeId);
      setReference(pending.reference);
      setPaymentExpiresAt(pending.expiresAt);
      setBankDetails(details);
      setStep(operator === "bank" ? "bank" : "awaiting");
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
    submitToken.current = "";
    payLock.current = false;
    setChargeId('');
    setReference('');
    setPaymentExpiresAt(null);
    setBankDetails(null);
    setFailureMessage('');
    setCancelConfirm(false);
    setIsPaying(false);
    setLoading(false);
    setStep('payment');
  };

  const applyPaymentView = (data: {
    status?: string
    message?: string
    expiresAt?: string | null
    account?: { bank?: string; name?: string; number?: string }
    booking?: {
      name: string
      date: string
      timeSlot: string
      services: string[]
      reference?: string
      discountApplied?: boolean
      method?: string
    }
  }) => {
    if (data.expiresAt) setPaymentExpiresAt(data.expiresAt);
    if (data.account?.number) {
      const details: BankDetails = {
        bank: String(data.account.bank || ""),
        name: String(data.account.name || ""),
        number: String(data.account.number),
      };
      setBankDetails(details);
      const pending = readPendingCharge();
      if (pending) writePendingCharge({ ...pending, bank: details, expiresAt: data.expiresAt ?? pending.expiresAt });
    }
    if (data.status === "successful" && data.booking) {
      showTicket(data.booking);
      return true;
    }
    if (data.status && ["failed", "expired", "cancelled", "review", "refund"].includes(data.status)) {
      if (data.status !== "review" && data.status !== "refund") clearPendingCharge();
      setFailureMessage(data.message || "Payment was not completed.");
      setAllowRetry(data.status !== "review" && data.status !== "refund");
      setStep("failed");
      setIsPaying(false);
      payLock.current = false;
      return true;
    }
    if (data.message) setFailureMessage(data.message);
    return false;
  };

  const handleCancelPayment = async () => {
    if (!cancelConfirm) {
      setCancelConfirm(true);
      setFailureMessage("Cancelling closes this payment here. If you already approved it, we will still record it.");
      return;
    }

    const id = chargeId || readPendingCharge()?.chargeId || "";
    if (!id) {
      handleRetryPayment();
      return;
    }
    try {
      const response = await fetch("/api/pay/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeId: id }),
      });
      const data = await response.json();
      if (data.result === "already_paid" && data.view?.booking) {
        showTicket(data.view.booking);
        return;
      }
      if (data.result === "cancelled") {
        clearPendingCharge();
        submitToken.current = "";
        setFailureMessage("");
        setCancelConfirm(false);
        setBankWatching(false);
        setIsPaying(false);
        payLock.current = false;
        setStep("payment");
        return;
      }
      if (data.view) applyPaymentView(data.view);
    } catch {
      setFailureMessage("The connection dropped. Stay on this page if you already approved the payment.");
    }
  };

  useEffect(() => {
    if (step !== "bank") setBankWatching(false);
  }, [step]);

  const handleVerifyBank = () => {
    const id = chargeId || readPendingCharge()?.chargeId || "";
    if (!id || bankWatching) return;
    setFailureMessage("");
    setBankWatching(true);
  };

  useEffect(() => {
    const watching = step === "awaiting" || (step === "bank" && bankWatching);
    if (!watching || !chargeId) return;
    let stopped = false;
    let checking = false;
    let timer = 0;
    const started = Date.now();

    const tick = async () => {
      if (stopped || checking) return;
      checking = true;
      let finished = false;
      try {
        const response = await fetch("/api/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chargeId }),
        });
        const data = await response.json();
        if (!stopped) finished = applyPaymentView(data);
      } catch {
        // A dropped request is not a failed payment.
      } finally {
        checking = false;
      }
      if (stopped || finished) return;
      const elapsed = Date.now() - started;
      const delay = elapsed < 120000 ? 5000 : 10000;
      timer = window.setTimeout(tick, delay);
    };

    timer = window.setTimeout(tick, step === "bank" ? 3000 : 0);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [step, chargeId, bankWatching]);

  return (
    <div>
      <MultiStepLoader loadingStates={loadingStates} loading={loading} duration={1500} loop={false} />

      <PageHeader
        title="Book an Appointment"
        description="Schedule your appointment at Lauryn Luxe Beauty Studio and treat yourself to a luxurious beauty experience."
        backgroundImage="/IMG_7410.png"
      />

      <div className="container mx-auto overflow-x-hidden px-4 py-12" ref={bookingFormRef}>
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
          allowRetry={allowRetry}
          onRetry={handleRetryPayment}
          onCancelPayment={handleCancelPayment}
          cancelConfirm={cancelConfirm}
          ticketDetails={ticketDetails}
          bankDetails={bankDetails}
          onVerifyBank={handleVerifyBank}
          bankWatching={bankWatching}
          paymentExpiresAt={paymentExpiresAt}
          reference={reference}
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
