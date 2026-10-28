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

  // ⚠️ 防御纵深（fail-closed）：占位符值同样视为未配置，绝不当成可用凭据。
  if (
    !accessKeyId ||
    !accessKeySecret ||
    accessKeyId === "your-access-key-id" ||
    accessKeySecret === "your-access-key-secret"
  ) {
    console.error(
      "[oss-upload] ❌ OSS 凭据缺失或仍是占位值：请配置环境变量 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET"
    );
    throw new Error(
      "OSS 凭据未配置：缺失环境变量 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET"
    );
  }
  return { accessKeyId, accessKeySecret };
}

/** 本桶的 OSS 主机名（**不含 scheme**）—— 判"是不是我们自己的 OSS 地址"必须用它做精确比较 */
export const OSS_BUCKET_HOSTNAME = "usedfarmmach-oss.oss-cn-beijing.aliyuncs.com";

/**
 * 判断 URL 是否指向我们自己的 OSS 桶。
 *
 * 为什么不用 `url.startsWith("https://" + OSS_BUCKET_HOSTNAME)`：
 *   前缀比较对 `https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com.evil.tld/x` 同样成立，
 *   攻击者可以拿任意外部地址冒充"自有 OSS 直传产物"，从而绕过"下载后重传 OSS"的清洗环节
 *   （该环节同时也是 SSRF 守卫的唯一入口，绕过后恶意地址会被原样写进 productImage）。
 *   必须解析后比 hostname：hostname 由 URL 解析器给出，不含 userinfo / path / 后缀域名。
 */
export function isOwnOssUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // 保留原实现的 https 约束：小程序直传产物一定是 https，放宽到 http 会让
    // "自有 OSS 地址"这条信任判断多出一种弱协议形态（混合内容风险）。
    return parsed.protocol === "https:" && parsed.hostname === OSS_BUCKET_HOSTNAME;
  } catch {
    return false;
  }
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
