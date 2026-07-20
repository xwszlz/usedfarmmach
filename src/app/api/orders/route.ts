import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { generateOrderNo, calculateFee, calculateDeposit, ESCROW_STATUS, DEPOSIT_TIMEOUT_DAYS } from "@/lib/escrow";
import { createMiniOrder, buildMiniPaySign, isConfigured } from "@/lib/wechat-pay";

/**
 * POST /api/orders
 * 创建担保交易订单（定金+尾款模式）
 *
 * 神雕自营：买家向神雕农机购买，定金进入神雕商户号（微信支付 JSAPI）；
 * 尾款走线下对公转账（0 费率，绕开微信 0.6%）。
 *
 * 定金 = max(¥1,000, 商品价×10%)，封顶 ¥50,000
 * 尾款 = 商品价 - 定金
 *
 * 入参: { productId, deliveryAddress?, contactPhone? }
 * 出参: { success, data: { orderId, orderNo, payParams, depositAmount, balanceAmount } }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }

    const body = await request.json();
    const { productId, deliveryAddress, contactPhone } = body;

    if (!productId) {
      return NextResponse.json({ success: false, error: "缺少 productId" }, { status: 400 });
    }

    // 买家必须有小程序 openid 才能 JSAPI 支付
    const buyer = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, miniOpenid: true },
    });
    if (!buyer?.miniOpenid) {
      return NextResponse.json(
        { success: false, error: "当前账号未关联小程序，无法发起支付" },
        { status: 400 }
      );
    }

    // 商品校验
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        sellerId: true,
        modelName: true,
        priceCny: true,
        status: true,
      },
    });
    if (!product) {
      return NextResponse.json({ success: false, error: "商品不存在" }, { status: 404 });
    }
    if (product.status !== "active") {
      return NextResponse.json({ success: false, error: "该商品当前不可购买" }, { status: 409 });
    }
    if (product.sellerId === user.id) {
      return NextResponse.json({ success: false, error: "不能购买自己发布的商品" }, { status: 400 });
    }

    const amount = Math.round(product.priceCny * 100) / 100; // 交易总额（CNY）
    if (!(amount > 0)) {
      return NextResponse.json({ success: false, error: "商品价格异常" }, { status: 400 });
    }

    // 定金+尾款拆分
    const depositAmount = calculateDeposit(amount);
    const balanceAmount = Math.round((amount - depositAmount) * 100) / 100;
    // 手续费按定金计提（尾款走线下对公，不收平台费）
    const { platformFee, sellerAmount } = calculateFee(depositAmount);

    const orderNo = generateOrderNo();

    // 定金支付截止（7天后）
    const depositExpiredAt = new Date();
    depositExpiredAt.setDate(depositExpiredAt.getDate() + DEPOSIT_TIMEOUT_DAYS);

    const order = await prisma.escrowOrder.create({
      data: {
        orderNo,
        productId: product.id,
        buyerId: user.id,
        sellerId: product.sellerId, // 寄售方（神雕线下结算对象）
        amount,
        depositAmount,
        balanceAmount,
        platformFee,
        sellerAmount,
        paymentMethod: "wechat",
        paymentStatus: ESCROW_STATUS.PENDING_DEPOSIT,
        balanceMethod: "offline_bank_transfer",
        depositExpiredAt,
        deliveryAddress: deliveryAddress || null,
        metadata: JSON.stringify({
          contactPhone: contactPhone || null,
          model: "self_operated",
        }),
      },
    });

    // 创建待支付流水（金额=定金）
    const paymentRecord = await prisma.paymentRecord.create({
      data: {
        orderId: order.id,
        paymentMethod: "wechat",
        amount: depositAmount,
        status: "pending",
      },
    });

    // 微信未配置（本地/测试环境）则只返回订单，不调起支付
    if (!isConfigured()) {
      return NextResponse.json({
        success: true,
        data: {
          orderId: order.id,
          orderNo: order.orderNo,
          payParams: null,
          depositAmount,
          balanceAmount,
          note: "微信支付未配置，仅创建订单（生产环境将返回 payParams）",
        },
      });
    }

    // JSAPI 预支付——金额为定金（非全款）
    const desc = `神雕农机定金-${product.modelName}`.slice(0, 60);
    const { prepay_id } = await createMiniOrder(
      orderNo,
      Math.round(depositAmount * 100),
      desc,
      buyer.miniOpenid!
    );
    const payParams = buildMiniPaySign(prepay_id);

    // 记录 prepay_id
    await prisma.paymentRecord.update({
      where: { id: paymentRecord.id },
      data: { prepayId: prepay_id },
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNo: order.orderNo,
        payParams,
        depositAmount,
        balanceAmount,
      },
    });
  } catch (error) {
    console.error("[orders] 创建订单失败:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "创建订单失败" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orders
 * 当前用户的订单列表（买家视角为主，含卖家视角可扩展）
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role") || "buyer"; // buyer | seller
    const status = searchParams.get("status");

    const where: any = {};
    if (role === "seller") {
      where.sellerId = user.id;
    } else {
      where.buyerId = user.id;
    }
    if (status) where.paymentStatus = status;

    const orders = await prisma.escrowOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        orderNo: true,
        amount: true,
        depositAmount: true,
        balanceAmount: true,
        platformFee: true,
        sellerAmount: true,
        paymentStatus: true,
        paymentMethod: true,
        balanceMethod: true,
        createdAt: true,
        depositPaidAt: true,
        balancePaidAt: true,
        paidAt: true,
        buyerConfirmed: true,
        product: {
          select: {
            id: true,
            modelName: true,
            priceCny: true,
            images: { where: { isPrimary: true }, take: 1, select: { url: true } },
          },
        },
        seller: { select: { id: true, username: true, companyName: true } },
      },
    });

    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error("[orders] 查询列表失败:", error);
    return NextResponse.json(
      { success: false, error: "查询失败" },
      { status: 500 }
    );
  }
}
