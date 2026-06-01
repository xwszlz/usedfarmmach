/**
 * 卖家产品管理 API
 * GET  /api/seller/products - 获取卖家自己的产品列表
 * POST /api/seller/products - 发布新产品（消耗积分）
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";

const PUBLISH_COST = 1; // 发布一台产品消耗 1 积分

// 验证卖家身份
function getSeller(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return payload;
}

// 获取卖家产品列表
export async function GET(request: NextRequest) {
  const seller = getSeller(request);
  if (!seller) {
    return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
  }

  const products = await prisma.product.findMany({
    where: { sellerId: seller.userId },
    include: {
      brand: { select: { nameZh: true, nameEn: true } },
      category: { select: { nameZh: true, nameEn: true } },
      images: { where: { isPrimary: true }, take: 1 },
      _count: { select: { inquiries: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: products });
}

// 发布新产品
export async function POST(request: NextRequest) {
  const seller = getSeller(request);
  if (!seller) {
    return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { brandId, categoryId, modelName, year, workingHours, condition, priceCny, location, descriptionZh } = body;

    // 必填校验
    if (!brandId || !categoryId || !modelName || !year || !condition || !priceCny || !location) {
      return NextResponse.json({ success: false, error: "请填写完整信息" }, { status: 400 });
    }

    // 检查积分
    const user = await prisma.user.findUnique({ where: { id: seller.userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: "用户不存在" }, { status: 404 });
    }
    if (user.credits < PUBLISH_COST) {
      return NextResponse.json({
        success: false,
        error: `积分不足，发布需 ${PUBLISH_COST} 积分，当前 ${user.credits} 积分`,
        credits: user.credits,
        required: PUBLISH_COST,
      }, { status: 403 });
    }

    // 创建产品
    const product = await prisma.product.create({
      data: {
        sellerId: seller.userId,
        brandId,
        categoryId,
        modelName,
        year: Number(year),
        workingHours: workingHours ? Number(workingHours) : null,
        condition,
        priceCny: Number(priceCny),
        priceUsd: Math.round(Number(priceCny) / 7.25),
        location,
        descriptionZh: descriptionZh || null,
        status: "active",
      },
    });

    // 扣除积分
    await prisma.user.update({
      where: { id: seller.userId },
      data: { credits: { decrement: PUBLISH_COST } },
    });

    return NextResponse.json({
      success: true,
      data: product,
      creditsRemaining: user.credits - PUBLISH_COST,
    });
  } catch (error) {
    console.error("Publish error:", error);
    return NextResponse.json({ success: false, error: "发布失败" }, { status: 500 });
  }
}
