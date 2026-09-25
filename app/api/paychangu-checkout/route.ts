import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logPaymentEvent } from '@/lib/paymentLogger';
import { getSlotsForDate } from '@/lib/time-slots';

export async function POST(req: Request) {
  try {
    const { formData, loyaltyDiscountEligible, amount, callback_url, return_url } = await req.json();

    // SERVER-SIDE VALIDATION: Ensure the requested time slot is actually valid for the selected date
    // This prevents "ghost" slots like Friday 3PM which don't exist in the system logic.
    if (formData.date && formData.timeSlot) {
      const bookingDate = new Date(formData.date);
      const possibleSlots = getSlotsForDate(bookingDate);

      if (!possibleSlots.includes(formData.timeSlot)) {
        console.error('❌ [PAYCHANGU-CHECKOUT] Invalid time slot requested:', {
          date: formData.date,
          slot: formData.timeSlot,
          allowed: possibleSlots
        });
        return NextResponse.json({
          message: `The time slot ${formData.timeSlot} is not available for ${formData.date}.`
        }, { status: 400 });
      }
    }

    console.log('🚀 [PAYCHANGU-CHECKOUT] Starting payment checkout process:', {
      customerName: formData?.name,
      customerPhone: formData?.phone,
      customerEmail: formData?.email,
      bookingDate: formData?.date,
      bookingTime: formData?.timeSlot,
      services: formData?.services,
      amount,
      loyaltyDiscountEligible,
      timestamp: new Date().toISOString()
    });

    const PAYCHANGU_SECRET_KEY = process.env.PAYCHANGU_SECRET_KEY;

    if (!PAYCHANGU_SECRET_KEY) {
      console.error('❌ [PAYCHANGU-CHECKOUT] Configuration error: PAYCHANGU_SECRET_KEY not configured');
      return NextResponse.json({ message: 'Paychangu secret key not configured.' }, { status: 500 });
    }

    // Construct tx_ref unique for every transaction
    const tx_ref = `LLB-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

    console.log('🆔 [PAYCHANGU-CHECKOUT] Generated transaction reference:', {
      tx_ref,
      timestamp: new Date().toISOString()
    });

    // Create booking with status 'pending' if it doesn't already exist
    let booking = await prisma.booking.findUnique({ where: { ticketId: tx_ref } });
    if (!booking) {
      console.log('📝 [PAYCHANGU-CHECKOUT] Creating new booking with pending status:', {
        tx_ref,
        customerName: formData.name,
        customerPhone: formData.phone,
        bookingDate: formData.date,
        bookingTime: formData.timeSlot,
        timestamp: new Date().toISOString()
      });

      booking = await prisma.booking.create({
        data: {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          date: formData.date,
          timeSlot: formData.timeSlot,
          services: formData.services,
          notes: formData.notes,
          inspirationPhotos: formData.inspirationPhotos || [],
          ticketId: tx_ref,
          discountApplied: false, // Will be calculated during payment verification
          rescheduleCount: 0,
          originalDate: null,
          status: 'pending',
        },
      });

      console.log('✅ [PAYCHANGU-CHECKOUT] Booking created successfully:', {
        tx_ref,
        bookingId: booking.id,
        status: 'pending',
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('ℹ️ [PAYCHANGU-CHECKOUT] Booking already exists:', {
        tx_ref,
        bookingId: booking.id,
        currentStatus: booking.status,
        timestamp: new Date().toISOString()
      });
    }

    // Log event: checkout_initiated
    await logPaymentEvent({
      txRef: tx_ref,
      bookingId: booking?.id,
      eventType: 'checkout_initiated',
      status: 'pending',
      message: 'Checkout initiated and booking persisted (pending)'
    });

    const paychanguRequestBody = {
      amount,
      currency: "MWK", // Assuming MWK as per your project's context
      email: formData.email,
      first_name: formData.name.split(' ')[0] || formData.name,
      last_name: formData.name.split(' ').slice(1).join(' ') || formData.name,
      callback_url,
      return_url,
      tx_ref,
      customization: {
        title: "Lauryn Luxe Booking Deposit",
        description: "Booking deposit for Lauryn Luxe Beauty Studio",
      },
      meta: {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        date: formData.date,
        timeSlot: formData.timeSlot,
        services: formData.services,
        notes: formData.notes,
        inspirationPhotos: formData.inspirationPhotos || [],
        loyaltyDiscountEligible: loyaltyDiscountEligible, // Example: passing loyalty status
      },
    };

    console.log('📤 [PAYCHANGU-CHECKOUT] Sending request to PayChangu API:', {
      tx_ref,
      amount,
      currency: "MWK",
      customerEmail: formData.email,
      callback_url,
      return_url,
      timestamp: new Date().toISOString()
    });
    await logPaymentEvent({
      txRef: tx_ref,
      bookingId: booking?.id,
      eventType: 'checkout_request',
      message: 'POST /payment to PayChangu',
      payload: { amount, currency: 'MWK', email: formData.email, callback_url, return_url },
    });

    const paychanguResponse = await fetch('https://api.paychangu.com/payment', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${PAYCHANGU_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paychanguRequestBody),
    });

    const paychanguData = await paychanguResponse.json();

    console.log('📥 [PAYCHANGU-CHECKOUT] PayChangu API response received:', {
      tx_ref,
      paychanguStatus: paychanguData.status,
      paychanguMessage: paychanguData.message,
      hasCheckoutUrl: !!paychanguData.data?.checkout_url,
      timestamp: new Date().toISOString()
    });
    await logPaymentEvent({
      txRef: tx_ref,
      bookingId: booking?.id,
      eventType: 'checkout_response',
      status: paychanguData.status,
      httpStatus: paychanguResponse.status,
      message: paychanguData.message,
      payload: paychanguData,
    });

    if (paychanguResponse.ok && paychanguData.status === 'success' && paychanguData.data?.checkout_url) {
      console.log('✅ [PAYCHANGU-CHECKOUT] Payment checkout initiated successfully:', {
        tx_ref,
        customerName: formData.name,
        customerPhone: formData.phone,
        checkoutUrl: paychanguData.data.checkout_url,
        timestamp: new Date().toISOString()
      });
      await logPaymentEvent({
        txRef: tx_ref,
        bookingId: booking?.id,
        eventType: 'checkout_ready',
        status: 'success',
        message: 'Checkout URL generated',
        payload: { checkout_url: paychanguData.data.checkout_url },
      });

      return NextResponse.json({ checkout_url: paychanguData.data.checkout_url });
    } else {
      console.error('❌ [PAYCHANGU-CHECKOUT] PayChangu API error:', {
        tx_ref,
        customerName: formData.name,
        customerPhone: formData.phone,
        paychanguStatus: paychanguData.status,
        paychanguMessage: paychanguData.message,
        paychanguResponse: paychanguData,
        timestamp: new Date().toISOString()
      });
      await logPaymentEvent({
        txRef: tx_ref,
        bookingId: booking?.id,
        eventType: 'checkout_error',
        status: paychanguData.status,
        httpStatus: paychanguResponse.status,
        message: paychanguData.message || 'Failed to initiate payment',
        payload: paychanguData,
      });

      return NextResponse.json(
        { message: paychanguData.message || 'Failed to initiate payment with Paychangu.' },
        { status: paychanguResponse.status || 500 }
      );
    }
  } catch (error: any) {
    console.error('💥 [PAYCHANGU-CHECKOUT] Unexpected error during checkout process:', {
      error: error.message,
      errorStack: error.stack,
      timestamp: new Date().toISOString()
    });
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
} 