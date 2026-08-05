/**
 * 一机一码 — 生成/查询 API
 *
 * POST /api/machinery/identity
 *   { productId } → 为产品生成唯一QR码身份档案
 *
 * GET  /api/machinery/identity?productId=xxx
 *   → 查询产品的身份档案 + 生命周期事件
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// 生成QR码：SD-YYYY-XXXXXXX
function generateQrCode(): string {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 7);
  return `SD-${year}-${random}`;
}

// POST: 为产品生成一机一码
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json(
        { success: false, error: "缺少productId" },
        { status: 400 }
      );
    }

    // 检查产品是否存在
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, modelName: true, brand: { select: { nameZh: true } } },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: "产品不存在" },
        { status: 404 }
      );
    }

    // 检查是否已有一机一码
    const existing = await prisma.machineryIdentity.findUnique({
      where: { productId },
      include: { events: { orderBy: { eventDate: "asc" } } },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        data: existing,
        message: "该产品已有一机一码",
      });
    }

    // 生成唯一QR码（重试3次防碰撞）
    let qrCode = "";
    for (let i = 0; i < 3; i++) {
      qrCode = generateQrCode();
      const conflict = await prisma.machineryIdentity.findUnique({
        where: { qrCode },
        select: { id: true },
      });
      if (!conflict) break;
    }

    // 创建身份档案
    const identity = await prisma.machineryIdentity.create({
      data: {
        productId,
        qrCode,
        verifyHash: crypto.createHash("sha256").update(`${productId}-${qrCode}-${Date.now()}`).digest("hex").slice(0, 16),
      },
    });

    // 自动创建"上架"事件
    await prisma.machineryEvent.create({
      data: {
        identityId: identity.id,
        eventType: "listed",
        title: "设备上架",
        description: `${product.brand.nameZh} ${product.modelName} 在神雕农机平台发布上架`,
        operator: "系统自动",
        location: "神雕农机平台",
        eventDate: new Date(),
      },
    });

    // 返回完整数据
    const result = await prisma.machineryIdentity.findUnique({
      where: { id: identity.id },
      include: { events: { orderBy: { eventDate: "asc" } } },
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: "一机一码生成成功",
    });
  } catch (error: any) {
    console.error("[MachineryIdentity] 生成错误:", error);
    return NextResponse.json(
      { success: false, error: "生成一机一码失败" },
      { status: 500 }
    );
  }
}

// GET: 查询产品的一机一码档案
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json(
        { success: false, error: "缺少productId参数" },
        { status: 400 }
      );
    }

    const identity = await prisma.machineryIdentity.findUnique({
      where: { productId },
      include: {
        events: { orderBy: { eventDate: "asc" } },
        product: {
          select: {
            id: true,
            modelName: true,
            year: true,
            brand: { select: { nameZh: true, nameEn: true } },
            category: { select: { nameZh: true, nameEn: true } },
            images: { orderBy: { sortOrder: "asc" }, take: 1 },
          },
        },
      },
    });

    if (!identity) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "该产品尚未生成一机一码",
      });
    }

    return NextResponse.json({
      success: true,
      data: identity,
    });
  } catch (error: any) {
    console.error("[MachineryIdentity] 查询错误:", error);
    return NextResponse.json(
      { success: false, error: "查询一机一码失败" },
      { status: 500 }
    );
  }
}
