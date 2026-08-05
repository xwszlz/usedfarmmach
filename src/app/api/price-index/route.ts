/**
 * 价格指数 API
 *
 * GET /api/price-index
 * 查询价格指数数据
 *
 * POST /api/price-index
 * 计算并存储最新价格指数（需admin权限）
 *
 * 查询参数：
 * - type: overall | category | brand | region (default: overall)
 * - id: category/brand/region ID (required when type != overall)
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - limit: number of data points (default: 30)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 基准日期：2026-01-01，基准指数 = 100
const BASE_DATE = new Date("2026-01-01");

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "overall";
    const id = searchParams.get("id") || undefined;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "30", 10);

    const whereClause: Record<string, unknown> = {};

    switch (type) {
      case "category":
        if (id) whereClause.category = id;
        whereClause.brand = null;
        whereClause.region = null;
        break;
      case "brand":
        if (id) whereClause.brand = id;
        whereClause.category = null;
        whereClause.region = null;
        break;
      case "region":
        if (id) whereClause.region = id;
        whereClause.category = null;
        whereClause.brand = null;
        break;
      default:
        whereClause.category = null;
        whereClause.brand = null;
        whereClause.region = null;
    }

    if (startDate) {
      const existing = (whereClause.date as Record<string, unknown>) || {};
      whereClause.date = { ...existing, gte: new Date(startDate) };
    }
    if (endDate) {
      const existing = (whereClause.date as Record<string, unknown>) || {};
      whereClause.date = { ...existing, lte: new Date(endDate) };
    }

    const indices = await prisma.priceIndex.findMany({
      where: whereClause,
      orderBy: { date: "desc" },
      take: limit,
    });

    // 反转为时间正序
    indices.reverse();

    // 如果没有数据，实时计算
    if (indices.length === 0) {
      const calculated = await calculateIndex(type, id);
      return NextResponse.json({
        success: true,
        data: calculated,
        cached: false,
      });
    }

    return NextResponse.json({
      success: true,
      data: indices,
      cached: true,
    });
  } catch (error) {
    console.error("Price index GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch price index" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { type = "overall", id, recalculate = false } = body;

    // 计算指数
    const result = await calculateAndStoreIndex(type, id, recalculate);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Price index POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate price index" },
      { status: 500 }
    );
  }
}

/**
 * 实时计算价格指数（不写入数据库）
 */
async function calculateIndex(type: string, id?: string | null) {
  const whereClause: Record<string, unknown> = { status: "active" };

  if (type === "category" && id) {
    whereClause.categoryId = id;
  } else if (type === "brand" && id) {
    whereClause.brandId = id;
  } else if (type === "region" && id) {
    whereClause.location = { contains: id };
  }

  // 按月聚合过去12个月的数据
  const now = new Date();
  const months: { date: Date; indexValue: number; avgPriceCny: number; sampleCount: number }[] = [];

  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

    const products = await prisma.product.findMany({
      where: {
        ...whereClause,
        createdAt: { gte: monthStart, lt: monthEnd },
      },
      select: { priceCny: true },
    });

    if (products.length === 0) {
      months.push({
        date: monthStart,
        indexValue: 0,
        avgPriceCny: 0,
        sampleCount: 0,
      });
      continue;
    }

    const avgPrice = products.reduce((sum, p) => sum + p.priceCny, 0) / products.length;

    // 计算基准价
    const baseProducts = await prisma.product.findMany({
      where: {
        ...whereClause,
        createdAt: { gte: BASE_DATE, lt: new Date(BASE_DATE.getTime() + 30 * 24 * 60 * 60 * 1000) },
      },
      select: { priceCny: true },
    });

    const baseAvg =
      baseProducts.length > 0
        ? baseProducts.reduce((sum, p) => sum + p.priceCny, 0) / baseProducts.length
        : avgPrice;

    const indexValue = Math.round((avgPrice / baseAvg) * 10000) / 100;

    months.push({
      date: monthStart,
      indexValue,
      avgPriceCny: Math.round(avgPrice * 100) / 100,
      sampleCount: products.length,
    });
  }

  return months;
}

/**
 * 计算并存储价格指数
 */
async function calculateAndStoreIndex(
  type: string,
  id: string | null,
  _recalculate: boolean
) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const whereClause: Record<string, unknown> = { status: "active" };

  const categoryId = type === "category" ? (id || undefined) : undefined;
  const brandId = type === "brand" ? (id || undefined) : undefined;
  const regionFilter = type === "region" && id ? { contains: id } : undefined;

  if (categoryId) whereClause.categoryId = categoryId;
  if (brandId) whereClause.brandId = brandId;
  if (regionFilter) whereClause.location = regionFilter;

  // 当月产品
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentProducts = await prisma.product.findMany({
    where: {
      ...whereClause,
      createdAt: { gte: monthStart },
    },
    select: { priceCny: true },
  });

  if (currentProducts.length === 0) {
    return { message: "No data for current period", indexValue: 0 };
  }

  const currentAvg =
    currentProducts.reduce((sum, p) => sum + p.priceCny, 0) / currentProducts.length;

  // 基准价
  const baseProducts = await prisma.product.findMany({
    where: {
      ...whereClause,
      createdAt: { gte: BASE_DATE, lt: new Date(BASE_DATE.getTime() + 30 * 24 * 60 * 60 * 1000) },
    },
    select: { priceCny: true },
  });

  const baseAvg =
    baseProducts.length > 0
      ? baseProducts.reduce((sum, p) => sum + p.priceCny, 0) / baseProducts.length
      : currentAvg;

  const indexValue = Math.round((currentAvg / baseAvg) * 10000) / 100;

  // 上月数据（环比）
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthProducts = await prisma.product.findMany({
    where: {
      ...whereClause,
      createdAt: { gte: lastMonthStart, lt: monthStart },
    },
    select: { priceCny: true },
  });

  const lastMonthAvg =
    lastMonthProducts.length > 0
      ? lastMonthProducts.reduce((sum, p) => sum + p.priceCny, 0) / lastMonthProducts.length
      : currentAvg;

  const monthOverMonth =
    lastMonthAvg > 0
      ? Math.round(((currentAvg - lastMonthAvg) / lastMonthAvg) * 10000) / 100
      : 0;

  // 去年同期（同比）
  const lastYearStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const lastYearEnd = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);
  const lastYearProducts = await prisma.product.findMany({
    where: {
      ...whereClause,
      createdAt: { gte: lastYearStart, lt: lastYearEnd },
    },
    select: { priceCny: true },
  });

  const lastYearAvg =
    lastYearProducts.length > 0
      ? lastYearProducts.reduce((sum, p) => sum + p.priceCny, 0) / lastYearProducts.length
      : currentAvg;

  const yearOverYear =
    lastYearAvg > 0
      ? Math.round(((currentAvg - lastYearAvg) / lastYearAvg) * 10000) / 100
      : 0;

  // 写入数据库（Prisma 不支持 nullable 字段的复合唯一键 upsert，改用 findFirst + create/update）
  const categoryVal = type === "category" ? (id || null) : null;
  const brandVal = type === "brand" ? (id || null) : null;
  const regionVal = type === "region" ? (id || null) : null;

  const existing = await prisma.priceIndex.findFirst({
    where: { date: today, category: categoryVal, brand: brandVal, region: regionVal },
  });

  const indexData = {
    indexValue,
    avgPriceCny: Math.round(currentAvg * 100) / 100,
    sampleCount: currentProducts.length,
    monthOverMonth,
    yearOverYear,
  };

  let indexRecord;
  if (existing) {
    indexRecord = await prisma.priceIndex.update({
      where: { id: existing.id },
      data: indexData,
    });
  } else {
    indexRecord = await prisma.priceIndex.create({
      data: {
        date: today,
        category: categoryVal,
        brand: brandVal,
        region: regionVal,
        ...indexData,
      },
    });
  }

  return indexRecord;
}
