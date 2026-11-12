import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isOverflowSlotAvailable } from '@/lib/payments';
import { OVERFLOW_SLOT } from '@/lib/time-slots';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');

    const unavailableDates = await prisma.unavailableDate.findMany();

    // 25.0 / FR-33: When a specific date is requested, check whether the
    // 08:00 overflow slot is available for that date and append it to the
    // returned data so the booking form can surface the slot with its
    // "Early Access" badge. No change to the existing unavailableDate rows.
    if (dateParam) {
      const overflowOk = await isOverflowSlotAvailable(dateParam);
      return NextResponse.json({ unavailableDates, overflowAvailable: overflowOk, overflowSlot: OVERFLOW_SLOT });
    }

    return NextResponse.json(unavailableDates);
  } catch (error) {
    console.error('Failed to fetch unavailable dates:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { date, slots } = await req.json();

    if (!date || !slots) {
      return NextResponse.json({ error: 'Date and slots are required' }, { status: 400 });
    }

    const result = await prisma.unavailableDate.upsert({
      where: { date },
      update: { timeSlots: slots },
      create: { date, timeSlots: slots },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to update unavailable dates:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 