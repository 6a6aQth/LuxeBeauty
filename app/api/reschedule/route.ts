import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logPaymentEvent } from '@/lib/paymentLogger';
import { parseISO, isAfter, subDays, isValid } from 'date-fns';

export async function POST(req: NextRequest) {
  try {
    const { ticketId, newDate, newTimeSlot, newServices } = await req.json();

    console.log('🔄 [RESCHEDULE] Starting reschedule process:', {
      ticketId,
      newDate,
      newTimeSlot,
      newServices,
      timestamp: new Date().toISOString()
    });

    // Validate required fields
    if (!ticketId || !newDate || !newTimeSlot) {
      return NextResponse.json({ 
        error: 'Ticket ID, new date, and new time slot are required' 
      }, { status: 400 });
    }

    // Validate services if provided
    if (newServices && (!Array.isArray(newServices) || newServices.length === 0)) {
      return NextResponse.json({ 
        error: 'Services must be a non-empty array' 
      }, { status: 400 });
    }

    // Find the booking
    const booking = await prisma.booking.findUnique({
      where: { ticketId }
    });

    if (!booking) {
      return NextResponse.json({ 
        error: 'Booking not found with this ticket ID' 
      }, { status: 404 });
    }

    // Check if booking is successful (only successful bookings can be rescheduled)
    if (booking.status !== 'successful') {
      return NextResponse.json({ 
        error: 'Only confirmed bookings can be rescheduled' 
      }, { status: 400 });
    }

    // Check if the appointment date has already passed (no rescheduling after appointment date)
    const appointmentDate = parseISO(booking.date);
    if (!isValid(appointmentDate)) {
      return NextResponse.json({ 
        error: 'Invalid booking date format' 
      }, { status: 400 });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const appointmentDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());
    
    if (appointmentDay < today) {
      return NextResponse.json({ 
        error: 'Cannot reschedule after the appointment date has passed' 
      }, { status: 400 });
    }

    // Check reschedule count (only allow 1 reschedule)
    if (booking.rescheduleCount >= 1) {
      return NextResponse.json({ 
        error: 'This booking has already been rescheduled once. No further reschedules allowed.' 
      }, { status: 400 });
    }

    // Parse current booking date
    const currentBookingDate = parseISO(booking.date);
    if (!isValid(currentBookingDate)) {
      return NextResponse.json({ 
        error: 'Invalid booking date format' 
      }, { status: 400 });
    }

    // Check if reschedule is within 24 hours of booking date
    const twentyFourHoursBeforeBooking = subDays(currentBookingDate, 1);
    
    if (isAfter(now, twentyFourHoursBeforeBooking)) {
      return NextResponse.json({ 
        error: 'Rescheduling is only allowed up to 24 hours before the appointment date' 
      }, { status: 400 });
    }

    // Validate new date format
    const newBookingDate = parseISO(newDate);
    if (!isValid(newBookingDate)) {
      return NextResponse.json({ 
        error: 'Invalid new date format' 
      }, { status: 400 });
    }

    // Check if new date is in the future
    if (!isAfter(newBookingDate, now)) {
      return NextResponse.json({ 
        error: 'New appointment date must be in the future' 
      }, { status: 400 });
    }

    // Check if new date is not more than 1 year in the future
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    if (isAfter(newBookingDate, oneYearFromNow)) {
      return NextResponse.json({ 
        error: 'New appointment date cannot be more than 1 year in the future' 
      }, { status: 400 });
    }

    // Check for conflicts with existing bookings on the new date/time
    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        date: newDate,
        timeSlot: newTimeSlot,
        status: 'successful',
        NOT: { ticketId } // Exclude current booking
      }
    });

    if (conflictingBooking) {
      return NextResponse.json({ 
        error: 'The selected date and time slot is already booked' 
      }, { status: 400 });
    }

    // Store original date if this is the first reschedule
    const originalDate = booking.originalDate || booking.date;

    // Prepare update data
    const updateData = {
      date: newDate,
      timeSlot: newTimeSlot,
      rescheduleCount: booking.rescheduleCount + 1,
      originalDate: originalDate,
      updatedAt: new Date()
    };

    // Include services if provided
    if (newServices) {
      updateData.services = newServices;
    }

    // Update the booking
    const updatedBooking = await prisma.booking.update({
      where: { ticketId },
      data: updateData
    });

    // Log the reschedule event
    await logPaymentEvent({
      txRef: ticketId,
      bookingId: booking.id,
      eventType: 'booking_rescheduled',
      status: 'successful',
      message: `Booking rescheduled from ${booking.date} ${booking.timeSlot} to ${newDate} ${newTimeSlot}`,
      payload: {
        originalDate: booking.date,
        originalTimeSlot: booking.timeSlot,
        newDate,
        newTimeSlot,
        rescheduleCount: updatedBooking.rescheduleCount
      }
    });

    console.log('✅ [RESCHEDULE] Booking rescheduled successfully:', {
      ticketId,
      bookingId: booking.id,
      customerName: booking.name,
      originalDate: booking.date,
      originalTimeSlot: booking.timeSlot,
      newDate,
      newTimeSlot,
      rescheduleCount: updatedBooking.rescheduleCount,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      message: 'Booking rescheduled successfully',
      booking: {
        id: updatedBooking.id,
        ticketId: updatedBooking.ticketId,
        name: updatedBooking.name,
        phone: updatedBooking.phone,
        email: updatedBooking.email,
        date: updatedBooking.date,
        timeSlot: updatedBooking.timeSlot,
        services: updatedBooking.services,
        rescheduleCount: updatedBooking.rescheduleCount,
        originalDate: updatedBooking.originalDate
      }
    });

  } catch (error: any) {
    console.error('💥 [RESCHEDULE] Unexpected error during reschedule:', {
      error: error.message,
      errorStack: error.stack,
      timestamp: new Date().toISOString()
    });
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// GET endpoint to retrieve booking details for reschedule form
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ticketId = searchParams.get('ticketId');

    if (!ticketId) {
      return NextResponse.json({ 
        error: 'Ticket ID is required' 
      }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { ticketId }
    });

    if (!booking) {
      return NextResponse.json({ 
        error: 'Booking not found with this ticket ID' 
      }, { status: 404 });
    }

    // Check if booking is successful
    if (booking.status !== 'successful') {
      return NextResponse.json({ 
        error: 'Only confirmed bookings can be rescheduled' 
      }, { status: 400 });
    }

    // Check if the appointment date has already passed (no rescheduling after appointment date)
    const appointmentDate = parseISO(booking.date);
    if (!isValid(appointmentDate)) {
      return NextResponse.json({ 
        error: 'Invalid booking date format' 
      }, { status: 400 });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const appointmentDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());
    
    if (appointmentDay < today) {
      return NextResponse.json({ 
        error: 'Cannot reschedule after the appointment date has passed' 
      }, { status: 400 });
    }

    // Check reschedule count
    if (booking.rescheduleCount >= 1) {
      return NextResponse.json({ 
        error: 'This booking has already been rescheduled once. No further reschedules allowed.' 
      }, { status: 400 });
    }

    // Check if reschedule is within 24 hours of booking date
    const currentBookingDate = parseISO(booking.date);
    if (!isValid(currentBookingDate)) {
      return NextResponse.json({ 
        error: 'Invalid booking date format' 
      }, { status: 400 });
    }

    const twentyFourHoursBeforeBooking = subDays(currentBookingDate, 1);
    
    if (isAfter(now, twentyFourHoursBeforeBooking)) {
      return NextResponse.json({ 
        error: 'Rescheduling is only allowed up to 24 hours before the appointment date' 
      }, { status: 400 });
    }

    return NextResponse.json({
      booking: {
        id: booking.id,
        ticketId: booking.ticketId,
        name: booking.name,
        phone: booking.phone,
        email: booking.email,
        date: booking.date,
        timeSlot: booking.timeSlot,
        services: booking.services,
        notes: booking.notes,
        rescheduleCount: booking.rescheduleCount,
        originalDate: booking.originalDate
      }
    });

  } catch (error: any) {
    console.error('💥 [RESCHEDULE-GET] Unexpected error:', {
      error: error.message,
      errorStack: error.stack,
      timestamp: new Date().toISOString()
    });
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
