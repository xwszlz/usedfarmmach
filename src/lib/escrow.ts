/**
 * 担保交易共享工具库
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * 生成订单号：SD-ESC-YYYYMMDD-XXXXXX
 */
export function generateOrderNo(): string {
  const date = new Date();
  const dateStr =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SD-ESC-${dateStr}-${random}`;
}

/**
 * 计算平台手续费和卖家到账金额
 * 手续费策略：交易额的 1.5%，最低 50 元
 */
export function calculateFee(amount: number): { platformFee: number; sellerAmount: number } {
  const fee = Math.max(amount * 0.015, 50);
  return {
    platformFee: Math.round(fee * 100) / 100,
    sellerAmount: Math.round((amount - fee) * 100) / 100,
  };
}

/**
 * 担保交易状态流转
 *
 * pending  →  paid     →  escrow    →  released
 *    ↓           ↓          ↓            ↑
 * cancelled  refunded   released(自动)  ↑
 *                        dispute → resolved
 */
export const ESCROW_STATUS = {
  PENDING: "pending",       // 待支付
  PAID: "paid",             // 已支付（资金在平台）
  ESCROW: "escrow",         // 担保中（资金冻结，等待确认收货）
  RELEASED: "released",     // 已放款（资金转给卖家）
  REFUNDED: "refunded",     // 已退款
  CANCELLED: "cancelled",   // 已取消
} as const;

/**
 * 自动放款期限（天）—— 买家确认收货后多少天自动放款
 */
export const AUTO_RELEASE_DAYS = 3;

/**
 * 支付超时时间（分钟）—— 超时自动取消
 */
export const PAYMENT_TIMEOUT_MINUTES = 30;

/**
 * 创建担保交易订单
 */
export async function createEscrowOrder(params: {
  productId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  paymentMethod: string;
  deliveryAddress?: string;
}) {
  const { platformFee, sellerAmount } = calculateFee(params.amount);
  const orderNo = generateOrderNo();

  // 支付超时时间
  const cancelledAt = new Date();
  cancelledAt.setMinutes(cancelledAt.getMinutes() + PAYMENT_TIMEOUT_MINUTES);

  const order = await prisma.escrowOrder.create({
    data: {
      orderNo,
      productId: params.productId,
      buyerId: params.buyerId,
      sellerId: params.sellerId,
      amount: params.amount,
      platformFee,
      sellerAmount,
      paymentMethod: params.paymentMethod,
      paymentStatus: ESCROW_STATUS.PENDING,
      deliveryAddress: params.deliveryAddress,
      // 超时取消标记（通过 metadata 记录）
      metadata: JSON.stringify({
        paymentTimeoutAt: cancelledAt.toISOString(),
      }),
    },
    include: {
      product: { select: { id: true, modelName: true, priceCny: true } },
      buyer: { select: { id: true, username: true, phone: true } },
      seller: { select: { id: true, username: true, phone: true } },
    },
  });

  return order;
}

/**
 * 处理支付成功回调
 */
export async function handlePaymentSuccess(
  orderNo: string,
  transactionId: string,
  rawData: Record<string, any>
): Promise<void> {
  const order = await prisma.escrowOrder.findFirst({
    where: { orderNo },
  });

  if (!order) {
    console.error("[Escrow] 订单不存在:", orderNo);
    return;
  }

  // 幂等：已支付/已担保 不重复处理
  if (order.paymentStatus === ESCROW_STATUS.PAID || order.paymentStatus === ESCROW_STATUS.ESCROW) {
    console.log("[Escrow] 订单已处理，跳过:", orderNo);
    return;
  }

  // 更新订单状态
  await prisma.escrowOrder.update({
    where: { id: order.id },
    data: {
      paymentStatus: ESCROW_STATUS.ESCROW,
      paidAt: new Date(),
      escrowStartedAt: new Date(),
    },
  });

  // 更新支付记录
  await prisma.paymentRecord.updateMany({
    where: { orderId: order.id, status: "pending" },
    data: {
      status: "success",
      transactionId,
      paidAt: new Date(),
      callbackAt: new Date(),
      rawCallback: JSON.stringify(rawData),
    },
  });

  // 更新产品状态为"交易中"
  await prisma.product.update({
    where: { id: order.productId },
    data: { status: "active" }, // 保持active，不改为sold直到确认收货
  });

  console.log(`[Escrow] 订单 ${orderNo} 支付成功，进入担保期`);
}

/**
 * 买家确认收货 → 进入自动放款倒计时
 */
export async function buyerConfirmReceipt(orderId: string, buyerId: string): Promise<void> {
  const order = await prisma.escrowOrder.findUnique({ where: { id: orderId } });

  if (!order) throw new Error("订单不存在");
  if (order.buyerId !== buyerId) throw new Error("无权操作此订单");
  if (order.paymentStatus !== ESCROW_STATUS.ESCROW) {
    throw new Error(`当前状态 ${order.paymentStatus} 不允许确认收货`);
  }

  const autoReleaseAt = new Date();
  autoReleaseAt.setDate(autoReleaseAt.getDate() + AUTO_RELEASE_DAYS);

  await prisma.escrowOrder.update({
    where: { id: orderId },
    data: {
      buyerConfirmed: true,
      buyerConfirmedAt: new Date(),
      autoReleaseAt,
    },
  });

  console.log(`[Escrow] 订单 ${order.orderNo} 买家已确认收货，${AUTO_RELEASE_DAYS}天后自动放款`);
}

/**
 * 放款给卖家
 */
export async function releaseToSeller(orderId: string): Promise<void> {
  const order = await prisma.escrowOrder.findUnique({ where: { id: orderId } });

  if (!order) throw new Error("订单不存在");
  if (order.paymentStatus !== ESCROW_STATUS.ESCROW) {
    throw new Error(`当前状态 ${order.paymentStatus} 不允许放款`);
  }

  await prisma.escrowOrder.update({
    where: { id: orderId },
    data: {
      paymentStatus: ESCROW_STATUS.RELEASED,
      releasedAt: new Date(),
    },
  });

  // 更新产品状态为已售
  await prisma.product.update({
    where: { id: order.productId },
    data: { status: "sold" },
  });

  console.log(`[Escrow] 订单 ${order.orderNo} 已放款给卖家，金额 ¥${order.sellerAmount}`);
}

/**
 * 退款
 */
export async function refundOrder(orderId: string, reason: string): Promise<void> {
  const order = await prisma.escrowOrder.findUnique({ where: { id: orderId } });

  if (!order) throw new Error("订单不存在");
  if (order.paymentStatus !== ESCROW_STATUS.ESCROW && order.paymentStatus !== ESCROW_STATUS.PAID) {
    throw new Error(`当前状态 ${order.paymentStatus} 不允许退款`);
  }

  // 调用第三方退款
  if (order.paymentMethod === "wechat") {
    const { refundOrder: wechatRefund } = await import("./wechat-pay");
    await wechatRefund(
      order.orderNo,
      `${order.orderNo}-R`,
      Math.round(order.amount * 100),
      Math.round(order.amount * 100),
      reason
    );
  } else if (order.paymentMethod === "alipay") {
    const { refundTrade: alipayRefund } = await import("./alipay");
    await alipayRefund(order.orderNo, order.amount, reason);
  }

  await prisma.escrowOrder.update({
    where: { id: orderId },
    data: {
      paymentStatus: ESCROW_STATUS.REFUNDED,
      refundedAt: new Date(),
    },
  });

  console.log(`[Escrow] 订单 ${order.orderNo} 已退款，原因: ${reason}`);
}

export { prisma };
