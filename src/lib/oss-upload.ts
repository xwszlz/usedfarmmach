/**
 * 轻量级阿里云 OSS 上传工具
 * 使用 HTTP PUT + HMAC-SHA1 签名，不依赖 ali-oss SDK
 * 大幅减小 Vercel Serverless Function 打包体积
 */
import crypto from "crypto";

const OSS_BASE = "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com";

function getCredentials() {
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID!;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET!;
  if (!accessKeyId || !accessKeySecret || accessKeyId === "your-access-key-id") {
    throw new Error("OSS credentials not configured. Set OSS_ACCESS_KEY_ID and OSS_ACCESS_KEY_SECRET");
  }
  return { accessKeyId, accessKeySecret };
}

/**
 * 计算 OSS 签名
 * OSS 签名 = Base64( HMAC-SHA1( key, VERB + "\n" + contentMD5 + "\n" + contentType + "\n" + date + "\n" + canonicalResource ) )
 */
function sign(method: string, resource: string, headers: Record<string, string>, secret: string): string {
  const contentMD5 = headers["Content-MD5"] || "";
  const contentType = headers["Content-Type"] || "";
  const date = headers["Date"] || "";
  const canonicalHeaders = Object.keys(headers)
    .filter((k) => k.startsWith("x-oss-"))
    .sort()
    .map((k) => `${k.toLowerCase()}:${headers[k]}`)
    .join("\n");

  const stringToSign = `${method}\n${contentMD5}\n${contentType}\n${date}\n${canonicalHeaders}${resource}`;
  const hmac = crypto.createHmac("sha1", secret);
  hmac.update(stringToSign, "utf-8");
  return hmac.digest("base64");
}

/**
 * 上传 Buffer 到 OSS
 * @param ossKey OSS 对象路径（如 uploads/products/xxx/cover.jpg）
 * @param buffer 文件二进制数据
 * @param contentType MIME 类型
 * @returns 完整的 OSS URL
 */
export async function uploadBufferToOSS(
  ossKey: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const { accessKeyId, accessKeySecret } = getCredentials();
  const date = new Date().toUTCString();
  const resource = `/${ossKey}`;
  const url = `${OSS_BASE}/${ossKey}`;

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    Date: date,
  };

  const signature = sign("PUT", resource, headers, accessKeySecret);
  headers["Authorization"] = `OSS ${accessKeyId}:${signature}`;

  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: buffer,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown");
    throw new Error(`OSS upload failed (${response.status}): ${errorText}`);
  }

  // 返回 OSS 完整 URL
  return `${OSS_BASE}/${ossKey}`;
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

  const contentType = file.type || "application/octet-stream";
  const url = await uploadBufferToOSS(ossKey, buffer, contentType);

  return { url, key: ossKey };
}

/**
 * 获取 OSS 公开访问 URL
 */
export function getOssUrl(ossKey: string): string {
  return `${OSS_BASE}/${ossKey}`;
}
