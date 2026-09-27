import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { phonesMatch } from '@/lib/phone';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');
    const phoneFilter = searchParams.get('phone');
    const ticketIdFilter = searchParams.get('ticketId');
    
    let whereClause = {};
    
    // If ticketId is provided, find specific booking
    if (ticketIdFilter) {
      whereClause = { ticketId: ticketIdFilter };
    } else {
      // If no status filter is specified, only show successful bookings
      if (!statusFilter || statusFilter === 'successful') {
        whereClause = { status: 'successful' };
      } else if (statusFilter === 'all') {
        // Show all bookings regardless of status
        whereClause = {};
      } else {
        // Filter by specific status
        whereClause = { status: statusFilter };
      }

    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // If ticketId filter is used, fetch service names for the booking
    if (ticketIdFilter && bookings.length > 0) {
      const booking = bookings[0];
      const serviceIds = booking.services;
      
      // Fetch service names from the database
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

      // Create a mapping of service names to IDs for the booking form
      const serviceMapping = services.reduce((acc, service) => {
        acc[service.name] = service.id;
        return acc;
      }, {} as Record<string, string>);

      // Update the booking with both service names and IDs
      const updatedBooking = {
        ...booking,
        services: serviceIds, // Keep original IDs for form
        serviceNames: serviceIds.map(id => {
          const service = services.find(s => s.id === id);
          return service ? service.name : id; // Fallback to ID if service not found
        }),
        serviceMapping // Include mapping for reference
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