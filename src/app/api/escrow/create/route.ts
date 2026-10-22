/**
 * POST /api/escrow/create
 * 创建担保交易订单
 *
 * Body: { productId, paymentMethod, deliveryAddress? }
 * 需要登录认证
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma, createEscrowOrder } from "@/lib/escrow";
import { isCnSite } from "@/config/site";

/**
 * 解析神雕自营卖家（D6）：优先读 env ESCROW_PLATFORM_SELLER_ID；
 * 未配置时回退查询 companyName='神雕农机' 且 role 为 seller/super_admin 的账户。
 * 仅 .cn 使用（担保交易整体 .cn 专属）。
 */
async function resolvePlatformSeller(): Promise<string | null> {
  const envId = process.env.ESCROW_PLATFORM_SELLER_ID;
  if (envId) return envId;
  const seller = await prisma.user.findFirst({
    where: {
      companyName: "神雕农机",
      role: { in: ["seller", "super_admin"] },
    },
    select: { id: true },
    orderBy: { role: "asc" },
  });
  return seller?.id ?? null;
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  if (!isCnSite()) {
    return NextResponse.json({ success: false, error: "SITE_NOT_SUPPORTED" }, { status: 404 });
  }
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const body = await request.json();
    const { productId, partId, paymentMethod, deliveryAddress } = body;

    if (!productId && !partId) {
      return NextResponse.json({ success: false, error: "缺少产品ID或配件ID" }, { status: 400 });
    }

    if (!["wechat", "alipay"].includes(paymentMethod)) {
      return NextResponse.json({ success: false, error: "支付方式不支持" }, { status: 400 });
    }

    // ---- 配件担保（D6=神雕自营）----
    if (partId) {
      const part = await prisma.part.findUnique({ where: { id: partId } });
      if (!part) {
        return NextResponse.json({ success: false, error: "配件不存在" }, { status: 404 });
      }

      const sellerId = await resolvePlatformSeller();
      if (!sellerId) {
        return NextResponse.json({
          success: false,
          error: "平台自营卖家未配置（ESCROW_PLATFORM_SELLER_ID）",
          code: "PLATFORM_SELLER_NOT_CONFIGURED",
        }, { status: 503 });
      }

      // 检查是否已有进行中的担保交易
      const existing = await prisma.escrowOrder.findFirst({
        where: {
          partId,
          buyerId: user.id,
          paymentStatus: { in: ["pending", "pending_deposit", "paid", "escrow"] },
        },
      });
      if (existing) {
        return NextResponse.json({
          success: false,
          error: "您已有一个进行中的配件担保订单",
          data: { orderId: existing.id, orderNo: existing.orderNo },
        }, { status: 409 });
      }

      const order = await createEscrowOrder({
        partId,
        buyerId: user.id,
        sellerId,
        amount: part.price,
        paymentMethod,
        deliveryAddress,
        itemType: "part",
      });

      return NextResponse.json({
        success: true,
        data: {
          orderId: order.id,
          orderNo: order.orderNo,
          amount: order.amount,
          platformFee: order.platformFee,
          sellerAmount: order.sellerAmount,
          paymentMethod: order.paymentMethod,
          itemType: order.itemType,
          product: order.product,
          part: order.part,
        },
      });
    }

    // ---- 整机担保（既有逻辑）----
    // 查产品
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { seller: { select: { id: true, username: true } } },
    });

    if (!product) {
      return NextResponse.json({ success: false, error: "产品不存在" }, { status: 404 });
    }

    if (product.sellerId === user.id) {
      return NextResponse.json({ success: false, error: "不能购买自己的产品" }, { status: 400 });
    }

    if (product.status === "sold") {
      return NextResponse.json({ success: false, error: "该设备已售出" }, { status: 400 });
    }

    // 检查是否已有进行中的担保交易
    const existing = await prisma.escrowOrder.findFirst({
      where: {
        productId,
        buyerId: user.id,
        paymentStatus: { in: ["pending", "pending_deposit", "paid", "escrow"] },
      },
    });

    if (existing) {
      return NextResponse.json({
        success: false,
        error: "您已有一个进行中的担保交易订单",
        data: { orderId: existing.id, orderNo: existing.orderNo },
      }, { status: 409 });
    }

    // 创建订单
    const order = await createEscrowOrder({
      productId,
      buyerId: user.id,
      sellerId: product.sellerId,
      amount: product.priceCny,
      paymentMethod,
      deliveryAddress,
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNo: order.orderNo,
        amount: order.amount,
        platformFee: order.platformFee,
        sellerAmount: order.sellerAmount,
        paymentMethod: order.paymentMethod,
        itemType: order.itemType,
        product: order.product,
      },
    });

  } catch (error: any) {
    console.error("[Escrow/Create] 错误:", error);
    return NextResponse.json(
      { success: false, error: error.message || "创建订单失败" },
      { status: 500 }
    );
  }
}
