/**
 * 导航树API — 四级分类结构
 *
 * GET /api/parts/catalog
 * 返回：MachineType → SubSystem → ComponentGroup 树形结构，含配件计数
 * ISR缓存：1小时
 */

import { NextResponse } from "next/server";
import { getCatalogTree } from "@/lib/parts-catalog";

export const revalidate = 3600; // ISR 1 hour

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
