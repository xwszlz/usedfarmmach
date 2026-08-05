/**
 * 设备检验报告 API
 *
 * GET  /api/inspection-reports?productId=xxx  — 获取产品的检验报告
 * POST /api/inspection-reports                 — 创建检验报告（需认证，seller/admin）
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const VALID_GRADES = ["A", "B", "C", "D"];

// 5大类20项检测模板
const INSPECTION_CATEGORIES = [
  {
    category: "engine",
    categoryLabel: "发动机系统",
    items: [
      "启动性能", "怠速稳定性", "排气烟色", "机油压力",
    ],
  },
  {
    category: "transmission",
    categoryLabel: "传动系统",
    items: [
      "离合器状态", "变速箱换挡", "传动轴无异响", "差速器状态",
    ],
  },
  {
    category: "hydraulics",
    categoryLabel: "液压系统",
    items: [
      "液压泵压力", "液压缸密封", "液压油品质", "操控阀响应",
    ],
  },
  {
    category: "electrical",
    categoryLabel: "电气系统",
    items: [
      "发电机充电", "仪表显示", "灯光系统", "线束老化",
    ],
  },
  {
    category: "exterior",
    categoryLabel: "外观结构件",
    items: [
      "车架变形", "覆盖件锈蚀", "轮胎磨损", "油漆状况",
    ],
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json(
        { error: "Missing productId parameter" },
        { status: 400 }
      );
    }

    const reports = await prisma.inspectionReport.findMany({
      where: { productId, status: "published" },
      orderBy: { inspectionDate: "desc" },
    });

    const reportsWithParsed = reports.map((r) => ({
      ...r,
      inspectionItems: r.inspectionItems ? JSON.parse(r.inspectionItems) : [],
      photos: r.photos ? JSON.parse(r.photos) : [],
    }));

    return NextResponse.json({ reports: reportsWithParsed, template: INSPECTION_CATEGORIES });
  } catch (error) {
    console.error("Failed to fetch inspection reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch inspection reports" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    const {
      productId,
      inspectorName,
      inspectionOrg,
      overallGrade,
      overallScore,
      inspectionItems,
      summary,
      recommendations,
      photos,
      reportPdfUrl,
      validUntil,
    } = body;

    // 验证
    if (!productId || !inspectorName || !overallGrade || overallScore === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: productId, inspectorName, overallGrade, overallScore" },
        { status: 400 }
      );
    }

    if (!VALID_GRADES.includes(overallGrade)) {
      return NextResponse.json(
        { error: "Invalid overallGrade, must be A/B/C/D" },
        { status: 400 }
      );
    }

    // 验证产品存在
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 验证权限：只有该产品的卖家或管理员可以提交检验报告
    if (product.sellerId !== user.id && user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: only the product owner or admin can submit inspection reports" }, { status: 403 });
    }

    const report = await prisma.inspectionReport.create({
      data: {
        productId,
        inspectorId: user.id,
        inspectorName,
        inspectionOrg: inspectionOrg || null,
        overallGrade,
        overallScore,
        inspectionItems: JSON.stringify(inspectionItems || []),
        summary: summary || null,
        recommendations: recommendations || null,
        photos: photos ? JSON.stringify(photos) : null,
        reportPdfUrl: reportPdfUrl || null,
        validUntil: validUntil ? new Date(validUntil) : null,
      },
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error("Failed to create inspection report:", error);
    return NextResponse.json(
      { error: "Failed to create inspection report" },
      { status: 500 }
    );
  }
}
