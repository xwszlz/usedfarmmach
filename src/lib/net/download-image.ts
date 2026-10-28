/**
 * 「带守卫的图片下载」—— 把 `fetchGuardedImage` + `readBodyWithLimit` 合成一个调用，
 * 并让**每个调用点自己声明体积上限**。
 *
 * 为什么单独立这一层（而不是塞回 ssrf-guard）：
 *   1. 体积上限属于「读响应体」的一方，而不是「发请求」的一方 —— `fetchGuardedImage` 只返回
 *      `Response`，它无法也不应该替调用方决定读多少字节；
 *   2. 不同场景的容忍度不同：送模型（12MB，大图只是白烧 token）与落盘/送第三方审核
 *      （30MB，超出即业务失败）必须有各自的取值，用一个常量打天下会误伤后者；
 *   3. 抽成独立模块后它可被单测（route 文件不能导出非 HTTP 符号，写在 route 里就测不到）。
 */

import { fetchGuardedImage, readBodyWithLimit, MAX_IMAGE_BYTES } from "@/lib/net/ssrf-guard";

export interface DownloadGuardedImageOptions {
  /** 允许的最大字节数；默认 12MB（送模型口径）。落盘/送审场景请显式传 `MAX_UPLOAD_IMAGE_BYTES` */
  maxBytes?: number;
  /** 响应没有 content-type 时的兜底值；默认 `image/jpeg` */
  defaultContentType?: string;
}

/**
 * 下载图片并返回原始字节 + content-type。
 *
 * 失败语义：非 2xx、体积超限、出网守卫拒绝（scheme/内网/自有域之外的解析结果）**一律抛错**，
 * 由调用方按各自既有策略处理（跳过该图 / 转 400 / 走降级），不做静默兜底。
 *
 * @param url 图片地址（只接受 http(s)；`data:` 由调用方在更外层处理）
 */
export async function downloadGuardedImage(
  url: string,
  options: DownloadGuardedImageOptions = {}
): Promise<{ buffer: Buffer; contentType: string }> {
  const maxBytes = options.maxBytes ?? MAX_IMAGE_BYTES;
  const defaultContentType = options.defaultContentType ?? "image/jpeg";

  const res = await fetchGuardedImage(url);
  if (!res.ok) throw new Error(`图片下载失败: ${res.status}`);

  const buffer = await readBodyWithLimit(res, maxBytes);
  // 保留原始 content-type（不裁剪、不改大小写）：调用方对它的用法各不相同
  // （微信原样透传、多模态只取 mime 段、估值判 image/* 前缀），在底层做归一化会改变它们的行为。
  const contentType = res.headers?.get?.("content-type") || defaultContentType;

  return { buffer, contentType };
}
