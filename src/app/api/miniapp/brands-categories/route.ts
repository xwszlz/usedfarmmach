import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * 小程序 API — 品牌 + 品类下拉列表
 * 用于发布产品时选择品牌和品类
 */

function requireAuth(req: NextRequest) {
  const envKey = process.env.MINIAPP_API_KEY;
  // 环境变量未配置时自动放行（首次部署模式）
  if (!envKey) return true;
  const key = req.headers.get("x-miniapp-key");
  return key === envKey;
}

export async function GET(request: NextRequest) {
  if (!requireAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [brands, categories] = await Promise.all([
      prisma.brand.findMany({
        select: { id: true, nameZh: true, nameEn: true },
        orderBy: { nameZh: "asc" },
      }),
      prisma.category.findMany({
        select: { id: true, nameZh: true, nameEn: true },
        orderBy: { nameZh: "asc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        brands: brands.map((b) => ({ value: b.id, label: b.nameZh })),
        categories: categories.map((c) => ({ value: c.id, label: c.nameZh })),
      },
    });
  } catch (error) {
    console.error("miniapp brands-categories error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
