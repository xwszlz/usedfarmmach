import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateValuation, type ValuationInput, type ValuationResult } from "@/lib/valuation/formulas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, brand, modelName, category, year, workingHours, condition, priceCny } = body;

    // 支持两种模式：传 productId 自动获取产品数据 / 手动输入参数
    let input: ValuationInput;

    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          brand: true,
          category: true,
          internationalPrices: { orderBy: { sourceDate: "desc" }, take: 1 },
        },
      });

      if (!product) {
        return NextResponse.json({ success: false, error: "产品不存在" }, { status: 404 });
      }

      const intlPrice = product.internationalPrices[0] || null;
      input = {
        brand: brand || product.brand?.nameZh || "",
        modelName: modelName || product.modelName || "",
        category: category || product.category?.nameZh || "",
        year: year || product.year || 2020,
        workingHours: workingHours ?? product.workingHours ?? undefined,
        condition: condition || product.condition || "good",
        priceCny: priceCny || product.priceCny || undefined,
        foreignPriceCny: intlPrice?.priceForeignCny || undefined,
        location: product.location || undefined,
      };
    } else {
      // 手动输入
      if (!brand || !category || !year) {
        return NextResponse.json({ success: false, error: "缺少必要参数: brand, category, year" }, { status: 400 });
      }
      input = {
        brand: brand || "",
        modelName: modelName || "",
        category: category || "",
        year: Number(year) || 2020,
        workingHours: workingHours ? Number(workingHours) : undefined,
        condition: condition || "good",
        priceCny: priceCny ? Number(priceCny) : undefined,
      };
    }

    const result: ValuationResult = calculateValuation(input);

    return NextResponse.json({
      success: true,
      version: "v2-20260527",
      data: result,
    });
  } catch (error) {
    console.error("Valuation error:", error);
    return NextResponse.json(
      { success: false, error: "估值失败，请稍后重试" },
      { status: 500 }
    );
  }
}

// GET 支持快速查询（仅产品ID）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");

  if (!productId) {
    return NextResponse.json({ success: false, error: "需要 productId 参数" }, { status: 400 });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        brand: true,
        category: true,
        internationalPrices: { orderBy: { sourceDate: "desc" }, take: 1 },
      },
    });

    if (!product) {
      return NextResponse.json({ success: false, error: "产品不存在" }, { status: 404 });
    }

    const intlPrice = product.internationalPrices[0] || null;
    const input: ValuationInput = {
      brand: product.brand?.nameZh || "",
      modelName: product.modelName || "",
      category: product.category?.nameZh || "",
      year: product.year || 2020,
      workingHours: product.workingHours ?? undefined,
      condition: product.condition || "good",
      priceCny: product.priceCny || undefined,
      foreignPriceCny: intlPrice?.priceForeignCny || undefined,
      location: product.location || undefined,
    };

    const result = calculateValuation(input);

    return NextResponse.json({
      success: true,
      version: "v2-20260527",
      data: result,
    });
  } catch (error) {
    console.error("Valuation GET error:", error);
    return NextResponse.json(
      { success: false, error: "估值失败" },
      { status: 500 }
    );
  }
}
