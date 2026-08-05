/**
 * 一机一码 — 扫码查询 API
 *
 * GET /api/machinery/[qrCode]
 *   → 通过QR码查询农机全生命周期档案（公开接口，扫码即可访问）
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getImageUrl } from "@/lib/image-url";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ qrCode: string }> }
) {
  try {
    const { qrCode } = await params;

    const identity = await prisma.machineryIdentity.findUnique({
      where: { qrCode },
      include: {
        events: { orderBy: { eventDate: "asc" } },
        product: {
          select: {
            id: true,
            modelName: true,
            year: true,
            workingHours: true,
            condition: true,
            priceCny: true,
            location: true,
            status: true,
            brand: { select: { nameZh: true, nameEn: true } },
            category: { select: { nameZh: true, nameEn: true } },
            images: { orderBy: { sortOrder: "asc" }, take: 3 },
            seller: { select: { companyName: true, country: true } },
          },
        },
      },
    });

    if (!identity) {
      return NextResponse.json(
        { success: false, error: "未找到此QR码对应的农机档案" },
        { status: 404 }
      );
    }

    // 构造公开档案数据（脱敏）
    const profile = {
      qrCode: identity.qrCode,
      isVerified: identity.isVerified,
      serialNo: identity.serialNo,
      manufactureDate: identity.manufactureDate,
      factoryName: identity.factoryName,
      factoryLocation: identity.factoryLocation,
      createdAt: identity.createdAt,
      product: identity.product
        ? {
            modelName: identity.product.modelName,
            year: identity.product.year,
            workingHours: identity.product.workingHours,
            condition: identity.product.condition,
            location: identity.product.location,
            status: identity.product.status,
            brandName: identity.product.brand?.nameZh || identity.product.brand?.nameEn,
            categoryName: identity.product.category?.nameZh || identity.product.category?.nameEn,
            imageUrl: identity.product.images?.[0]
              ? getImageUrl(identity.product.images[0].url)
              : null,
            sellerName: identity.product.seller?.companyName || null,
          }
        : null,
      events: identity.events.map((e) => ({
        eventType: e.eventType,
        title: e.title,
        description: e.description,
        operator: e.operator,
        location: e.location,
        eventDate: e.eventDate,
      })),
      timeline: identity.events.map((e, idx) => ({
        step: idx + 1,
        type: e.eventType,
        title: e.title,
        date: e.eventDate,
        location: e.location,
        description: e.description,
      })),
    };

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    console.error("[MachineryQR] 查询错误:", error);
    return NextResponse.json(
      { success: false, error: "查询农机档案失败" },
      { status: 500 }
    );
  }
}
