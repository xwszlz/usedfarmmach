/**
 * 媒体资源 URL 工具函数
 * 
 * 产品图片和视频存在阿里云 OSS 上，数据库中存的是相对路径
 * 前端渲染时需将相对路径转换为 OSS 完整 URL
 * 
 * OSS 图片处理：通过 ?x-oss-process 参数在线压缩和处理图片
 * - 列表缩略图：75%质量 + WebP + 600px宽度
 * - 详情大图：80%质量 + WebP + 1200px宽度
 */

const OSS_BASE_URL_RAW = process.env.NEXT_PUBLIC_OSS_BASE_URL || process.env.OSS_BASE_URL || "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com";
const OSS_BASE_URL = OSS_BASE_URL_RAW.endsWith("/") ? OSS_BASE_URL_RAW.slice(0, -1) : OSS_BASE_URL_RAW;

/** OSS 基础压缩参数 */
const OSS_BASE_PARAMS = "?x-oss-process=image";

/** 缩略图参数：WebP格式 + 75%质量 + 最大宽度600px */
const THUMB_PROCESS = "/format,webp/quality,q_75/resize,m_fixed,w_600";

/** 详情大图参数：WebP格式 + 80%质量 + 最大宽度1200px */
const DETAIL_PROCESS = "/format,webp/quality,q_80/resize,m_fixed,w_1200";

/**
 * OSS 基础路径（不含图片处理参数）
 */
function getOssUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/uploads/")) return `${OSS_BASE_URL}${url}`;
  return url;
}

/**
 * 将图片 URL 转换为完整可访问地址（缩略图用途）
 * 用于产品列表页、设备卡片等缩略显示场景
 * - 自动追加 WebP + 压缩 + 宽度限制
 */
export function getImageUrl(url: string | null | undefined): string {
  if (!url) return "/images/placeholders/tractor.svg";

  const base = getOssUrl(url);
  if (base.includes("oss-cn-beijing.aliyuncs.com") && !base.includes("x-oss-process")) {
    return base + OSS_BASE_PARAMS + THUMB_PROCESS;
  }
  return base;
}

/**
 * 将图片 URL 转换为完整可访问地址（详情大图用途）
 * 用于产品详情页、轮播图等大图显示场景
 * - 自动追加 WebP + 更高品质 + 更大宽度
 */
export function getDetailImageUrl(url: string | null | undefined): string {
  if (!url) return "/images/placeholders/tractor.svg";

  const base = getOssUrl(url);
  if (base.includes("oss-cn-beijing.aliyuncs.com") && !base.includes("x-oss-process")) {
    return base + OSS_BASE_PARAMS + DETAIL_PROCESS;
  }
  return base;
}

/**
 * 获取 OSS 图片的 WebP 格式 URL
 * 如果原图已通过 x-oss-process 处理，保留原有的同时追加 format,webp
 */
export function getWebpUrl(url: string | null | undefined): string {
  if (!url) return "/images/placeholders/tractor.svg";

  const base = getOssUrl(url);
  if (base.includes("oss-cn-beijing.aliyuncs.com")) {
    // 已有 process 参数 → 追加 format,webp
    if (base.includes("x-oss-process")) {
      return base + "/format,webp";
    }
    // 无参数 → 添加 WebP + 压缩
    return base + OSS_BASE_PARAMS + THUMB_PROCESS;
  }
  return base;
}

/** 视频 URL 转换（不含图片压缩参数） */
export function getVideoUrl(url: string | null | undefined): string {
  if (!url) return "";
  return getOssUrl(url);
}

/**
 * 生成 SEO 友好的图片 Alt 文本
 * 格式: [品牌] [型号] [年份]款[品类] — [所在地] — [成色]
 * 示例: "CLAAS Jaguar 970 2017款青储机 — 山东 — 良好 — 神雕农机"
 */
export function generateImageAlt(
  brandName: string,
  modelName: string,
  year: number | null | undefined,
  categoryName: string,
  locale: string,
  extra?: {
    location?: string;
    condition?: string;
  }
): string {
  const parts: string[] = [];

  if (brandName) parts.push(brandName);
  if (modelName) parts.push(modelName);
  if (year) {
    parts.push(locale === "zh" ? `${year}款` : `${year}`);
  }
  if (categoryName) parts.push(categoryName);

  // 添加位置
  if (extra?.location) {
    parts.push("—");
    parts.push(extra.location);
  }

  // 添加成色
  if (extra?.condition) {
    parts.push("—");
    const conditionMap: Record<string, string> = {
      zh: { excellent: "优秀", good: "良好", fair: "一般", poor: "较差" },
      en: { excellent: "Excellent", good: "Good", fair: "Fair", poor: "Poor" },
    };
    parts.push((conditionMap[locale]?.[extra.condition] || extra.condition) as string);
  }

  // 品牌名
  if (locale === "zh") {
    parts.push("— 神雕农机");
  } else {
    parts.push(`— ${brandName} used farm machinery`);
  }

  return parts.join(" ");
}
