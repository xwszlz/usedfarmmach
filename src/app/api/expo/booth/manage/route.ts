import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromToken, getTokenFromHeaders } from "@/lib/auth";

/**
 * 品牌自助展台管理 API
 *
 * GET  /api/expo/booth/manage    — 获取当前用户的 booth+展品
 * POST /api/expo/booth/manage    — 添加/更新展品
 * DELETE /api/expo/booth/manage  — 删除展品
 */

async function getAuthUser(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers);
  if (!token) return null;
  return getUserFromToken(token);
}

// GET: 获取我的 booth 和展品
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const booth = await prisma.booth.findFirst({
      where: { merchantId: user.id },
      include: {
        showcaseItems: { orderBy: { sortIndex: "asc" } },
        _count: { select: { expoInquiries: true } },
      },
    });

    if (!booth) {
      return NextResponse.json({ success: false, error: "您还没有自助展台" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: booth });
  } catch (error) {
    console.error("Booth manage GET error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// POST: 添加/更新展品
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const booth = await prisma.booth.findFirst({ where: { merchantId: user.id } });
    if (!booth) {
      return NextResponse.json({ success: false, error: "您还没有自助展台" }, { status: 404 });
    }

    const body = await req.json();
    const { id, deviceType, brand, model, year, workingHours, condition, price, currency, images, videos, description } = body;

    if (!deviceType) {
      return NextResponse.json({ success: false, error: "请填写设备类型" }, { status: 400 });
    }

    let item;
    if (id) {
      // 更新已有展品
      const existing = await prisma.showcaseItem.findFirst({ where: { id, boothId: booth.id } });
      if (!existing) {
        return NextResponse.json({ success: false, error: "展品不存在" }, { status: 404 });
      }
      item = await prisma.showcaseItem.update({
        where: { id },
        data: { deviceType, brand, model, year, workingHours, condition, price, currency, images: images || [], videos: videos || [], description },
      });
    } else {
      // 新增展品
      const maxSort = await prisma.showcaseItem.findFirst({
        where: { boothId: booth.id },
        orderBy: { sortIndex: "desc" },
      });
      item = await prisma.showcaseItem.create({
        data: {
          boothId: booth.id,
          deviceType,
          brand: brand || user.companyName,
          model: model || "",
          year: year || null,
          workingHours: workingHours || null,
          condition: condition || "used",
          price: price || null,
          currency: currency || "CNY",
          images: images || [],
          videos: videos || [],
          description: description || "",
          status: "draft",
          sortIndex: (maxSort?.sortIndex || 0) + 1,
        },
      });
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error("Booth manage POST error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// DELETE: 删除展品
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const booth = await prisma.booth.findFirst({ where: { merchantId: user.id } });
    if (!booth) {
      return NextResponse.json({ success: false, error: "您还没有自助展台" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("id");
    if (!itemId) {
      return NextResponse.json({ success: false, error: "请指定要删除的展品ID" }, { status: 400 });
    }

    const existing = await prisma.showcaseItem.findFirst({ where: { id: itemId, boothId: booth.id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "展品不存在" }, { status: 404 });
    }

    await prisma.showcaseItem.delete({ where: { id: itemId } });

    return NextResponse.json({ success: true, message: "展品已删除" });
  } catch (error) {
    console.error("Booth manage DELETE error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
