import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { readServicePrice } from '@/lib/money';

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const services = await prisma.service.findMany({
      orderBy: {
        createdAt: 'asc',
      },
    });
    return NextResponse.json(services);
  } catch (error) {
    console.error('Failed to fetch services:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { services } = await req.json();

    if (!Array.isArray(services)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    const updatePromises = services.map(service => {
      const data: {
        name: string
        description: string | null
        duration: number
        category: string
        price?: number | null
      } = {
        name: service.name,
        description: service.description,
        duration: service.duration,
        category: service.category,
      }
      if (Object.prototype.hasOwnProperty.call(service, "price")) {
        const parsed = readServicePrice(service.price, true)
        if (!parsed.ok) {
          throw new Error(parsed.error)
        }
        data.price = parsed.price
      }
      return prisma.service.update({
        where: { id: service.id },
        data,
      })
    });

    await prisma.$transaction(updatePromises);

    return NextResponse.json({ message: 'Services updated successfully' });
  } catch (error) {
    console.error('Failed to update services:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, description, duration, category } = body;
        const parsed = readServicePrice(body.price, Object.prototype.hasOwnProperty.call(body, "price"))
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error }, { status: 400 });
        }

        const newService = await prisma.service.create({
            data: {
                name,
                description,
                duration,
                category,
                price: parsed.price ?? null,
            },
        });

        return NextResponse.json(newService, { status: 201 });
    } catch (error) {
        console.error('Failed to create service:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
} 