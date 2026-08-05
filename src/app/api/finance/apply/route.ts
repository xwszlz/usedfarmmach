/**
 * 金融/贷款申请 API
 *
 * GET  /api/finance/apply              — 获取我的申请列表
 * POST /api/finance/apply              — 提交申请
 * GET  /api/finance/apply/[id]         — 获取申请详情
 * PATCH /api/finance/apply/[id]        — 更新申请状态（admin）
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

    const applications = await prisma.loanApplication.findMany({
      where: { userId: user.id },
      include: {
        service: { select: { serviceName: true, serviceType: true, provider: true, providerLogo: true } },
        product: { select: { id: true, modelName: true, brand: { select: { nameZh: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: applications,
    });
  } catch (error) {
    console.error("Loan application GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch applications" },
      { status: 500 }
    );
  }
}

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

    const body = await request.json();
    const {
      serviceId,
      productId,
      applicantName,
      contactPhone,
      contactEmail,
      companyName,
      appliedAmount,
      appliedTerm,
      purpose,
      idCardUrl,
      assetProofUrl,
    } = body;

    if (!serviceId || !applicantName || !contactPhone || !appliedAmount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 验证金融产品存在
    const service = await prisma.financialService.findUnique({
      where: { id: serviceId },
    });
    if (!service || !service.isActive) {
      return NextResponse.json({ error: "Service not available" }, { status: 404 });
    }

    const application = await prisma.loanApplication.create({
      data: {
        userId: user.id,
        serviceId,
        productId: productId || null,
        applicantName,
        contactPhone,
        contactEmail,
        companyName,
        appliedAmount: parseFloat(appliedAmount),
        appliedTerm: appliedTerm ? parseInt(appliedTerm) : null,
        purpose,
        idCardUrl,
        assetProofUrl,
        status: "pending",
      },
    });

    return NextResponse.json({
      success: true,
      data: application,
      message: "Application submitted successfully",
    });
  } catch (error) {
    console.error("Loan application POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit application" },
      { status: 500 }
    );
  }
}
