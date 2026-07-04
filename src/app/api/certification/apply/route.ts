/**
 * 三重认证 — 申请 API
 *
 * POST /api/certification/apply
 *   → 提交认证申请（机构/人员/车辆）
 *
 * GET  /api/certification
 *   → 查询当前用户的认证列表
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// 从请求头获取用户ID
async function getUserId(request: NextRequest): Promise<string | null> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  try {
    const user = await prisma.user.findFirst({
      where: { resetToken: token },
      select: { id: true },
    });
    return user?.id || null;
  } catch {
    return null;
  }
}

// POST: 提交认证申请
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "请先登录" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      certType,
      applicantName,
      contactPhone,
      contactEmail,
      // 机构认证字段
      businessLicenseNo,
      businessLicenseImg,
      legalPerson,
      registeredCapital,
      businessScope,
      // 人员认证字段
      personnelName,
      personnelCertNo,
      personnelCertImg,
      personnelLevel,
      // 车辆认证字段
      productId,
      inspectionReportNo,
      inspectionReportImg,
      inspectionGrade,
      inspectionDate,
      inspectionOrg,
    } = body;

    // 验证必填字段
    if (!certType || !applicantName || !contactPhone) {
      return NextResponse.json(
        { success: false, error: "缺少必填字段: certType, applicantName, contactPhone" },
        { status: 400 }
      );
    }

    if (!["institution", "personnel", "vehicle"].includes(certType)) {
      return NextResponse.json(
        { success: false, error: "认证类型无效，支持: institution, personnel, vehicle" },
        { status: 400 }
      );
    }

    // 创建认证申请
    const certification = await prisma.certification.create({
      data: {
        userId,
        certType,
        applicantName,
        contactPhone,
        contactEmail: contactEmail || null,
        // 机构认证
        businessLicenseNo: businessLicenseNo || null,
        businessLicenseImg: businessLicenseImg || null,
        legalPerson: legalPerson || null,
        registeredCapital: registeredCapital || null,
        businessScope: businessScope || null,
        // 人员认证
        personnelName: personnelName || null,
        personnelCertNo: personnelCertNo || null,
        personnelCertImg: personnelCertImg || null,
        personnelLevel: personnelLevel || null,
        // 车辆认证
        productId: productId || null,
        inspectionReportNo: inspectionReportNo || null,
        inspectionReportImg: inspectionReportImg || null,
        inspectionGrade: inspectionGrade || null,
        inspectionDate: inspectionDate ? new Date(inspectionDate) : null,
        inspectionOrg: inspectionOrg || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: certification,
      message: "认证申请提交成功，审核周期约3-5个工作日",
    });
  } catch (error: any) {
    console.error("[Certification] 申请错误:", error);
    return NextResponse.json(
      { success: false, error: "提交认证申请失败" },
      { status: 500 }
    );
  }
}

// GET: 查询当前用户的认证列表
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "请先登录" },
        { status: 401 }
      );
    }

    const certifications = await prisma.certification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: certifications,
    });
  } catch (error: any) {
    console.error("[Certification] 查询错误:", error);
    return NextResponse.json(
      { success: false, error: "查询认证列表失败" },
      { status: 500 }
    );
  }
}
