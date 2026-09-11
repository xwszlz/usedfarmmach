import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ⚠️ 必须动态渲染。本路由虽然声明了 request 形参，但当 MINIAPP_API_KEY 未配置时
// requireAuth() 会在读 req.headers 之前就 return true（见下），实际执行路径上不触碰
// 任何动态 API，Next.js 14 于是仍把它当作可静态化的 GET Route Handler，在 next build
// 阶段预渲染并固化进镜像。.cn 构建期连的是空库 → 线上恒返回空品牌 / 品类（53 字节），
// 小程序「发布产品」页的品牌与品类下拉永远为空；本路由又没有 revalidate，
// 不重新部署永不自愈。force-dynamic 后每次请求读活库。
export const dynamic = "force-dynamic";

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
