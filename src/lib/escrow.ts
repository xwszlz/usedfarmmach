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
 * 注意：手续费仅按线上定金计提，尾款走线下对公转账不收平台费
 */
export function calculateFee(amount: number): { platformFee: number; sellerAmount: number } {
  const fee = Math.max(amount * 0.015, 50);
  return {
    platformFee: Math.round(fee * 100) / 100,
    sellerAmount: Math.round((amount - fee) * 100) / 100,
  };
}

/**
 * 定金计算：max(¥1,000, 商品价×10%)，封顶 ¥50,000
 * 用户决策（2026-07-20）：固定 10% 定金 + 线下对公尾款
 */
export function calculateDeposit(price: number): number {
  const deposit = Math.max(1000, price * 0.1);
  return Math.min(Math.round(deposit * 100) / 100, 50000);
}

/**
 * 担保交易状态流转（定金+尾款模式）
 *
 * pending_deposit → deposit_paid → escrow → released
 *      ↓                ↓             ↑        ↑
 *  cancelled      cancelled(违约)  buyerConfirm  ↑
 *                 (定金不退)      autoRelease(3天) ↑
 *                                 dispute → refunded
 *
 * pending_deposit : 待付定金（创建后7天内支付）
 * deposit_paid    : 定金已付，待付尾款（定金后30天内线下对公转账）
 * escrow          : 全款付清已发货，担保中（等待确认收货）
 * released        : 已放款给卖家
 * refunded        : 已退款
 * cancelled       : 已取消（未付定金取消 / 30天不付尾款违约）
 */
export const ESCROW_STATUS = {
  PENDING_DEPOSIT: "pending_deposit",  // 待付定金
  DEPOSIT_PAID: "deposit_paid",        // 定金已付，待付尾款
  ESCROW: "escrow",                    // 全款付清已发货，担保中
  RELEASED: "released",                // 已放款
  REFUNDED: "refunded",                // 已退款
  CANCELLED: "cancelled",              // 已取消
} as const;

/**
 * 自动放款期限（天）—— 买家确认收货后多少天自动放款
 */
export const AUTO_RELEASE_DAYS = 3;

/**
 * 定金支付期限（天）—— 创建订单后7天内支付定金
 */
export const DEPOSIT_TIMEOUT_DAYS = 7;

/**
 * 尾款支付期限（天）—— 定金支付后30天内付清尾款
 */
export const BALANCE_TIMEOUT_DAYS = 30;

/**
 * 创建担保交易订单（定金+尾款模式）
 * 定金 = max(¥1,000, 商品价×10%)，封顶 ¥50,000
 * 尾款 = 商品价 - 定金（线下对公转账）
 */
export async function createEscrowOrder(params: {
  productId: string;
  buyerId: string;
  sellerId: string;
  amount: number; // 商品总价
  paymentMethod: string;
  deliveryAddress?: string;
}) {
  const depositAmount = calculateDeposit(params.amount);
  const balanceAmount = Math.round((params.amount - depositAmount) * 100) / 100;
  // 手续费按定金计提（尾款走线下对公，不收平台费）
  const { platformFee, sellerAmount } = calculateFee(depositAmount);
  const orderNo = generateOrderNo();

  // 定金支付截止时间（7天后）
  const depositExpiredAt = new Date();
  depositExpiredAt.setDate(depositExpiredAt.getDate() + DEPOSIT_TIMEOUT_DAYS);

  const order = await prisma.escrowOrder.create({
    data: {
      orderNo,
      productId: params.productId,
      buyerId: params.buyerId,
      sellerId: params.sellerId,
      amount: params.amount,
      depositAmount,
      balanceAmount,
      platformFee,
      sellerAmount,
      paymentMethod: params.paymentMethod,
      paymentStatus: ESCROW_STATUS.PENDING_DEPOSIT,
      balanceMethod: "offline_bank_transfer",
      depositExpiredAt,
      deliveryAddress: params.deliveryAddress,
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

  // 幂等：定金已付/担保中/已放款 不重复处理
  if (
    order.paymentStatus === ESCROW_STATUS.DEPOSIT_PAID ||
    order.paymentStatus === ESCROW_STATUS.ESCROW ||
    order.paymentStatus === ESCROW_STATUS.RELEASED
  ) {
    console.log("[Escrow] 订单已处理，跳过:", orderNo);
    return;
  }

  // 尾款支付截止时间（定金后30天）
  const balanceExpiredAt = new Date();
  balanceExpiredAt.setDate(balanceExpiredAt.getDate() + BALANCE_TIMEOUT_DAYS);

  // 定金支付成功 → 置定金已付
  await prisma.escrowOrder.update({
    where: { id: order.id },
    data: {
      paymentStatus: ESCROW_STATUS.DEPOSIT_PAID,
      depositPaidAt: new Date(),
      balanceExpiredAt,
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

  // 标记产品为交易中（防止其他人下单）
  await prisma.product.update({
    where: { id: order.productId },
    data: { status: "reserved" }, // reserved = 已被定金锁定
  });

  console.log(`[Escrow] 订单 ${orderNo} 定金支付成功（¥${order.depositAmount}），等待尾款`);
}

/**
 * 确认尾款到账（神雕后台手动操作）
 * 定金 + 尾款 全部付清 → 进入担保期（可发货）
 */
export async function confirmBalancePaid(orderId: string): Promise<void> {
  const order = await prisma.escrowOrder.findUnique({ where: { id: orderId } });

  if (!order) throw new Error("订单不存在");
  if (order.paymentStatus !== ESCROW_STATUS.DEPOSIT_PAID) {
    throw new Error(`当前状态 ${order.paymentStatus} 不允许确认尾款`);
  }

  await prisma.escrowOrder.update({
    where: { id: orderId },
    data: {
      paymentStatus: ESCROW_STATUS.ESCROW,
      balancePaidAt: new Date(),
      paidAt: new Date(),         // 全款付清
      escrowStartedAt: new Date(),
    },
  });

  console.log(`[Escrow] 订单 ${order.orderNo} 尾款已确认到账，全款付清，进入担保期`);
}

/**
 * 买家违约取消（30天不付尾款）
 * 定金不退（民法典 586 条），订单置为 cancelled
 */
export async function cancelForBreach(orderId: string): Promise<void> {
  const order = await prisma.escrowOrder.findUnique({ where: { id: orderId } });

  if (!order) throw new Error("订单不存在");
  if (order.paymentStatus !== ESCROW_STATUS.DEPOSIT_PAID) {
    throw new Error(`当前状态 ${order.paymentStatus} 不允许违约取消`);
  }

  await prisma.escrowOrder.update({
    where: { id: orderId },
    data: {
      paymentStatus: ESCROW_STATUS.CANCELLED,
      cancelledAt: new Date(),
    },
  });

  // 恢复产品为可售
  await prisma.product.update({
    where: { id: order.productId },
    data: { status: "active" },
  });

  console.log(`[Escrow] 订单 ${order.orderNo} 买家违约（超期未付尾款），定金不退，订单已取消`);
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
 * 退款（担保期内争议退款）
 * 线上定金通过微信支付退款，尾款走线下对公退回（需神雕手动操作）
 */
export async function refundOrder(orderId: string, reason: string): Promise<void> {
  const order = await prisma.escrowOrder.findUnique({ where: { id: orderId } });

  if (!order) throw new Error("订单不存在");
  if (order.paymentStatus !== ESCROW_STATUS.ESCROW) {
    throw new Error(`当前状态 ${order.paymentStatus} 不允许退款`);
  }

  // 仅退线上定金部分（尾款走线下对公退回，不在微信支付内处理）
  if (order.paymentMethod === "wechat" && order.depositAmount > 0) {
    const { refundOrder: wechatRefund } = await import("./wechat-pay");
    await wechatRefund(
      order.orderNo,
      `${order.orderNo}-R`,
      Math.round(order.depositAmount * 100),
      Math.round(order.depositAmount * 100),
      reason
    );
  }

  await prisma.escrowOrder.update({
    where: { id: orderId },
    data: {
      paymentStatus: ESCROW_STATUS.REFUNDED,
      refundedAt: new Date(),
    },
  });

  // 恢复产品为可售
  await prisma.product.update({
    where: { id: order.productId },
    data: { status: "active" },
  });

  console.log(`[Escrow] 订单 ${order.orderNo} 已退款（定金 ¥${order.depositAmount} 线上退，尾款线下退），原因: ${reason}`);
}

export { prisma };
