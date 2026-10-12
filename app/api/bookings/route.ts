import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { phonesMatch } from '@/lib/phone';
import { heldBookingWhere } from '@/lib/slots';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');
    const phoneFilter = searchParams.get('phone');
    const referenceFilter = searchParams.get('reference') || searchParams.get('ticketId');

    if (searchParams.get('availability') === '1') {
      const rows = await prisma.booking.findMany({
        where: heldBookingWhere(),
        select: { date: true, timeSlot: true, reference: true, status: true },
      });
      return NextResponse.json(rows);
    }
    
    let whereClause = {};
    
    if (referenceFilter) {
      whereClause = { reference: referenceFilter };
    } else if (!statusFilter || statusFilter === 'successful') {
      whereClause = { status: 'successful' };
    } else if (statusFilter === 'all') {
      whereClause = {};
    } else {
      whereClause = { status: statusFilter };
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
      include: referenceFilter ? { payment: { select: { method: true } } } : undefined,
    });

    if (referenceFilter && bookings.length > 0) {
      const booking = bookings[0];
      const serviceIds = booking.services;
      
      const services = await prisma.service.findMany({
        where: {
          id: {
            in: serviceIds
          }
        },
        select: {
          id: true,
          name: true
        }
      });

      const serviceMapping = services.reduce((acc, service) => {
        acc[service.name] = service.id;
        return acc;
      }, {} as Record<string, string>);

      const updatedBooking = {
        ...booking,
        services: serviceIds,
        serviceNames: serviceIds.map(id => {
          const service = services.find(s => s.id === id);
          return service ? service.name : id;
        }),
        serviceMapping
      };

      return NextResponse.json([updatedBooking]);
    }

    const matched = phoneFilter
      ? bookings.filter((booking) => phonesMatch(booking.phone, phoneFilter))
      : bookings;
    return NextResponse.json(matched);
  } catch (error) {
    console.error('Failed to fetch bookings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Booking creation is now handled only after payment verification.
  // This endpoint is disabled to prevent duplicate or unpaid bookings.
  return NextResponse.json({ error: 'Booking creation is disabled. Use payment flow.' }, { status: 403 });
} 