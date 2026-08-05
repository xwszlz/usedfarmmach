/**
 * 合同签署 API
 *
 * POST /api/contracts/[id]/sign
 * { role: "seller" | "buyer", signature: "data:image/png;base64,..." | "text-hash" }
 *
 * 签署流程：
 * 1. draft → pending_seller (买方发起签署请求)
 * 2. pending_seller → pending_buyer (卖方签署)
 * 3. pending_buyer → signed (买方签署，合同生效)
 * 或者：
 * 1. draft → pending_buyer (卖方发起)
 * 2. pending_buyer → pending_seller (买方签署)
 * 3. pending_seller → signed (卖方签署，合同生效)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
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

    const body = await request.json();
    const { role, signature } = body;

    if (!role || !signature) {
      return NextResponse.json(
        { error: "Missing required fields: role, signature" },
        { status: 400 }
      );
    }

    if (role !== "seller" && role !== "buyer") {
      return NextResponse.json(
        { error: "Role must be 'seller' or 'buyer'" },
        { status: 400 }
      );
    }

    const contract = await prisma.electronicContract.findUnique({
      where: { id: params.id },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // 权限验证
    if (role === "seller" && user.id !== contract.sellerId) {
      return NextResponse.json({ error: "You are not the seller of this contract" }, { status: 403 });
    }
    if (role === "buyer" && user.id !== contract.buyerId) {
      return NextResponse.json({ error: "You are not the buyer of this contract" }, { status: 403 });
    }

    // 检查是否已签署
    if (role === "seller" && contract.sellerSignedAt) {
      return NextResponse.json({ error: "Seller has already signed" }, { status: 400 });
    }
    if (role === "buyer" && contract.buyerSignedAt) {
      return NextResponse.json({ error: "Buyer has already signed" }, { status: 400 });
    }

    const now = new Date();

    // 确定合同新状态
    let newStatus = contract.status;
    if (contract.status === "draft") {
      // 首次签署
      newStatus = role === "seller" ? "pending_buyer" : "pending_seller";
    } else if (contract.status === "pending_seller") {
      // 等待卖方签署
      if (role !== "seller") {
        return NextResponse.json(
          { error: "Waiting for seller to sign" },
          { status: 400 }
        );
      }
      // 卖方签署后，如果买方已签，则合同生效
      newStatus = contract.buyerSignedAt ? "signed" : "pending_buyer";
    } else if (contract.status === "pending_buyer") {
      // 等待买方签署
      if (role !== "buyer") {
        return NextResponse.json(
          { error: "Waiting for buyer to sign" },
          { status: 400 }
        );
      }
      // 买方签署后，如果卖方已签，则合同生效
      newStatus = contract.sellerSignedAt ? "signed" : "pending_seller";
    } else {
      return NextResponse.json(
        { error: `Contract status ${contract.status} does not allow signing` },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
    };

    if (role === "seller") {
      updateData.sellerSignedAt = now;
      updateData.sellerSignature = signature;
    } else {
      updateData.buyerSignedAt = now;
      updateData.buyerSignature = signature;
    }

    // 如果双方都已签署，设置生效日期
    if (newStatus === "signed") {
      updateData.validFrom = now;
      // 默认有效期1年
      const validUntil = new Date(now);
      validUntil.setFullYear(validUntil.getFullYear() + 1);
      updateData.validUntil = validUntil;
    }

    const updated = await prisma.electronicContract.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: newStatus === "signed"
        ? "Contract fully signed and effective"
        : `${role} signed successfully, waiting for the other party`,
    });
  } catch (error) {
    console.error("Contract sign error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to sign contract" },
      { status: 500 }
    );
  }
}
