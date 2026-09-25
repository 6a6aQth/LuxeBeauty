import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createHmac } from 'crypto';
import { sendBookingSMS } from '@/lib/sms';
import { successfulBookingsForPhone } from '@/lib/booking-phones';
import { logPaymentEvent } from '@/lib/paymentLogger';

export async function POST(req: NextRequest) {
  let txRefForLogging = 'unknown';
  try {
    const rawBody = await req.text();
    let body: any = {};
    try {
      body = JSON.parse(rawBody);
      txRefForLogging = body?.data?.tx_ref || body?.tx_ref || 'unknown';
    } catch (e) {
      console.error('❌ [PAYCHANGU-WEBHOOK] Failed to parse JSON body');
    }

    // LOG EVERY HIT IMMEDIATELY
    // This ensures we see that PayChangu is actually calling us
    await logPaymentEvent({
      txRef: txRefForLogging,
      eventType: 'webhook_hit',
      message: 'Webhook endpoint triggered',
      payload: {
        headers: Object.fromEntries(req.headers),
        bodySnippet: rawBody.substring(0, 500) // Log first 500 chars for safety
      }
    });

    const signature = req.headers.get('signature');
    const webhookSecret = process.env.PAYCHANGU_WEBHOOK_SECRET;

    if (!webhookSecret) {
      const errorMsg = 'Configuration error: PAYCHANGU_WEBHOOK_SECRET not configured';
      console.error(`❌ [PAYCHANGU-WEBHOOK] ${errorMsg}`);
      await logPaymentEvent({
        txRef: txRefForLogging,
        eventType: 'webhook_error',
        message: errorMsg,
        status: 'error'
      });
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    const computedSignature = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    if (!signature || computedSignature !== signature) {
      const errorMsg = !signature ? 'No signature header' : 'Invalid signature';
      console.error(`❌ [PAYCHANGU-WEBHOOK] ${errorMsg}`);
      await logPaymentEvent({
        txRef: txRefForLogging,
        eventType: 'webhook_error',
        message: errorMsg,
        status: 'unauthorized',
        payload: { received: signature, expected: computedSignature }
      });
      return NextResponse.json({ error: errorMsg }, { status: 401 });
    }

    console.log('✅ [PAYCHANGU-WEBHOOK] Signature verification successful');

    // 3. FLEXIBLE PAYLOAD PARSING
    // PayChangu documentation shows a flat structure, while previous logs showed nested 'data'.
    const eventType = body.event_type || body.event || body.type;
    const eventData = body.data || body; // Fallback to flat body if 'data' is missing
    const tx_ref = eventData?.tx_ref || body?.reference || txRefForLogging;

    console.log('📋 [PAYCHANGU-WEBHOOK] Event details:', {
      eventType,
      txRef: tx_ref,
      isFlat: !body.data,
      timestamp: new Date().toISOString()
    });

    // We only process successful payments
    const isSuccessEvent = eventType === 'payment.success' ||
      eventType === 'api.charge.payment' ||
      eventData?.status === 'success';

    if (!isSuccessEvent) {
      console.log('⚠️ [PAYCHANGU-WEBHOOK] Not a successful payment event:', {
        eventType,
        status: eventData?.status,
        timestamp: new Date().toISOString()
      });
      await logPaymentEvent({
        txRef: tx_ref,
        eventType: 'webhook_ignored',
        status: eventData?.status || 'ignored',
        message: 'Not a successful payment event',
        payload: body
      });
      return NextResponse.json({ message: 'Event ignored.' }, { status: 200 });
    }

    // 4. MANDATORY RE-QUERY (Per PayChangu Docs)
    // "Always Re-query: Whenever you receive a webhook notification... you should call our API again to verify"
    console.log(`🔍 [PAYCHANGU-WEBHOOK] Starting mandatory re-query for ${tx_ref}`);
    const secretKey = process.env.PAYCHANGU_SECRET_KEY;
    const verificationUrl = `https://api.paychangu.com/verify-payment/${tx_ref}`;

    let verificationData: any = null;
    try {
      const vResponse = await fetch(verificationUrl, {
        headers: { 'Authorization': `Bearer ${secretKey}` }
      });

      if (!vResponse.ok) {
        throw new Error(`Verification API returned ${vResponse.status}`);
      }
      verificationData = await vResponse.json();
    } catch (vError: any) {
      console.error('❌ [PAYCHANGU-WEBHOOK] Re-query failed:', vError.message);
      await logPaymentEvent({
        txRef: tx_ref,
        eventType: 'webhook_verify_failed',
        message: `Mandatory re-query failed: ${vError.message}`,
        status: 'error'
      });
      // We return 500 here to let PayChangu retry the webhook
      return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
    }

    // Check if the verified status is actually success
    if (verificationData.status !== 'success' || (verificationData.data?.status !== 'success' && verificationData.data?.status !== 'paid')) {
      console.warn('⚠️ [PAYCHANGU-WEBHOOK] Re-query returned non-success status:', verificationData.data?.status);
      await logPaymentEvent({
        txRef: tx_ref,
        eventType: 'webhook_verify_unconfirmed',
        status: verificationData.data?.status,
        message: 'Re-query did not confirm success',
        payload: verificationData
      });
      return NextResponse.json({ message: 'Payment not confirmed yet' }, { status: 200 });
    }

    // 5. PROCESS THE BOOKING
    const meta = verificationData.data?.meta || eventData?.meta || {};

    // Defensive: Check if booking exists
    const existing = await prisma.booking.findFirst({ where: { ticketId: tx_ref } });
    if (!existing) {
      console.error('❌ [PAYCHANGU-WEBHOOK] Booking not found in database:', tx_ref);
      await logPaymentEvent({
        txRef: tx_ref,
        eventType: 'webhook_no_booking',
        message: 'Booking not found for tx_ref',
        payload: { webhookBody: body, verificationData }
      });
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Skip if already successful
    if (existing.status === 'successful') {
      await logPaymentEvent({
        txRef: tx_ref,
        bookingId: existing.id,
        eventType: 'webhook_already_success',
        message: 'Booking already marked as successful'
      });
      return NextResponse.json({ message: 'Already processed' }, { status: 200 });
    }

    // Calculate loyalty discount
    const existingCount = (await successfulBookingsForPhone(existing.phone, tx_ref)).length;
    const isEligibleForDiscount = (existingCount + 1) % 6 === 0;

    // Update to successful
    const updatedBooking = await prisma.booking.update({
      where: { ticketId: tx_ref },
      data: {
        status: 'successful',
        discountApplied: isEligibleForDiscount,
      },
    });

    await logPaymentEvent({
      txRef: tx_ref,
      bookingId: updatedBooking.id,
      eventType: 'webhook_mark_success',
      status: 'successful',
      message: 'Marked booking successful via verified webhook',
      payload: { verificationData }
    });

    // Send SMS (non-blocking)
    try {
      const customerPhone = existing.phone;
      await sendBookingSMS(
        customerPhone,
        `Thank you for booking with Lauryn Luxe! Your appointment is confirmed for ${existing.date} at ${existing.timeSlot}.`
      );
    } catch (smsError: any) {
      console.error('❌ [PAYCHANGU-WEBHOOK] SMS failed:', smsError.message);
    }

    return NextResponse.json({ message: 'Booking updated', booking: updatedBooking }, { status: 200 });
  } catch (error: any) {
    console.error('💥 [PAYCHANGU-WEBHOOK] Unexpected error during webhook processing:', {
      error: error.message,
      txRef: txRefForLogging,
      timestamp: new Date().toISOString()
    });
    await logPaymentEvent({
      txRef: txRefForLogging,
      eventType: 'webhook_crash',
      message: error.message,
      status: 'error'
    });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
} 