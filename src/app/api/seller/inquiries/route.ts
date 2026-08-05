import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json(
        { success: false, error: "请先登录" },
        { status: 401 }
      );
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "用户不存在" },
        { status: 401 }
      );
    }

    // 管理员可看全量询价；普通 seller 只看自己产品的询价
    const isAdmin = user.role === "admin";
    const where = isAdmin ? {} : { product: { sellerId: user.id } };

    const inquiries = await prisma.inquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        product: {
          select: {
            modelName: true,
            brand: { select: { nameZh: true, nameEn: true } },
          },
        },
      },
    });

    const serialized = inquiries.map(i => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: serialized,
    });
  } catch (error) {
    console.error("[Seller Inquiries] 错误:", error);
    return NextResponse.json(
      { success: false, error: "获取询价列表失败" },
      { status: 500 }
    );
  }
}
