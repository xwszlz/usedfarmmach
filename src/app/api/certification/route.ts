/**
 * 公开认证查询 — 用于卖家详情页展示认证标识
 *
 * GET /api/certification?userId=xxx
 *   → 查询指定用户的已通过认证
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "缺少userId参数" },
        { status: 400 }
      );
    }

    const certifications = await prisma.certification.findMany({
      where: {
        userId,
        status: "approved",
      },
      select: {
        id: true,
        certType: true,
        applicantName: true,
        personnelLevel: true,
        inspectionGrade: true,
        validUntil: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // 构造认证标识摘要
    const badges = {
      institution: certifications.find(c => c.certType === "institution"),
      personnel: certifications.find(c => c.certType === "personnel"),
      vehicle: certifications.filter(c => c.certType === "vehicle"),
      count: certifications.length,
    };

    return NextResponse.json({
      success: true,
      data: { certifications, badges },
    });
  } catch (error: any) {
    console.error("[Certification] 公开查询错误:", error);
    return NextResponse.json(
      { success: false, error: "查询认证信息失败" },
      { status: 500 }
    );
  }
}
