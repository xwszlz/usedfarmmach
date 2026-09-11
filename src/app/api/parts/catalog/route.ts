/**
 * 导航树API — 四级分类结构
 *
 * GET /api/parts/catalog
 * 返回：MachineType → SubSystem → ComponentGroup 树形结构，含配件计数
 * 渲染：force-dynamic（不做构建期静态固化，见下方说明）
 */

import { NextResponse } from "next/server";
import { getCatalogTree } from "@/lib/parts-catalog";

// ⚠️ 必须动态渲染。本路由不收 request、不用 cookies()/headers()，只声明 revalidate
// 并不能阻止 Next.js 14 在 next build 阶段静态预渲染 —— 它只是在其之上叠加 ISR。
// .cn 镜像在 CI 内构建时连的是空库（数据不出境），线上于是返回空的配件导航树
// （对照 .com：26 字节 vs 52715 字节），配件频道导航不可用。
// force-dynamic 后不再产生构建期快照，每次请求读活库。
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getCatalogTree();
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Catalog API error:", error);
    // 失败返回空数组，前端可降级显示
    return NextResponse.json({
      success: true,
      data: [],
    });
  }
}
