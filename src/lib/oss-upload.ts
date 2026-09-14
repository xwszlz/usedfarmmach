/** 阿里云 OSS 上传工具
 *
 * 🔧 2026-06-29 重构：
 *   使用 ali-oss 官方 SDK 替代手动签名
 *   原因：手动 HMAC-SHA1 PUT 签名在 Node.js 中始终返回 SignatureDoesNotMatch
 *         经排查是 canonical resource 构造问题，oss2/ali-oss 内部实现复杂
 *   ali-oss 是阿里云官方维护的 Node.js SDK，签名逻辑经过充分验证
 */

import type { PutObjectResult } from "ali-oss";

/**
 * 读取 OSS 凭据。
 *
 * 🔒 安全（2026-09-13）：移除历史遗留的 Base64 硬编码 FALLBACK_OSS 凭据
 *    与 CORRECT_SECRET_PREFIX 回退逻辑（属凭据硬编码泄露风险）。
 *    现仅从环境变量 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET 读取；
 *    缺失时明确抛错，绝不静默回退到任何硬编码凭据。
 */
function getCredentials(): { accessKeyId: string; accessKeySecret: string } {
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID?.trim();
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET?.trim();

  if (!accessKeyId || !accessKeySecret) {
    console.error(
      "[oss-upload] ❌ OSS 凭据缺失：请配置环境变量 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET"
    );
    throw new Error(
      "OSS 凭据未配置：缺失环境变量 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET"
    );
  }
  return { accessKeyId, accessKeySecret };
}

/** 创建 ali-oss 客户端 */
function createClient() {
  const { accessKeyId, accessKeySecret } = getCredentials();

  // 动态 import 避免顶层 require 的 TS 类型检查问题
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const OSS = require("ali-oss");
  return new OSS({
    region: "oss-cn-beijing",
    bucket: "usedfarmmach-oss",
    accessKeyId,
    accessKeySecret,
    secure: true, // 强制 HTTPS，防止 Mixed Content
    timeout: 120000,
  }) as {
    put(name: string, file: Buffer | string | ReadableStream, options?: Record<string, unknown>): Promise<PutObjectResult & { url?: string; name: string; res: { status: number } }>;
    delete(name: string, options?: Record<string, unknown>): Promise<{ res: { status: number } }>;
  };
}

/**
 * 上传 Buffer 到 OSS（使用 ali-oss SDK）
 */
export async function uploadBufferToOSS(
  ossKey: string,
  buffer: Buffer | Uint8Array,
  contentType?: string
): Promise<string> {
  const client = createClient();
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  const result = await client.put(ossKey, buf, {
    headers: contentType ? { "Content-Type": contentType } : undefined,
  });

  // 返回完整 URL（强制 HTTPS，阿里云 SDK 默认可能返回 http）
  const rawUrl = (result.url as string) || `https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/${ossKey}`;
  return rawUrl.replace(/^http:\/\//, "https://");
}

/**
 * 从 File 对象上传到 OSS
 */
export async function uploadFileToOSS(
  file: File,
  folder: string
): Promise<{ url: string; key: string }> {
  const ext = file.name.split(".").pop() || "bin";
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const ossKey = `${folder}/${fileName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const url = await uploadBufferToOSS(ossKey, buffer, file.type || undefined);
  return { url, key: ossKey };
}

/** 获取 OSS 公开访问 URL */
export function getOssUrl(ossKey: string): string {
  return `https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/${ossKey}`;
}

/**
 * 删除 OSS 文件（忽略失败）
 * 用于产品删除、图片删除、视频删除时清理云端文件
 */
export async function deleteFromOSS(urlOrKey: string): Promise<void> {
  if (!urlOrKey) return;
  try {
    const key = urlOrKey.startsWith("http")
      ? urlOrKey.replace(/^https:\/\/[^/]+\/?/, "")
      : urlOrKey;
    if (!key) return;

    const client = createClient();
    await client.delete(key);
    console.log(`[oss-upload] ✅ 已删除: ${key}`);
  } catch (err) {
    // OSS 删除失败不影响主流程（数据库记录已删即可）
    console.warn(`[oss-upload] ⚠️ 删除失败（可忽略）: ${urlOrKey}`, err);
  }
}
