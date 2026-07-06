import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/expo/booth?hall=tractor&status=published  — list booths
// GET /api/expo/booth?boothId=xxx  — single booth detail
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const boothId = searchParams.get("boothId");

    if (boothId) {
      // Single booth detail
      const booth = await prisma.booth.findUnique({
        where: { id: boothId },
        include: {
          merchant: {
            select: { id: true, username: true, companyName: true, phone: true, email: true, country: true },
          },
          showcaseItems: {
            where: { status: "published" },
            orderBy: { sortIndex: "asc" },
          },
        },
      });

      if (!booth) {
        return NextResponse.json({ success: false, error: "Booth not found" }, { status: 404 });
      }

      // Increment view count (fire and forget)
      // We don't have a viewCount on Booth, but we can track via showcaseItems

      return NextResponse.json({ success: true, data: booth });
    }

    // List booths
    const hall = searchParams.get("hall");
    const status = searchParams.get("status") || "published";
    const merchantId = searchParams.get("merchantId");

    const where: Record<string, unknown> = {};
    if (hall) where.hall = hall;
    if (status) where.status = status;
    if (merchantId) where.merchantId = merchantId;

    const booths = await prisma.booth.findMany({
      where,
      include: {
        merchant: {
          select: { id: true, username: true, companyName: true },
        },
        _count: {
          select: { showcaseItems: true },
        },
      },
      orderBy: { sortIndex: "asc" },
    });

    return NextResponse.json({ success: true, data: booths });
  } catch (error) {
    console.error("Booth API error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/expo/booth — update booth (for merchant management)
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Booth ID required" }, { status: 400 });
    }

    // Filter allowed fields
    const allowed = ["template", "status", "coverImage", "logoUrl", "intro", "name", "merchantId", "sortIndex"];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in updateData) data[key] = updateData[key];
    }

    const booth = await prisma.booth.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, data: booth });
  } catch (error) {
    console.error("Booth update error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
