/**
 * SubsidyModelImages —— 机型级实拍图（.cn 专属，Server Component）
 * ===========================================================================
 * 🔴 只展示 `reviewStatus = "approved"` 的 `SubsidyModelImage`；pending / rejected
 * 一律不可见。按 `modelKey = brandName|category|modelName` 机型级关联，
 * 同一机型跨省跨年的三个归档页共享同一组图（PRD §4.5）。
 *
 * 🔴 当前表为空（T05 才投放素材）⇒ 无 approved 图时**逐字保留**详情页
 * L204–212 的占位框与「暂无实拍图 · 归档机型」文案，绝不调用
 * `getImageUrl(null)`（它会返回 tractor.svg，违反红线）。
 * URL 转换统一走 `src/lib/image-url.ts` 的 getDetailImageUrl / getImageUrl，
 * 且只在 ossUrl 为非空字符串时调用。
 *
 * 本组件不做抓取器 / 复核后台 / config PATCH（全部归 T05）。
 * 查询失败或表为空都 fail-closed 回退占位框，不抛、不阻塞渲染。
 */

import { FileArchive } from "lucide-react";
import { getDetailImageUrl, getImageUrl } from "@/lib/image-url";

export interface SubsidyModelImagesProps {
  brandName: string;
  category: string;
  modelName: string;
  locale: string;
}

interface ApprovedImage {
  id: string;
  ossUrl: string;
  sourceUrl: string;
  sourceDomain: string;
  reviewedAt: Date | null;
  isPrimary: boolean;
}

/** 机型级关联键，与 §7 共享知识 / T05 buildModelKey 口径一致（`|` 三元组）。 */
function buildModelKey(brandName: string, category: string, modelName: string): string {
  return `${brandName}|${category}|${modelName}`;
}

export async function SubsidyModelImages({
  brandName,
  category,
  modelName,
  locale,
}: SubsidyModelImagesProps): Promise<JSX.Element> {
  const t = (zh: string, en: string): string => (locale === "zh" ? zh : en);
  const modelKey = buildModelKey(brandName, category, modelName);

  let images: ApprovedImage[] = [];
  try {
    // 函数内动态 import：模块顶层零 IO，单测/构建不加载 PrismaClient。
    const { prisma } = await import("@/lib/db");
    const rows = await prisma.subsidyModelImage.findMany({
      where: { modelKey, reviewStatus: "approved" },
      select: {
        id: true,
        ossUrl: true,
        sourceUrl: true,
        sourceDomain: true,
        reviewedAt: true,
        isPrimary: true,
        sortOrder: true,
      },
      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
      take: 6,
    });
    // 空串 ossUrl 也视为无图：绝不把 null / "" 交给 getImageUrl（避免 tractor.svg）。
    images = rows
      .filter((row) => typeof row.ossUrl === "string" && row.ossUrl.trim() !== "")
      .map((row) => ({
        id: row.id,
        ossUrl: row.ossUrl,
        sourceUrl: row.sourceUrl,
        sourceDomain: row.sourceDomain,
        reviewedAt: row.reviewedAt,
        isPrimary: row.isPrimary,
      }));
  } catch {
    console.warn("[subsidy-raw] 机型实拍图查询失败，回退占位框（不阻塞渲染）");
    images = [];
  }

  // 无 approved 图 —— 逐字保留 L204–212 占位框
  if (images.length === 0) {
    return (
      <div className="mb-8 flex aspect-[16/7] w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <div className="flex flex-col items-center gap-2 text-gray-400">
          <FileArchive className="h-10 w-10" />
          <span className="text-sm">
            {t("暂无实拍图 · 归档机型", "No photo · archived model")}
          </span>
        </div>
      </div>
    );
  }

  const primary = images[0];
  const thumbnails = images.slice(1, 6);
  const alt = `${brandName} ${modelName}`;

  return (
    <div className="mb-8 space-y-3">
      <div className="flex aspect-[16/7] w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element -- OSS 图片走 image-url.ts 统一转换 */}
        <img
          src={getDetailImageUrl(primary.ossUrl)}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-contain"
        />
      </div>

      {thumbnails.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {thumbnails.map((image) => (
            // eslint-disable-next-line @next/next/no-img-element -- 同上
            <img
              key={image.id}
              src={getImageUrl(image.ossUrl)}
              alt={alt}
              loading="lazy"
              className="h-20 w-28 shrink-0 rounded border border-gray-200 object-cover"
            />
          ))}
        </div>
      )}

      {/* 来源标注：链接到 sourceUrl，rel="nofollow noopener"；已人工复核 + 复核日期 */}
      <ul className="space-y-1 text-xs text-gray-500">
        {images.map((image) => (
          <li key={image.id}>
            {t("图片来源：", "Image source: ")}
            <a
              href={image.sourceUrl}
              target="_blank"
              rel="nofollow noopener"
              className="underline"
            >
              {image.sourceDomain}
            </a>
            {" · "}
            {t("已人工复核", "Reviewed")}
            {image.reviewedAt
              ? ` · ${new Date(image.reviewedAt).toISOString().slice(0, 10)}`
              : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
