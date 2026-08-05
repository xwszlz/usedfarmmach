/**
 * 配件详情 API
 *
 * GET /api/parts/[id]
 * 返回：配件详情 + 层级关系（整机品类→子系统→部件组）+ 兼容机型 + 关联配件
 * ISR缓存：1小时
 */

import { NextRequest, NextResponse } from "next/server";
import { getPartById, getRelatedParts } from "@/lib/parts-catalog";

export const revalidate = 3600; // ISR 1 hour

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const part = await getPartById(id);

    if (!part) {
      return NextResponse.json(
        { success: false, error: "Part not found" },
        { status: 404 }
      );
    }

    // 获取同部件组的关联配件
    const relatedParts = await getRelatedParts(
      part.componentGroupId,
      part.id,
      4
    ).catch(() => []);

    return NextResponse.json({
      success: true,
      data: part,
      relatedParts,
    });
  } catch (error) {
    console.error("Part detail API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch part detail" },
      { status: 500 }
    );
  }
}
