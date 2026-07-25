/**
 * POST /api/trade/intent  （实际路径：src/app/api/(cn)/trade/intent）
 * 创建微信收付通担保交易意图（仅 .cn 国内站）
 *
 * 红线（核心）：
 *  - 网站侧不碰资金，仅生成「担保意图」+ 小程序跳转参数。
 *  - 真实收单在微信小程序（收付通）闭环。
 *  - 仅 .cn 站（非 .cn 返回 404）；未配置返回 503。
 *
 * 流程：
 *  1) 校验登录 / 产品可交易
 *  2) 写 GuaranteeIntent（status=created）+ Inquiry（source=web，关联 guaranteeIntentId）
 *  3) 调微信收付通下单，拿 prepay_id / miniProgramParams
 *  4) 用 qrcode 生成小程序跳转二维码（仅数据，不直接渲染 DOM）
 *  5) 返回 { intentId, prepayId, miniProgramParams, qrCodeDataUrl }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth";
import { isCnSite } from "@/config/site";
import { prisma } from "@/lib/db";
import { createGuaranteeIntent, isConfigured } from "@/lib/payments/wechat";
import * as QRCode from "qrcode";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bodySchema = z.object({
  productId: z.string().min(1),
  priceCny: z.number().positive().optional(),
  inquiryId: z.string().optional(),
});

/** 卖家子商户号：优先环境变量（平台默认子商户），后续可下沉到卖家配置 */
function resolveSubMerchantId(): string {
  return process.env.WECHAT_PAY_SUB_MERCHANT_ID || process.env.WECHAT_SUB_MERCHANT_ID || "";
}

export async function POST(request: NextRequest) {
  try {
    if (!isCnSite()) {
      return NextResponse.json(
        { success: false, error: "Not found", code: "SITE_NOT_SUPPORTED" },
        { status: 404 }
      );
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    if (!isConfigured()) {
      return NextResponse.json(
        { success: false, error: "担保交易未配置", code: "PAYMENT_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "参数错误", code: "INVALID_PARAMS" },
        { status: 400 }
      );
    }

    const { productId, priceCny, inquiryId } = parsed.data;

    // 校验产品
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, sellerId: true, priceCny: true, status: true, modelName: true },
    });
    if (!product) {
      return NextResponse.json({ success: false, error: "产品不存在" }, { status: 404 });
    }
    if (product.sellerId === user.id) {
      return NextResponse.json(
        { success: false, error: "不能购买自己的产品" },
        { status: 400 }
      );
    }
    if (product.status === "sold") {
      return NextResponse.json(
        { success: false, error: "该设备已售出" },
        { status: 400 }
      );
    }
    // 价格一致性：以产品价为准
    if (typeof priceCny === "number" && Math.abs(priceCny - product.priceCny) > 0.01) {
      return NextResponse.json(
        { success: false, error: "价格与产品不一致", code: "PRICE_MISMATCH" },
        { status: 400 }
      );
    }

    const wechatSubMerchantId = resolveSubMerchantId();
    if (!wechatSubMerchantId) {
      return NextResponse.json(
        { success: false, error: "未配置卖家子商户号", code: "SUB_MERCHANT_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    // 1) 写 GuaranteeIntent（先占位，拿到 id 作为 out_trade_no）
    const guaranteeIntent = await prisma.guaranteeIntent.create({
      data: {
        productId,
        buyerUserId: user.id,
        sellerUserId: product.sellerId,
        amountCny: product.priceCny,
        wechatSubMerchantId,
        status: "created",
        inquiryId: inquiryId ?? null,
      },
    });

    // 2) 写 Inquiry（source=web，关联 guaranteeIntentId）
    const inquiry = await prisma.inquiry.create({
      data: {
        productId,
        buyerId: user.id,
        source: "web",
        name: user.companyName || user.email || "买家",
        email: user.email,
        phone: user.phone,
        guaranteeIntentId: guaranteeIntent.id,
      },
    });

    // 3) 调微信收付通下单
    const result = await createGuaranteeIntent({
      outTradeNo: guaranteeIntent.id,
      productId,
      buyerUserId: user.id,
      sellerUserId: product.sellerId,
      amountCny: product.priceCny,
      wechatSubMerchantId,
      inquiryId: inquiry.id,
      description: `神雕农机 · ${product.modelName}`,
    });

    // 4) 生成小程序跳转二维码（仅数据，不直接渲染）
    let qrCodeDataUrl: string | undefined;
    try {
      const link = `weixin://dl/business/?t=USEDFARMMACH_trade_${guaranteeIntent.id}`;
      qrCodeDataUrl = await QRCode.toDataURL(link, {
        width: 240,
        margin: 2,
        color: { dark: "#1a1a2e", light: "#ffffff" },
      });
    } catch (qrErr) {
      console.error("[Trade/Intent] 生成二维码失败:", qrErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        intentId: result.intentId,
        prepayId: result.prepayId,
        miniProgramParams: result.miniProgramParams,
        qrCodeDataUrl,
      },
    });
  } catch (error: any) {
    console.error("[Trade/Intent] 错误:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "创建担保交易意图失败" },
      { status: 500 }
    );
  }
}
