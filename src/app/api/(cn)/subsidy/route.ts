/**
 * GET /api/(cn)/subsidy —— 国内农机补贴库公开数据 API（纵深守卫）
 * ===========================================================================
 * 站点：仅在 .cn 生效；.com 直接返回 404（补贴库绝不进境外站）。
 * 内容：只回 SubsidyCatalog 白名单字段（toPublicCatalog），每条过 assertPublicSafe。
 * 合规：禁县乡级 / PII 下钻参数；必须至少带一个过滤维度，避免超大响应。
 * export const dynamic = "force-dynamic"（.cn 构建期静态固化）。
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isCnSite } from "@/config/site";
import {
  toPublicCatalog,
  assertPublicSafe,
  assertNoPiiDrillDown,
} from "@/lib/subsidy/aggregate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  // 纵深：.com 直接 404（不返回任何补贴数据到境外站）
  if (!isCnSite()) {
    return new Response(null, { status: 404 });
  }

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  try {
    assertNoPiiDrillDown(params as Record<string, unknown>);
  } catch {
    return NextResponse.json(
      { ok: false, error: "forbidden drill-down parameter" },
      { status: 400 }
    );
  }

  const brand = typeof params.brand === "string" ? params.brand : undefined;
  const category = typeof params.category === "string" ? params.category : undefined;
  const model = typeof params.model === "string" ? params.model : undefined;
  const province = typeof params.province === "string" ? params.province : undefined;

  // 必须至少带一个过滤维度（品牌/品类/型号/省份），避免无差别全量响应
  if (!brand && !category && !model && !province) {
    return NextResponse.json(
      { ok: false, error: "missing filter: provide brand/category/model/province" },
      { status: 400 }
    );
  }

  const where: Record<string, unknown> = {
    isActive: true,
    sampleSize: { gte: 10 },
  };
  if (brand) where.brandName = brand;
  if (category) where.category = category;
  if (model) where.modelName = model;
  if (province) where.province = province;

  const rows = await prisma.subsidyCatalog.findMany({
    where,
    select: {
      province: true,
      policyYear: true,
      category: true,
      brandName: true,
      modelName: true,
      medianPriceCny: true,
      p25PriceCny: true,
      p75PriceCny: true,
      medianCentralSubsidy: true,
      medianTotalSubsidy: true,
      sampleSize: true,
    },
    orderBy: [{ policyYear: "desc" }, { brandName: "asc" }],
    take: 500,
  });

  // 白名单字段 + 脱敏护栏；任何一条不过关都不出站
  const data = rows.map((r) => {
    const safe = toPublicCatalog(r as unknown as Record<string, unknown>);
    assertPublicSafe(safe);
    return safe;
  });

  return NextResponse.json({ ok: true, count: data.length, data });
}
