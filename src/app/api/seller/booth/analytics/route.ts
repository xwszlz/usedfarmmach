import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ success: false, error: "Token无效" }, { status: 401 });

  // Get seller's booths
  const booths = await prisma.booth.findMany({
    where: { merchantId: payload.userId },
    select: { id: true, name: true, hall: true },
  });

  if (booths.length === 0) {
    return NextResponse.json({ success: true, data: { booths: [], totalViews: 0, totalInquiries: 0, topItems: [], inquiryTrend: [] } });
  }

  const boothIds = booths.map(b => b.id);

  // Get all showcase items with stats
  const items = await prisma.showcaseItem.findMany({
    where: { boothId: { in: boothIds } },
    select: {
      id: true,
      deviceType: true,
      brand: true,
      model: true,
      viewCount: true,
      inquiryCount: true,
      images: true,
      status: true,
    },
    orderBy: { viewCount: "desc" },
  });

  const totalViews = items.reduce((s, i) => s + (i.viewCount || 0), 0);
  const totalInquiries = items.reduce((s, i) => s + (i.inquiryCount || 0), 0);
  const conversionRate = totalViews > 0 ? (totalInquiries / totalViews * 100).toFixed(1) : "0";

  // Top 5 items by views
  const topItems = items.slice(0, 5).map(i => ({
    ...i,
    conversionRate: i.viewCount > 0 ? (i.inquiryCount / i.viewCount * 100).toFixed(1) : "0",
  }));

  // Inquiry trend (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const inquiries = await prisma.expoInquiry.findMany({
    where: {
      boothId: { in: boothIds },
      createdAt: { gte: thirtyDaysAgo },
    },
    select: { createdAt: true, status: true, intent: true },
    orderBy: { createdAt: "asc" },
  });

  // Group by day
  const inquiryTrend: Record<string, { date: string; count: number; new: number; contacted: number }> = {};
  inquiries.forEach(q => {
    const dateKey = q.createdAt.toISOString().substring(0, 10);
    if (!inquiryTrend[dateKey]) inquiryTrend[dateKey] = { date: dateKey, count: 0, new: 0, contacted: 0 };
    inquiryTrend[dateKey].count++;
    if (q.status === "new") inquiryTrend[dateKey].new++;
    if (q.status === "contacted" || q.status === "closed") inquiryTrend[dateKey].contacted++;
  });

  // Intent distribution
  const intentStats: Record<string, number> = {};
  inquiries.forEach(q => {
    const intent = q.intent || "inquiry";
    intentStats[intent] = (intentStats[intent] || 0) + 1;
  });

  // Status distribution
  const statusStats: Record<string, number> = {};
  inquiries.forEach(q => {
    statusStats[q.status] = (statusStats[q.status] || 0) + 1;
  });

  return NextResponse.json({
    success: true,
    data: {
      booths,
      totalItems: items.length,
      totalViews,
      totalInquiries,
      conversionRate,
      topItems,
      inquiryTrend: Object.values(inquiryTrend),
      intentStats,
      statusStats,
      recentInquiries: inquiries.slice(-10).reverse(),
    },
  });
}
