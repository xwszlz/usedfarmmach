/**
 * 电子合同 API
 *
 * GET    /api/contracts              — 获取当前用户合同列表（seller或buyer）
 * POST   /api/contracts              — 创建合同 { productId, buyerId, priceCny, ... }
 * GET    /api/contracts/[id]         — 获取合同详情
 * POST   /api/contracts/[id]/sign    — 签署合同 { role: "seller" | "buyer", signature }
 * PATCH  /api/contracts/[id]         — 更新合同（仅draft状态可改）
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 生成合同编号
function generateContractNo(): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SD-HT-${dateStr}-${random}`;
}

// 默认合同条款模板
function generateDefaultTerms(productInfo: {
  modelName: string;
  brand: string;
  year: number;
  priceCny: number;
  priceUsd?: number;
  tradeTerm: string;
}): string {
  return `## 农机买卖合同

### 第一条 标的物
卖方将以下农机设备出售给买方：
- 设备名称：${productInfo.brand} ${productInfo.modelName}
- 出厂年份：${productInfo.year}年
- 贸易条款：${productInfo.tradeTerm}

### 第二条 价格与付款
1. 设备成交价格为人民币 ${productInfo.priceCny.toFixed(2)} 元${productInfo.priceUsd ? `（约 ${productInfo.priceUsd.toFixed(2)} 美元）` : ""}
2. 付款方式：双方协商确定
3. 买方应在合同签署后按约定时间支付款项

### 第三条 交货
1. 交货时间：双方约定
2. 交货地点：双方约定
3. 运输费用：按贸易条款 ${productInfo.tradeTerm} 执行

### 第四条 设备状况
卖方保证所售设备状况与平台描述一致，如有重大不符，买方有权拒收。

### 第五条 检验
1. 买方应在交货后 3 个工作日内进行检验
2. 如发现设备存在未披露的重大缺陷，有权要求退换

### 第六条 违约责任
1. 任何一方违反本合同约定，应向守约方承担违约责任
2. 违约金为合同总价的 10%

### 第七条 争议解决
本合同适用中华人民共和国法律。因本合同引起的争议，双方应协商解决；协商不成的，提交仲裁委员会仲裁。

### 第八条 其他
1. 本合同经双方电子签名后生效
2. 本合同一式两份，双方各执一份
3. 本合同通过神雕农机平台签署，具有法律效力`;
}

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
    const status = searchParams.get("status");
    const role = searchParams.get("role") || "all"; // seller, buyer, all

    const whereClause: Record<string, unknown> = {};

    if (role === "seller") {
      whereClause.sellerId = user.id;
    } else if (role === "buyer") {
      whereClause.buyerId = user.id;
    } else {
      whereClause.OR = [{ sellerId: user.id }, { buyerId: user.id }];
    }

    if (status) {
      whereClause.status = status;
    }

    const contracts = await prisma.electronicContract.findMany({
      where: whereClause,
      include: {
        product: {
          select: {
            id: true,
            modelName: true,
            year: true,
            priceCny: true,
            brand: { select: { nameZh: true, nameEn: true } },
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
        seller: {
          select: { id: true, companyName: true, username: true, phone: true },
        },
        buyer: {
          select: { id: true, companyName: true, username: true, phone: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: contracts,
    });
  } catch (error) {
    console.error("Contracts GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch contracts" },
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
      productId,
      buyerId,
      sellerId,
      priceCny,
      priceUsd,
      currency = "CNY",
      tradeTerm = "FOB",
      contractType = "sale",
      paymentMethod,
      deliveryDate,
      deliveryAddress,
      terms,
      attachments,
    } = body;

    // 验证必填字段
    if (!productId || !sellerId || !buyerId || !priceCny) {
      return NextResponse.json(
        { error: "Missing required fields: productId, sellerId, buyerId, priceCny" },
        { status: 400 }
      );
    }

    // 验证操作权限：只有买方或卖方可以发起合同
    if (user.id !== sellerId && user.id !== buyerId) {
      return NextResponse.json({ error: "You must be either seller or buyer" }, { status: 403 });
    }

    // 获取产品信息
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        brand: { select: { nameZh: true, nameEn: true } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const productInfo = {
      modelName: product.modelName,
      brand: product.brand.nameZh,
      year: product.year,
      priceCny,
      priceUsd,
      tradeTerm,
    };

    const contractNo = generateContractNo();
    const contractTerms = terms || generateDefaultTerms(productInfo);

    const contract = await prisma.electronicContract.create({
      data: {
        contractNo,
        productId,
        sellerId,
        buyerId,
        title: `${product.brand.nameZh} ${product.modelName} 买卖合同`,
        contractType,
        tradeTerm,
        productInfo: JSON.stringify(productInfo),
        priceCny: parseFloat(priceCny),
        priceUsd: priceUsd ? parseFloat(priceUsd) : null,
        currency,
        paymentMethod,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        deliveryAddress,
        terms: contractTerms,
        attachments: attachments ? JSON.stringify(attachments) : null,
        status: "draft",
      },
      include: {
        product: {
          select: { id: true, modelName: true, year: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: contract,
    });
  } catch (error) {
    console.error("Contract POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create contract" },
      { status: 500 }
    );
  }
}
