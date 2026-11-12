/**
 * GET /api/slots?date=YYYY-MM-DD
 *
 * Returns the available slots for a specific date, including the 08:00 overflow slot
 * (FR-33 / 25.0) when every regular slot on that date has at least one successful booking.
 *
 * Response shape:
 *   {
 *     slots: string[],           // all slots available to book on that date
 *     overflowIncluded: boolean, // true when "08:00" is in the list
 *   }
 *
 * "Available" means: defined for that weekday, NOT in UnavailableDate.timeSlots,
 * and NOT already held by a successful or unexpired-pending booking.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSlotsForDate, OVERFLOW_SLOT } from '@/lib/time-slots';
import { isOverflowSlotAvailable } from '@/lib/payments';
import { heldBookingWhere } from '@/lib/slots';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');

    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json({ error: 'date param required (YYYY-MM-DD)' }, { status: 400 });
    }

    const date = new Date(`${dateParam}T12:00:00Z`);

    // All regular slots for this weekday
    const regularSlots = getSlotsForDate(date);
    if (regularSlots.length === 0) {
      // Sunday or invalid — no slots
      return NextResponse.json({ slots: [], overflowIncluded: false });
    }

    // Manually blocked slots from admin
    const unavailableRow = await prisma.unavailableDate.findUnique({
      where: { date: dateParam },
      select: { timeSlots: true },
    });
    const manuallyBlocked: string[] = unavailableRow?.timeSlots ?? [];

    // Slots held by existing bookings (successful or pending-within-window)
    const heldBookings = await prisma.booking.findMany({
      where: { date: dateParam, ...heldBookingWhere() },
      select: { timeSlot: true },
    });
    const heldSlotSet = new Set(heldBookings.map((b) => b.timeSlot));

    // Filter regular slots
    const availableRegular = regularSlots.filter(
      (slot) => !heldSlotSet.has(slot) && !manuallyBlocked.includes(slot)
    );

    // Check overflow slot (08:00): available only when ALL regular slots are fully booked
    let overflowIncluded = false;
    if (!manuallyBlocked.includes(OVERFLOW_SLOT) && !heldSlotSet.has(OVERFLOW_SLOT)) {
      overflowIncluded = await isOverflowSlotAvailable(dateParam);
    }

    const slots = overflowIncluded
      ? [OVERFLOW_SLOT, ...availableRegular]
      : availableRegular;

    return NextResponse.json({ slots, overflowIncluded });
  } catch (error) {
    console.error('[api/slots] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

