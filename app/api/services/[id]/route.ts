export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { readServicePrice } from "@/lib/money";

// GET /api/services/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }
    return NextResponse.json(service);
  } catch (error) {
    console.error("Failed to fetch service:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT /api/services/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { name, description, duration, category, isAvailable } = body;

    const dataToUpdate: {
      name?: string
      description?: string | null
      duration?: number
      category?: string
      isAvailable?: boolean
      price?: number | null
    } = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (description !== undefined) dataToUpdate.description = description;
    if (duration !== undefined) dataToUpdate.duration = duration;
    if (category !== undefined) dataToUpdate.category = category;
    if (isAvailable !== undefined) dataToUpdate.isAvailable = isAvailable;
    if (Object.prototype.hasOwnProperty.call(body, "price")) {
      const parsed = readServicePrice(body.price, true);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      dataToUpdate.price = parsed.price;
    }

    const updated = await prisma.service.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update service:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/services/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    await prisma.service.delete({ where: { id } });
    return NextResponse.json({ message: "Service deleted successfully" });
  } catch (error) {
    console.error("Failed to delete service:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 