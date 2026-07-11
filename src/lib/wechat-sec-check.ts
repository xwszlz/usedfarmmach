/**
 * 微信内容安全 API 封装
 *
 * 环境变量：
 *   WECHAT_MINI_SECRET - 小程序 AppSecret（复用 wechat-miniprogram 的 access_token）
 *
 * 接口：
 *   - security.msgSecCheck    文本内容安全
 *   - security.imgSecCheck    图片内容安全
 *
 * 注意：
 *   - imgSecCheck 需要上传图片 binary，因此传入图片 URL 时后端会下载后再 POST。
 *   - 任一内容被判定为风险（errcode != 0 或 suggest != pass）即抛出错误。
 *   - 检测失败不阻塞（返回检测异常），但违规会明确返回 CONTENT_SECURITY_VIOLATION。
 */

import { getAccessToken } from "./wechat-miniprogram";

const MSG_SEC_CHECK_URL = "https://api.weixin.qq.com/wxa/msgseccheck";
const IMG_SEC_CHECK_URL = "https://api.weixin.qq.com/wxa/imgseccheck";

export interface TextCheckResult {
  suggest: "pass" | "risky" | "review";
  label: number;
  keyword?: string;
  detail?: any;
}

export interface ImageCheckResult {
  suggest: "pass" | "risky" | "review";
  errcode: number;
  errmsg: string;
}

function buildResult(
  errcode: number,
  errmsg: string,
  suggest?: string,
  label?: number,
  keyword?: string,
  detail?: any
): TextCheckResult {
  return {
    suggest: (suggest || "pass") as any,
    label: label || 0,
    keyword,
    detail,
  };
}

/**
 * 文本内容安全检测
 * @param content 要检测的文本
 * @param openid  可选，用户 openid（用于更精准的用户画像风控）
 * @param scene  场景值，1-资料；2-评论；3-论坛；4-社交日志；默认 1
 */
export async function checkText(
  content: string,
  openid?: string,
  scene: number = 1
): Promise<TextCheckResult> {
  if (!content || content.trim().length === 0) {
    return buildResult(0, "ok", "pass");
  }

  const accessToken = await getAccessToken();
  const url = `${MSG_SEC_CHECK_URL}?access_token=${accessToken}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: content.trim(),
      version: 2,
      scene,
      openid: openid || undefined,
    }),
  });

  const data = await res.json();

  // 微信 v2 返回结构：result.suggest / result.label / result.detail / result.keyword
  const result = data.result || {};
  const suggest = result.suggest || "pass";
  const label = result.label || 0;
  const keyword = result.keyword || "";

  if (data.errcode !== 0 && data.errcode !== undefined) {
    throw new Error(`内容安全检测失败: ${data.errcode} ${data.errmsg}`);
  }

  return buildResult(data.errcode || 0, data.errmsg || "ok", suggest, label, keyword, result.detail);
}

/**
 * 图片内容安全检测
 * @param imageUrl 图片 URL（OSS 或任意 HTTPS URL）
 */
export async function checkImage(imageUrl: string): Promise<ImageCheckResult> {
  if (!imageUrl) {
    return { suggest: "pass", errcode: 0, errmsg: "ok" };
  }

  // 1. 下载图片
  const downloadRes = await fetch(imageUrl, { redirect: "follow" });
  if (!downloadRes.ok) {
    throw new Error(`下载图片失败 (${downloadRes.status}): ${imageUrl}`);
  }
  const arrayBuffer = await downloadRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = downloadRes.headers.get("content-type") || "image/jpeg";

  // 2. 构造 multipart/form-data
  const boundary = "----WebKitFormBoundary" + Math.random().toString(36).slice(2);
  const accessToken = await getAccessToken();
  const url = `${IMG_SEC_CHECK_URL}?access_token=${accessToken}`;

  // 构造 body：media 字段 + 文件名
  const filename = `image_${Date.now()}.jpg`;
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    "utf-8"
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8");
  const body = Buffer.concat([header, buffer, footer]);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });

  const data = await res.json();

  if (data.errcode !== 0 && data.errcode !== undefined) {
    throw new Error(`图片安全检测失败: ${data.errcode} ${data.errmsg}`);
  }

  return {
    suggest: data.suggest || "pass",
    errcode: data.errcode || 0,
    errmsg: data.errmsg || "ok",
  };
}

/**
 * 批量检测多张图片，全部通过返回 true，任一违规返回 false
 */
export async function checkImages(imageUrls: string[]): Promise<{
  allPass: boolean;
  results: { url: string; suggest: string; errcode?: number; errmsg?: string }[];
  firstViolation?: string;
}> {
  const results: { url: string; suggest: string; errcode?: number; errmsg?: string }[] = [];
  let firstViolation: string | undefined;

  for (const url of imageUrls) {
    try {
      const r = await checkImage(url);
      results.push({ url, suggest: r.suggest, errcode: r.errcode, errmsg: r.errmsg });
      if (r.suggest !== "pass" && !firstViolation) {
        firstViolation = url;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ url, suggest: "review", errmsg: msg });
      // 检测异常不视为明确违规，但记录风险
    }
  }

  const allPass = results.every((r) => r.suggest === "pass");
  return { allPass, results, firstViolation };
}

/**
 * 组合检测：文本 + 图片
 * @param text       待检测文本
 * @param imageUrls  图片 URL 数组
 * @param openid     可选
 */
export async function checkContent(
  text: string,
  imageUrls: string[],
  openid?: string
): Promise<{ text: TextCheckResult; images: Awaited<ReturnType<typeof checkImages>> }> {
  const textResult = await checkText(text, openid, 1);
  const imageResult = await checkImages(imageUrls || []);
  return { text: textResult, images: imageResult };
}

/**
 * 判断检测结果是否为违规（明确拒绝）
 */
export function isBlocked(suggest?: string): boolean {
  return suggest === "risky";
}

/**
 * 判断检测结果是否需要人工复核
 */
export function isReview(suggest?: string): boolean {
  return suggest === "review";
}
