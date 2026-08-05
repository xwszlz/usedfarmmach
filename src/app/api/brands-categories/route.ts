/**
 * 品牌和品类数据（供表单下拉框使用）
 * GET /api/brands-categories
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const brands = await prisma.brand.findMany({
      orderBy: { nameZh: "asc" },
      select: { id: true, nameZh: true },
    });
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      orderBy: { nameZh: "asc" },
      select: { id: true, nameZh: true },
    });
    return NextResponse.json({ success: true, brands, categories });
  } catch {
    return NextResponse.json({ success: false, error: "获取失败" }, { status: 500 });
  }
}
