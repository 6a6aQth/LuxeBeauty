import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendBookingSMS } from '@/lib/sms';
import { logPaymentEvent } from '@/lib/paymentLogger';
import { successfulBookingsForPhone } from '@/lib/booking-phones';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tx_ref, formData } = body;

    console.log('🔍 [PAYCHANGU-VERIFY] Starting payment verification:', {
      tx_ref,
      customerName: formData?.name,
      customerPhone: formData?.phone,
      timestamp: new Date().toISOString()
    });

    if (!tx_ref || !formData) {
      console.error('❌ [PAYCHANGU-VERIFY] Missing data:', {
        hasTxRef: !!tx_ref,
        hasFormData: !!formData,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json({ error: 'Missing transaction reference or form data' }, { status: 400 });
    }

    // --- Start Real-time Verification with Retry Logic ---
    const secretKey = process.env.PAYCHANGU_SECRET_KEY;
    if (!secretKey) {
      console.error('❌ [PAYCHANGU-VERIFY] Configuration error: PAYCHANGU_SECRET_KEY not configured');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    const verificationUrl = `https://api.paychangu.com/verify-payment/${tx_ref}`;

    // Retry logic with exponential backoff
    let verificationData = null;
    let lastError = null;
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [PAYCHANGU-VERIFY] Attempt ${attempt}/${maxRetries} for tx_ref: ${tx_ref}`, {
          attempt,
          maxRetries,
          tx_ref,
          verificationUrl,
          timestamp: new Date().toISOString()
        });
        await logPaymentEvent({ txRef: tx_ref, eventType: 'verify_attempt', attempt, message: 'Starting verify attempt' });

        const verificationResponse = await fetch(verificationUrl, {
          headers: {
            'Authorization': `Bearer ${secretKey}`
          }
        });

        if (!verificationResponse.ok) {
          const errorBody = await verificationResponse.json().catch(() => ({ message: 'Could not parse error response from PayChangu.' }));
          console.error(`❌ [PAYCHANGU-VERIFY] API Error on attempt ${attempt}:`, {
            attempt,
            maxRetries,
            tx_ref,
            status: verificationResponse.status,
            statusText: verificationResponse.statusText,
            errorBody,
            timestamp: new Date().toISOString()
          });
          await logPaymentEvent({ txRef: tx_ref, eventType: 'verify_error', attempt, httpStatus: verificationResponse.status, message: 'Verify HTTP error', payload: errorBody });

          if (attempt === maxRetries) {
            console.error(`💥 [PAYCHANGU-VERIFY] All ${maxRetries} attempts failed for tx_ref: ${tx_ref}`, {
              tx_ref,
              totalAttempts: maxRetries,
              finalError: errorBody,
              timestamp: new Date().toISOString()
            });
            await logPaymentEvent({ txRef: tx_ref, eventType: 'verify_failed', attempt, message: 'All verify attempts failed' });
            return NextResponse.json({ error: 'Failed to verify transaction with payment provider after multiple attempts.' }, { status: 502 });
          }

          // Wait before retry with exponential backoff
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`⏳ [PAYCHANGU-VERIFY] Waiting ${delay}ms before retry ${attempt + 1} for tx_ref: ${tx_ref}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        verificationData = await verificationResponse.json();
        console.log(`✅ [PAYCHANGU-VERIFY] Success on attempt ${attempt} for tx_ref: ${tx_ref}`, {
          attempt,
          tx_ref,
          paychanguStatus: verificationData.status,
          paychanguDataStatus: verificationData.data?.status,
          paychanguAmount: verificationData.data?.amount,
          paychanguCurrency: verificationData.data?.currency,
          timestamp: new Date().toISOString()
        });
        await logPaymentEvent({ txRef: tx_ref, eventType: 'verify_success', attempt, status: verificationData.status, payload: verificationData });

        // If we get here, the request was successful
        break;

      } catch (error: any) {
        console.error(`💥 [PAYCHANGU-VERIFY] Network/parsing error on attempt ${attempt}:`, {
          attempt,
          maxRetries,
          tx_ref,
          error: error.message,
          errorStack: error.stack,
          timestamp: new Date().toISOString()
        });
        lastError = error;

        if (attempt === maxRetries) {
          console.error(`💥 [PAYCHANGU-VERIFY] All ${maxRetries} attempts failed due to network errors for tx_ref: ${tx_ref}`, {
            tx_ref,
            totalAttempts: maxRetries,
            finalError: lastError.message,
            timestamp: new Date().toISOString()
          });
          await logPaymentEvent({ txRef: tx_ref, eventType: 'verify_failed_network', attempt, message: 'All verify attempts failed (network)' });
          return NextResponse.json({ error: 'Failed to verify transaction with payment provider.' }, { status: 502 });
        }

        // Wait before retry with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ [PAYCHANGU-VERIFY] Waiting ${delay}ms before retry ${attempt + 1} for tx_ref: ${tx_ref}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Check if the transaction was successful according to PayChangu's data
    if (verificationData.status !== 'success' || (verificationData.data.status !== 'success' && verificationData.data.status !== 'paid')) {
      console.warn(`⚠️ [PAYCHANGU-VERIFY] Payment not yet successful according to PayChangu for tx_ref: ${tx_ref}`, {
        tx_ref,
        paychanguStatus: verificationData.status,
        paychanguDataStatus: verificationData.data?.status,
        paychanguMessage: verificationData.message,
        timestamp: new Date().toISOString()
      });
      await logPaymentEvent({ txRef: tx_ref, eventType: 'verify_provider_pending', status: verificationData.status, message: 'Provider returned not-success (pending)', payload: verificationData });

      // IMPORTANT: We DO NOT mark the booking as 'failed' here. 
      // We want to give the webhook or subsequent pulls a chance.
      // If it's explicitly 'failed' or 'cancelled' from Paychangu, we could, 
      // but often 'pending' just means we beat the webhook.

      if (verificationData.data?.status === 'failed' || verificationData.data?.status === 'expired') {
        await prisma.booking.update({
          where: { ticketId: tx_ref },
          data: { status: 'failed' },
        });
        await logPaymentEvent({ txRef: tx_ref, eventType: 'verify_mark_failed', status: 'failed', message: 'Marked failed after provider explicit failure' });
        return NextResponse.json({ error: 'Payment failed or expired according to provider.' }, { status: 400 });
      }

      // Return a 'processing' status to the frontend instead of an error
      return NextResponse.json({ status: 'processing', message: 'Payment is still being processed.' }, { status: 202 });
    }

    // Optional but recommended: Verify the amount paid is what you expect
    const expectedAmount = 10000; // The amount in MWK for the deposit
    if (verificationData.data.amount < expectedAmount) {
      console.warn(`⚠️ [PAYCHANGU-VERIFY] Insufficient payment amount for tx_ref: ${tx_ref}`, {
        tx_ref,
        expectedAmount,
        actualAmount: verificationData.data.amount,
        currency: verificationData.data.currency,
        timestamp: new Date().toISOString()
      });
      await logPaymentEvent({ txRef: tx_ref, eventType: 'verify_insufficient_amount', status: 'pending', message: 'Insufficient amount detected', payload: { expectedAmount, actualAmount: verificationData.data.amount } });

      // Again, don't mark as failed immediately if there's any ambiguity, 
      // but here the amount is definitively low. However, to be safe and avoid 
      // blocking a potentially corrected webhook, we just return an error to the user
      // without necessarily corrupting the DB state if they want to try verifying again.

      return NextResponse.json({ error: `Payment amount incorrect. Expected at least ${expectedAmount}, but got ${verificationData.data.amount}` }, { status: 400 });
    }

    // Loyalty Program Logic
    const booking = await prisma.booking.findUnique({ where: { ticketId: tx_ref } });
    if (!booking) {
      console.error(`❌ [PAYCHANGU-VERIFY] Booking not found in database for tx_ref: ${tx_ref}`, {
        tx_ref,
        timestamp: new Date().toISOString()
      });
      await logPaymentEvent({ txRef: tx_ref, eventType: 'verify_no_booking', message: 'Booking not found' });
      return NextResponse.json({ error: 'Booking not found for this transaction reference.' }, { status: 404 });
    }

    // Count successful bookings for the phone stored on the booking, including equivalent spellings.
    const existingSuccessfulBookingsCount = (await successfulBookingsForPhone(booking.phone, tx_ref)).length;
    const isEligibleForDiscount = (existingSuccessfulBookingsCount + 1) % 6 === 0;

    console.log(`🎯 [PAYCHANGU-VERIFY] Loyalty discount calculation for tx_ref: ${tx_ref}`, {
      tx_ref,
      customerPhone: formData.phone,
      existingSuccessfulBookingsCount,
      newBookingNumber: existingSuccessfulBookingsCount + 1,
      isEligibleForDiscount,
      discountLogic: `(${existingSuccessfulBookingsCount} + 1) % 6 === 0`,
      currentBookingDiscountApplied: booking.discountApplied,
      willUpdateDiscountApplied: isEligibleForDiscount,
      timestamp: new Date().toISOString()
    });

    // Update booking status to 'successful'
    const updatedBooking = await prisma.booking.update({
      where: { ticketId: tx_ref },
      data: {
        status: 'successful',
        discountApplied: isEligibleForDiscount,
      },
    });
    await logPaymentEvent({ txRef: tx_ref, bookingId: updatedBooking.id, eventType: 'verify_mark_success', status: 'successful', message: 'Marked booking successful' });

    console.log(`✅ [PAYCHANGU-VERIFY] Booking status updated to 'successful' for tx_ref: ${tx_ref}`, {
      tx_ref,
      customerName: formData.name,
      customerPhone: formData.phone,
      bookingDate: formData.date,
      bookingTime: formData.timeSlot,
      newStatus: 'successful',
      discountApplied: updatedBooking.discountApplied,
      timestamp: new Date().toISOString()
    });

    // Send SMS confirmation (non-blocking)
    try {
      await sendBookingSMS(
        booking.phone,
        `Thank you for booking with Lauryn Luxe! Your appointment is confirmed for ${formData.date} at ${formData.timeSlot}.`
      );
      console.log(`📱 [PAYCHANGU-VERIFY] SMS confirmation sent for tx_ref: ${tx_ref}`, {
        tx_ref,
        customerPhone: formData.phone,
        smsContent: `Thank you for booking with Lauryn Luxe! Your appointment is confirmed for ${formData.date} at ${formData.timeSlot}.`,
        timestamp: new Date().toISOString()
      });
    } catch (smsError: any) {
      console.error(`❌ [PAYCHANGU-VERIFY] SMS sending failed for tx_ref: ${tx_ref}`, {
        tx_ref,
        customerPhone: formData.phone,
        smsError: smsError.message,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🎉 [PAYCHANGU-VERIFY] Payment verification completed successfully for tx_ref: ${tx_ref}`, {
      tx_ref,
      customerName: formData.name,
      customerPhone: formData.phone,
      bookingDate: formData.date,
      bookingTime: formData.timeSlot,
      paychanguAmount: verificationData.data.amount,
      paychanguCurrency: verificationData.data.currency,
      finalStatus: 'successful',
      timestamp: new Date().toISOString()
    });

    return NextResponse.json(updatedBooking);

  } catch (error: any) {
    console.error(`💥 [PAYCHANGU-VERIFY] Unexpected error during verification:`, {
      error: error.message,
      errorStack: error.stack,
      timestamp: new Date().toISOString()
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}