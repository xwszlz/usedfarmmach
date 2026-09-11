/**
 * 品牌和品类数据（供表单下拉框使用）
 * GET /api/brands-categories
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// .cn 镜像在 CI 构建时连的是空库；本路由不收 request、不用 cookies/headers，
// Next.js 14 会把它当作可静态化的 GET Route Handler，在 next build 阶段预渲染
// 并把结果烤进镜像 —— 于是线上永远返回构建期的空数组（恰好 44 字节：
// {"success":true,"brands":[],"categories":[]}），品牌/品类下拉恒为空。
// 改为动态渲染，确保读活库（force-dynamic 优先，revalidate 已移除）。
export const dynamic = "force-dynamic";

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
