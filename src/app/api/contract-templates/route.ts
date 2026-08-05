/**
 * 合同模板管理 API
 * GET  /api/contract-templates — 列表
 * POST /api/contract-templates — 创建
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 获取合同模板列表
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";

    const templates = await prisma.contractTemplate.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error("Get contract templates error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// 创建合同模板
export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // 只有管理员可以创建合同模板
    if (user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden — admin only" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      templateNo,
      title,
      contractType = "sale",
      sellerName,
      sellerCreditCode,
      sellerAddress,
      sellerPhone,
      sellerLegalPerson,
      bankName,
      bankAccountName,
      bankAccountNo,
      content,
      paymentDays = 2,
      deliveryDays = 3,
      transferResponsibility = "buyer",
      courtJurisdiction,
    } = body;

    if (!templateNo || !title || !sellerName || !content) {
      return NextResponse.json(
        { success: false, error: "templateNo, title, sellerName, content are required" },
        { status: 400 }
      );
    }

    const template = await prisma.contractTemplate.create({
      data: {
        templateNo,
        title,
        contractType,
        sellerName,
        sellerCreditCode,
        sellerAddress,
        sellerPhone,
        sellerLegalPerson,
        bankName,
        bankAccountName,
        bankAccountNo,
        content,
        paymentDays,
        deliveryDays,
        transferResponsibility,
        courtJurisdiction,
      },
    });

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error("Create contract template error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create template" },
      { status: 500 }
    );
  }
}
