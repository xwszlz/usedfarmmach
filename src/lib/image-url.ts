/**
 * 媒体资源 URL 工具函数
 * 
 * 产品图片和视频存在阿里云 OSS 上，数据库中存的是相对路径（如 /uploads/products/xxx/1.jpg）
 * 前端渲染时需要将相对路径转换为 OSS 完整 URL
 * 
 * OSS 图片处理：通过 ?x-oss-process 参数在线压缩图片，不改变原图
 * - 列表缩略图：quality,q_75 + resize,m_fixed,w_600
 * - 详情大图：quality,q_80
 */

const OSS_BASE_URL_RAW = process.env.NEXT_PUBLIC_OSS_BASE_URL || process.env.OSS_BASE_URL || "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com";
// 确保 OSS_BASE_URL 末尾没有斜杠
const OSS_BASE_URL = OSS_BASE_URL_RAW.endsWith('/') ? OSS_BASE_URL_RAW.slice(0, -1) : OSS_BASE_URL_RAW;

/** OSS 图片压缩参数：75% 质量 + 最大宽度 600px，兼顾清晰度和加载速度 */
const OSS_PROCESS_PARAMS = "?x-oss-process=image/quality,q_75";

/**
 * OSS 基础路径（不含图片处理参数）
 */
function getOssUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/uploads/")) return `${OSS_BASE_URL}${url}`;
  return url;
}

/**
 * 将媒体 URL 转换为完整可访问的地址
 * - 如果已经是完整 URL（http/https），直接返回
 * - 如果是 /uploads/ 开头的相对路径，拼接 OSS 地址并增加压缩参数
 * - 其他路径保持不变（如 /images/、/logo.jpg 等本地静态资源）
 */
export function getImageUrl(url: string | null | undefined): string {
  if (!url) return "/images/placeholders/tractor.svg";
  
  const base = getOssUrl(url);
  // 如果是 OSS 地址且尚未包含 x-oss-process 参数，追加压缩
  if (base.includes("oss-cn-beijing.aliyuncs.com") && !base.includes("x-oss-process")) {
    return base + OSS_PROCESS_PARAMS;
  }
  return base;
}

/**
 * 将视频 URL 转换为完整可访问的地址（不含图片压缩参数）
 */
export function getVideoUrl(url: string | null | undefined): string {
  if (!url) return "";
  return getOssUrl(url);
}
