/**
 * 合同模板详情 API
 * GET    /api/contract-templates/[id] — 获取详情
 * PUT    /api/contract-templates/[id] — 更新
 * DELETE /api/contract-templates/[id] — 删除（归档）
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const template = await prisma.contractTemplate.findUnique({
      where: { id: params.id },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error("Get contract template error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch template" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

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
      status,
    } = body;

    const updated = await prisma.contractTemplate.update({
      where: { id: params.id },
      data: {
        ...(templateNo !== undefined && { templateNo }),
        ...(title !== undefined && { title }),
        ...(contractType !== undefined && { contractType }),
        ...(sellerName !== undefined && { sellerName }),
        ...(sellerCreditCode !== undefined && { sellerCreditCode }),
        ...(sellerAddress !== undefined && { sellerAddress }),
        ...(sellerPhone !== undefined && { sellerPhone }),
        ...(sellerLegalPerson !== undefined && { sellerLegalPerson }),
        ...(bankName !== undefined && { bankName }),
        ...(bankAccountName !== undefined && { bankAccountName }),
        ...(bankAccountNo !== undefined && { bankAccountNo }),
        ...(content !== undefined && { content }),
        ...(paymentDays !== undefined && { paymentDays }),
        ...(deliveryDays !== undefined && { deliveryDays }),
        ...(transferResponsibility !== undefined && { transferResponsibility }),
        ...(courtJurisdiction !== undefined && { courtJurisdiction }),
        ...(status !== undefined && { status }),
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Update contract template error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update template" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    if (user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden — admin only" },
        { status: 403 }
      );
    }

    // 软删除：归档而非物理删除
    await prisma.contractTemplate.update({
      where: { id: params.id },
      data: { status: "archived" },
    });

    return NextResponse.json({
      success: true,
      message: "Template archived",
    });
  } catch (error) {
    console.error("Delete contract template error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
