/**
 * 卖家产品编辑 API
 * - GET: 获取单个产品详情（含所有图片、视频，用于编辑页）
 * - PUT: 更新产品信息
 *
 * 权限（2026-10-29 调整）：
 *   - 产品 owner（sellerId === userId）→ 可读写自己的产品；
 *   - admin / super_admin / editor → 可读写全站任意产品。
 *   判定统一走 @/lib/product-edit-auth，与 /api/products/[id] 等接口保持同一口径。
 */
import { NextRequest, NextResponse } from "next/server";
import { cnyToUsd, getUsdPerCny } from "@/lib/exchange-rate";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";
import { buildLocationText } from "@/lib/location-parser";
import {
  checkProductEditPermission,
  describeEditDenial,
  canDeleteAnyProduct,
} from "@/lib/product-edit-auth";

export const dynamic = "force-dynamic";

/** 从请求头解析当前用户身份 */
function getSeller(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers);
  if (!token) return null;
  return verifyToken(token);
}

// GET — 获取单个产品详情（含所有图片）
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const seller = getSeller(request);
    if (!seller) {
      return NextResponse.json(
        { success: false, error: "请先登录" },
        { status: 401 }
      );
    }

    const { id } = params;

    // 归属 + 角色统一判定：owner 放行，editor/admin/super_admin 放行
    const permission = await checkProductEditPermission(seller.userId, id);
    if (permission.outcome === "not_found") {
      return NextResponse.json(
        { success: false, error: describeEditDenial(permission) },
        { status: 404 }
      );
    }
    if (!permission.allowed) {
      return NextResponse.json(
        { success: false, error: describeEditDenial(permission) },
        { status: 403 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, nameZh: true, nameEn: true, isChineseBrand: true } },
        category: { select: { id: true, nameZh: true, nameEn: true } },
        // 二级键 id 必填：(productId, sortOrder) 全库 116 组并列，缺稳定键时 ISR 重生成会换图。
        images: { orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }] },
        videos: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: "产品不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: product,
      // 前端据此决定是否显示「可编辑任意产品」的提示（editor 视角）
      editScope: permission.outcome === "privileged" ? "any" : "own",
      // 前端据此决定是否显示「删除产品」按钮：
      // owner 可以删自己发的（发错了要能撤），editor / admin 可以删全站任意产品
      canDelete:
        permission.outcome === "owner" || canDeleteAnyProduct(permission.role),
    });
  } catch (error: any) {
    console.error("[GET /api/seller/products/[id]]", error);
    return NextResponse.json(
      { success: false, error: error.message || "获取失败" },
      { status: 500 }
    );
  }
}

// PUT — 更新产品信息
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const seller = getSeller(request);
    if (!seller) {
      return NextResponse.json(
        { success: false, error: "请先登录" },
        { status: 401 }
      );
    }

    const { id } = params;

    // 归属 + 角色统一判定（同 GET）
    const permission = await checkProductEditPermission(seller.userId, id);
    if (permission.outcome === "not_found") {
      return NextResponse.json(
        { success: false, error: describeEditDenial(permission) },
        { status: 404 }
      );
    }
    if (!permission.allowed) {
      return NextResponse.json(
        { success: false, error: describeEditDenial(permission) },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      brandName, modelName, year, workingHours, engineType, enginePower,
      driveSystem, mainConfig, overallLength, overallWidth, overallHeight,
      netWeight, condition, priceCny,
      category, country, province, city, location,
      // 2026-10-29 补齐：编辑页需要能改描述 / 状态 / 负责人联系方式
      descriptionZh, status,
      contactName, contactPhone, contactWechat, contactEmail,
    } = body;

    // ── 品牌解析：brandName → brandId ──
    let brandId: string | undefined;
    if (brandName !== undefined && brandName !== "") {
      const existingBrand = await prisma.brand.findFirst({
        where: { nameZh: brandName },
      });
      if (existingBrand) {
        brandId = existingBrand.id;
      } else {
        const created = await prisma.brand.create({
          data: {
            nameZh: brandName,
            nameEn: brandName,
            originCountry: "未知",
            isChineseBrand: false,
          },
        });
        brandId = created.id;
      }
    }

    // ── 品类解析：category → categoryId ──
    let categoryId: string | undefined;
    if (category !== undefined && category !== "") {
      const existingCat = await prisma.category.findFirst({
        where: { nameZh: category },
      });
      if (existingCat) {
        categoryId = existingCat.id;
      } else {
        const created = await prisma.category.create({
          data: { nameZh: category, nameEn: category },
        });
        categoryId = created.id;
      }
    }

    // ── 产地处理：如果有结构化字段但 location 为空，自动生成 ──
    let finalLocation = location;
    if (
      (!finalLocation || finalLocation.trim() === "") &&
      (country || province || city)
    ) {
      finalLocation = buildLocationText(country, province, city);
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(brandId !== undefined && { brandId }),
        ...(categoryId !== undefined && { categoryId }),
        ...(modelName !== undefined && { modelName }),
        // 注意：`year` 传 null 时 Number(null) === 0 会写成年份 0 —— 本轮不修，见交付报告「风险与遗留」。
        ...(year !== undefined && { year: Number(year) }),
        // 工时（累计使用小时数）：`0` 是**合法业务值**（全新机 / 试机机），必须与「空」严格区分。
        // 旧写法 `workingHours ? Number(workingHours) : null` 把数字 0 当 falsy 写成 null，
        // 而字符串 "0" 是 truthy 又被正确写成 0 ⇒ 同一字段两种输入类型两种结果（AI 视觉识别
        // 回填送的是数字，全新机必踩）。这里改为与同文件 descriptionZh 一致的口径：
        //   空（null / "" / undefined 已由外层过滤）→ null
        //   可转成有限数字 → **四舍五入后的整数**（含 0）
        //   转不成数字（"abc" / NaN / Infinity）→ null（绝不把 NaN 写进库）
        //
        // 为什么要 Math.round：列是 `Int?`，而工时的上游并不保证整数 ——
        // AI 估算「约 12.5 小时」是很正常的输出，`recognize-apply` 的 `toFiniteNumber("12.5")`
        // 也**正确地**放行小数。若这里直接写 12.5，Prisma 会拒绝 ⇒ 老板点「一键回填」时
        // 只要模型给了小数就吃一个 500，且报错信息与「工时填错了」毫无关系。
        // 口径与 `/api/internal/products` 的 `finalWorkingHours` 对齐（那边也是 Math.round），
        // 避免「同一台机器从后台录和从前台录，得到不同结果」这种下一层坑。
        ...(workingHours !== undefined && {
          workingHours:
            workingHours === null || workingHours === ""
              ? null
              : Number.isFinite(Number(workingHours))
                ? Math.round(Number(workingHours))
                : null,
        }),
        ...(engineType !== undefined && { engineType }),
        ...(enginePower !== undefined && {
          enginePower: enginePower ? Number(enginePower) : null,
        }),
        ...(driveSystem !== undefined && { driveSystem }),
        ...(mainConfig !== undefined && { mainConfig }),
        ...(overallLength !== undefined && {
          overallLength: overallLength ? Number(overallLength) : null,
        }),
        ...(overallWidth !== undefined && {
          overallWidth: overallWidth ? Number(overallWidth) : null,
        }),
        ...(overallHeight !== undefined && {
          overallHeight: overallHeight ? Number(overallHeight) : null,
        }),
        ...(netWeight !== undefined && {
          netWeight: netWeight ? Number(netWeight) : null,
        }),
        ...(condition !== undefined && { condition }),
        ...(priceCny !== undefined && { priceCny: Number(priceCny), priceUsd: cnyToUsd(Number(priceCny), await getUsdPerCny()) }),
        ...(country !== undefined && { country }),
        ...(province !== undefined && { province }),
        ...(city !== undefined && { city }),
        ...(finalLocation !== undefined && { location: finalLocation }),
        // 2026-10-29 新增可编辑字段
        ...(descriptionZh !== undefined && {
          descriptionZh: descriptionZh === null || descriptionZh === "" ? null : String(descriptionZh),
        }),
        ...(status !== undefined && { status: String(status) }),
        ...(contactName !== undefined && {
          contactName: contactName === null || contactName === "" ? null : String(contactName),
        }),
        ...(contactPhone !== undefined && {
          contactPhone: contactPhone === null || contactPhone === "" ? null : String(contactPhone),
        }),
        ...(contactWechat !== undefined && {
          contactWechat: contactWechat === null || contactWechat === "" ? null : String(contactWechat),
        }),
        ...(contactEmail !== undefined && {
          contactEmail: contactEmail === null || contactEmail === "" ? null : String(contactEmail),
        }),

        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("[PUT /api/seller/products/[id]]", error);
    return NextResponse.json(
      { success: false, error: error.message || "保存失败" },
      { status: 500 }
    );
  }
}
