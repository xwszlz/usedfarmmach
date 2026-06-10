/**
 * Slug 工具函数
 * 
 * Brand 和 Category 模型没有 slug 字段，
 * 但 SEO 需要 URL 友好的路径。
 * 方案：用 nameEn 转换为 kebab-case slug，查询时反向匹配。
 */

/** 将 nameEn 转为 URL slug：小写、空格→连字符、去除特殊字符 */
export function toSlug(nameEn: string): string {
  return nameEn
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')   // 去除特殊字符
    .replace(/[\s_]+/g, '-')     // 空格和下划线转连字符
    .replace(/-+/g, '-')         // 多个连字符合并
    .replace(/^-|-$/g, '');      // 去首尾连字符
}

/** 从 slug 反推 nameEn 的可能格式（首字母大写、连字符→空格） */
export function slugToNameGuess(slug: string): string {
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
