/**
 * 图片 URL 工具函数
 * 
 * 产品图片存在阿里云 OSS 上，数据库中存的是相对路径（如 /uploads/products/xxx/1.jpg）
 * 前端渲染时需要将相对路径转换为 OSS 完整 URL
 */

const OSS_BASE_URL = process.env.NEXT_PUBLIC_OSS_BASE_URL || "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com";

/**
 * 将图片 URL 转换为完整可访问的地址
 * - 如果已经是完整 URL（http/https），直接返回
 * - 如果是 /uploads/ 开头的相对路径，拼接 OSS 地址
 * - 其他路径保持不变（如 /images/、/logo.jpg 等本地静态资源）
 */
export function getImageUrl(url: string | null | undefined): string {
  if (!url) return "/images/placeholders/tractor.svg";
  
  // 已经是完整 URL
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  
  // /uploads/ 开头的路径 → 转换为 OSS 地址
  if (url.startsWith("/uploads/")) {
    return `${OSS_BASE_URL}${url}`;
  }
  
  // 其他路径保持不变（如 /images/、/logo.jpg）
  return url;
}
