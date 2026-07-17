import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isInvalidLocation } from "@/lib/location-parser";
import {
  CHINA_PROVINCES,
  INTERNATIONAL_COUNTRIES,
  getProvinceTranslations,
  getCountryTranslations,
} from "@/lib/location-data";

// ISR: 筛选选项几乎不变，每小时更新
export const revalidate = 3600;

export async function GET() {
  try {
    const [brands, categories, products] = await Promise.all([
      prisma.brand.findMany({
        where: {
          products: { some: { status: "active" } },
        },
        select: {
          id: true,
          nameZh: true,
          nameEn: true,
          nameRu: true,
          nameEs: true,
          namePt: true,
          nameAr: true,
          nameFr: true,
          nameHi: true,
        },
        orderBy: { nameZh: "asc" },
      }),
      prisma.category.findMany({
        where: {
          products: { some: { status: "active" } },
        },
        select: {
          id: true,
          nameZh: true,
          nameEn: true,
          nameRu: true,
          nameEs: true,
          namePt: true,
          nameAr: true,
          nameFr: true,
          nameHi: true,
        },
        orderBy: { nameZh: "asc" },
      }),
      prisma.product.findMany({
        where: { status: "active" },
        select: {
          location: true,
          country: true,
          province: true,
          city: true,
        },
        orderBy: { location: "asc" },
      }),
    ]);

    // ── 结构化产地数据 ──
    // 优先使用结构化字段（country/province/city），降级使用 location 文本
    const domesticSet = new Set<string>(); // 省份名集合
    const internationalSet = new Set<string>(); // 国家代码集合
    const legacyLocationSet = new Set<string>(); // 旧格式 location 值集合

    for (const p of products) {
      // 优先使用结构化字段
      if (p.country) {
        if (p.country === "CN") {
          // 国内：以省份为筛选维度
          if (p.province) {
            domesticSet.add(p.province);
          } else if (p.location && !isInvalidLocation(p.location)) {
            // 结构化字段缺失但从 location 能推断
            const province = CHINA_PROVINCES.find((prov) =>
              p.location!.includes(prov.nameZh)
            );
            if (province) {
              domesticSet.add(province.nameZh);
            }
          }
        } else {
          // 国际：以国家代码为筛选维度
          internationalSet.add(p.country);
        }
      } else if (p.location && !isInvalidLocation(p.location)) {
        // 降级：从 location 文本解析
        const trimmed = p.location.trim();

        // 尝试匹配国际国家
        const countryMatch = INTERNATIONAL_COUNTRIES.find(
          (c) =>
            trimmed.includes(c.nameZh) ||
            trimmed.toLowerCase().includes(c.nameEn.toLowerCase()) ||
            trimmed.includes(c.code)
        );

        if (countryMatch && countryMatch.code !== "CN") {
          internationalSet.add(countryMatch.code);
        } else {
          // 尝试匹配中国省份
          const provinceMatch = CHINA_PROVINCES.find((prov) =>
            trimmed.includes(prov.nameZh)
          );
          if (provinceMatch) {
            domesticSet.add(provinceMatch.nameZh);
          } else {
            // 无法结构化，放入旧格式平铺列表
            legacyLocationSet.add(trimmed);
          }
        }
      }
    }

    // 构建国内产地列表（按省份名排序）
    const domestic = Array.from(domesticSet)
      .sort((a, b) => a.localeCompare(b, "zh-CN"))
      .map((provinceName) => {
        const translations = getProvinceTranslations(provinceName);
        return {
          value: provinceName,
          labelZh: provinceName,
          labelEn: translations.labelEn,
          labelRu: translations.labelRu,
        };
      });

    // 构建国际产地列表（按中文国名排序）
    const international = Array.from(internationalSet)
      .map((code) => {
        const translations = getCountryTranslations(code);
        return {
          value: code,
          labelZh: translations.labelZh,
          labelEn: translations.labelEn,
          labelRu: translations.labelRu,
        };
      })
      .sort((a, b) => a.labelZh.localeCompare(b.labelZh, "zh-CN"));

    // 构建旧格式平铺列表（兼容小程序过渡期）
    const locationsFlat = [
      ...domestic.map((d) => ({ value: d.value, labelZh: d.labelZh, labelEn: d.labelEn, labelRu: d.labelRu })),
      ...international.map((i) => ({ value: i.value, labelZh: i.labelZh, labelEn: i.labelEn, labelRu: i.labelRu })),
      ...Array.from(legacyLocationSet)
        .sort((a, b) => a.localeCompare(b, "zh-CN"))
        .map((l) => ({ value: l, labelZh: l, labelEn: l, labelRu: l })),
    ];

    return NextResponse.json({
      success: true,
      data: {
        brands: brands.map((b) => ({
          value: b.id,
          labelZh: b.nameZh,
          labelEn: b.nameEn || b.nameZh,
          labelRu: b.nameRu || b.nameEn || b.nameZh,
          labelEs: b.nameEs || b.nameEn || b.nameZh,
          labelPt: b.namePt || b.nameEn || b.nameZh,
          labelAr: b.nameAr || b.nameEn || b.nameZh,
          labelFr: b.nameFr || b.nameEn || b.nameZh,
          labelHi: b.nameHi || b.nameEn || b.nameZh,
        })),
        categories: categories.map((c) => ({
          value: c.id,
          labelZh: c.nameZh,
          labelEn: c.nameEn || c.nameZh,
          labelRu: c.nameRu || c.nameEn || c.nameZh,
          labelEs: c.nameEs || c.nameEn || c.nameZh,
          labelPt: c.namePt || c.nameEn || c.nameZh,
          labelAr: c.nameAr || c.nameEn || c.nameZh,
          labelFr: c.nameFr || c.nameEn || c.nameZh,
          labelHi: c.nameHi || c.nameEn || c.nameZh,
        })),
        // 新格式：结构化产地
        locations: {
          domestic,
          international,
        },
        // 旧格式：平铺数组（兼容小程序过渡期）
        locationsFlat,
      },
    });
  } catch (error) {
    console.error("Failed to fetch filter options:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
