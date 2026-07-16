/**
 * 产品发布内容审核模块
 *
 * 功能：
 *   1. 重复产品检测：同一卖家 + 同一品牌 + 同一型号 + 同一年份 → 视为重复
 *   2. 视频异步审核：OSS 视频截帧 → 微信 imgSecCheck 内容安全检测
 *      审核不通过的视频标记为 rejected，不删除产品
 *
 * 注意：AI 农机图片审核已移除（方案 B），只保留微信安全检测 + 重复检测
 * 图片/文本的违法违规内容由 wechat-sec-check.ts 负责（色情、暴恐、政治敏感等）
 */

import { prisma } from "./db";

// ── 类型定义 ──

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingProductId?: string;
  existingProductStatus?: string;
  message?: string;
}

// ── 重复产品检测 ──

/**
 * 检测是否已存在相同产品
 * 判定规则：同一卖家 + 同一品牌 + 同一型号 + 同一年份 = 重复
 *
 * @param sellerId   卖家 ID
 * @param brandId    品牌 ID
 * @param modelName  产品型号
 * @param year       生产年份
 * @param excludeProductId 排除的产品 ID（编辑场景使用）
 * @returns 重复检测结果
 */
export async function checkDuplicateProduct(
  sellerId: string,
  brandId: string,
  modelName: string,
  year: number,
  excludeProductId?: string
): Promise<DuplicateCheckResult> {
  // 标准化型号名称用于模糊匹配（去除空格、大小写不敏感）
  const normalizedModel = modelName.trim().toLowerCase().replace(/\s+/g, "");

  // 查找同卖家同品牌同型号同年份的产品
  const where: Record<string, unknown> = {
    sellerId,
    brandId,
    year: Number(year),
    OR: [
      // 精确匹配
      { modelName: modelName },
      // 大小写不敏感匹配
      { modelName: { equals: modelName, mode: "insensitive" } },
    ],
  };

  if (excludeProductId) {
    where.id = { not: excludeProductId };
  }

  const existing = await prisma.product.findFirst({
    where: where as any,
    select: {
      id: true,
      modelName: true,
      year: true,
      status: true,
      createdAt: true,
      images: { take: 1, select: { url: true } },
    },
  });

  if (existing) {
    return {
      isDuplicate: true,
      existingProductId: existing.id,
      existingProductStatus: existing.status,
      message: `您已发布过同型号产品（${modelName}/${year}年），请勿重复发布。如需修改请编辑已有产品。`,
    };
  }

  // 额外检查：同卖家同品牌最近7天内是否有大量相同型号产品（防止刷屏）
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentCount = await prisma.product.count({
    where: {
      sellerId,
      brandId,
      modelName: { equals: modelName, mode: "insensitive" },
      createdAt: { gte: sevenDaysAgo },
      ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
    },
  });

  if (recentCount >= 3) {
    return {
      isDuplicate: true,
      message: `您最近7天已发布 ${recentCount} 个「${modelName}」产品，请勿频繁重复发布相同型号。`,
    };
  }

  return { isDuplicate: false };
}

// ── 视频异步审核 ──

/**
 * OSS 视频截帧 URL 生成
 * 利用阿里云 OSS 自带视频截帧功能，无需后端安装 ffmpeg
 * @param videoUrl 视频 OSS URL
 * @param timeMs 截取时间点（毫秒），默认 1000ms（第1秒）
 * @returns 截帧图片 URL
 */
function getVideoSnapshotUrl(videoUrl: string, timeMs: number = 1000): string {
  // 如果 URL 已带 query 参数，用 & 连接
  const separator = videoUrl.includes("?") ? "&" : "?";
  return `${videoUrl}${separator}x-oss-process=video/snapshot,t_${timeMs},f_jpg,w_0,h_0,m_fast`;
}

/**
 * 异步审核单个视频
 * 流程：OSS 截帧 → 微信 imgSecCheck → 更新 moderationStatus
 *
 * 此函数设计为 fire-and-forget 调用，不阻塞产品发布流程。
 * 如果 Vercel serverless 函数被 kill，视频保持 pending 状态，可后续人工审核。
 *
 * @param videoId   ProductVideo 记录 ID
 * @param videoUrl  视频 OSS URL
 */
export async function moderateVideoAsync(videoId: string, videoUrl: string): Promise<void> {
  try {
    console.log(`[video-moderation] 开始异步审核 videoId=${videoId}, url=${videoUrl.substring(0, 80)}...`);

    // 1. OSS 截取视频首帧（第1秒）
    const snapshotUrl = getVideoSnapshotUrl(videoUrl, 1000);
    console.log(`[video-moderation] 截帧 URL: ${snapshotUrl.substring(0, 100)}...`);

    // 2. 微信内容安全检测（图片）
    const { checkImage } = await import("./wechat-sec-check");
    const result = await checkImage(snapshotUrl);

    // 3. 更新审核状态
    if (result.suggest === "risky") {
      // 明确违规 → 标记为 rejected
      await prisma.productVideo.update({
        where: { id: videoId },
        data: {
          moderationStatus: "rejected",
          moderatedAt: new Date(),
        },
      });
      console.warn(`[video-moderation] ❌ 视频审核未通过（违规）videoId=${videoId}`);
    } else if (result.suggest === "review") {
      // 需人工复核 → 保持 pending，标记 moderatedAt
      await prisma.productVideo.update({
        where: { id: videoId },
        data: {
          moderationStatus: "pending",
          moderatedAt: new Date(),
        },
      });
      console.log(`[video-moderation] ⚠️ 视频需人工复核 videoId=${videoId}`);
    } else {
      // 通过
      await prisma.productVideo.update({
        where: { id: videoId },
        data: {
          moderationStatus: "passed",
          moderatedAt: new Date(),
        },
      });
      console.log(`[video-moderation] ✅ 视频审核通过 videoId=${videoId}`);
    }
  } catch (err) {
    console.error(
      `[video-moderation] 审核异常 videoId=${videoId}:`,
      err instanceof Error ? err.message : String(err)
    );
    // 审核异常时保持 pending 状态，不阻塞
  }
}

/**
 * 批量异步审核视频（fire-and-forget）
 * 不等待审核完成，立即返回
 *
 * @param videos 视频记录数组 [{ id, url }]
 */
export function fireVideoModeration(
  videos: { id: string; url: string }[]
): void {
  for (const v of videos) {
    // fire-and-forget，不 await
    moderateVideoAsync(v.id, v.url).catch((err) => {
      console.error(`[video-moderation] fire-and-forget error for ${v.id}:`, err);
    });
  }
}

// ── 视频限制常量 ──

export const MAX_VIDEOS_PER_PRODUCT = 3;
export const MAX_VIDEO_DURATION_SECONDS = 60;
export const MAX_VIDEO_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
