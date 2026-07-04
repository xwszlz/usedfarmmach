/**
 * 线下服务网络 — API
 *
 * GET /api/service-centers
 *   ?province=xxx  → 按省份筛选
 *   ?level=xxx     → 按级别筛选(province/city/county)
 *   → 返回服务网点列表
 *
 * POST /api/service-centers
 *   → 管理员创建服务网点
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET: 查询服务网点
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const province = searchParams.get("province");
    const level = searchParams.get("level");

    const where: any = { isActive: true };
    if (province) where.province = province;
    if (level) where.level = level;

    const centers = await prisma.serviceCenter.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { province: "asc" }, { level: "asc" }],
    });

    // 按省份分组
    const grouped: Record<string, any[]> = {};
    for (const c of centers) {
      if (!grouped[c.province]) grouped[c.province] = [];
      const services = c.services ? JSON.parse(c.services) : [];
      grouped[c.province].push({
        ...c,
        services,
      });
    }

    // 统计摘要
    const summary = {
      total: centers.length,
      provinceCount: Object.keys(grouped).length,
      provinceLevel: centers.filter(c => c.level === "province").length,
      cityLevel: centers.filter(c => c.level === "city").length,
      countyLevel: centers.filter(c => c.level === "county").length,
    };

    return NextResponse.json({
      success: true,
      data: { centers, grouped, summary },
    });
  } catch (error: any) {
    console.error("[ServiceCenters] 查询错误:", error);
    return NextResponse.json(
      { success: false, error: "查询服务网点失败" },
      { status: 500 }
    );
  }
}

// POST: 创建服务网点（管理员）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name, level, province, city, district, address,
      longitude, latitude, contactPerson, contactPhone,
      services, businessHours, images, description,
    } = body;

    if (!name || !province || !address) {
      return NextResponse.json(
        { success: false, error: "缺少必填字段: name, province, address" },
        { status: 400 }
      );
    }

    const center = await prisma.serviceCenter.create({
      data: {
        name,
        level: level || "county",
        province,
        city: city || null,
        district: district || null,
        address,
        longitude: longitude || null,
        latitude: latitude || null,
        contactPerson: contactPerson || null,
        contactPhone: contactPhone || null,
        services: services ? JSON.stringify(services) : null,
        businessHours: businessHours || null,
        images: images ? JSON.stringify(images) : null,
        description: description || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: center,
      message: "服务网点创建成功",
    });
  } catch (error: any) {
    console.error("[ServiceCenters] 创建错误:", error);
    return NextResponse.json(
      { success: false, error: "创建服务网点失败" },
      { status: 500 }
    );
  }
}
