import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/expo/batch-import
// Body: { boothId, items: [{ deviceType, brand, model, year, workingHours, condition, price, currency, images[], videos[], description }] }
export async function POST(request: NextRequest) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ success: false, error: "Token无效" }, { status: 401 });

  // Only admin/super_admin can batch import
  if (payload.role !== "admin" && payload.role !== "super_admin") {
    return NextResponse.json({ success: false, error: "需要管理员权限" }, { status: 403 });
  }

  const body = await request.json();
  const { boothId, items } = body;

  if (!boothId) return NextResponse.json({ success: false, error: "缺少展位ID" }, { status: 400 });
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ success: false, error: "无导入数据" }, { status: 400 });
  }

  // Verify booth exists
  const booth = await prisma.booth.findUnique({ where: { id: boothId } });
  if (!booth) return NextResponse.json({ success: false, error: "展位不存在" }, { status: 404 });

  // Get current max sortIndex
  const maxSort = await prisma.showcaseItem.aggregate({
    where: { boothId },
    _max: { sortIndex: true },
  });
  let nextSort = (maxSort._max.sortIndex || 0) + 1;

  const results: { success: boolean; model?: string; error?: string }[] = [];

  for (const item of items) {
    try {
      await prisma.showcaseItem.create({
        data: {
          boothId,
          deviceType: item.deviceType || "other",
          brand: item.brand || null,
          model: item.model || null,
          year: item.year ? parseInt(String(item.year)) : null,
          workingHours: item.workingHours ? parseInt(String(item.workingHours)) : null,
          condition: item.condition || null,
          price: item.price ? parseFloat(String(item.price)) : null,
          currency: item.currency || "CNY",
          images: Array.isArray(item.images) ? item.images : (item.images ? String(item.images).split(";").filter(Boolean) : []),
          videos: Array.isArray(item.videos) ? item.videos : (item.videos ? String(item.videos).split(";").filter(Boolean) : []),
          description: item.description || null,
          status: "published",
          sortIndex: nextSort++,
        },
      });
      results.push({ success: true, model: item.model || item.deviceType });
    } catch (e) {
      results.push({ success: false, model: item.model || item.deviceType, error: String(e) });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return NextResponse.json({
    success: true,
    summary: { total: items.length, success: successCount, failed: failCount },
    results,
  });
}
