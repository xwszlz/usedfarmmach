/**
 * 「是不是我们自己的 OSS 地址」的唯一判定源。
 *
 * 为什么放在 `net/` 而不是 `lib/oss-upload.ts`（业务模块）：
 *   这文件是**零依赖的纯函数 + 一个字面量常量**，而 `net/ssrf-guard.ts` 是全站每一条
 *   图片链路的公共底座（`wechat-sec-check`、`valuation/image-analyzer`、`ai/multimodal`、
 *   `internal/products` 全部 import 它）。如果守卫反过来 import `oss-upload.ts`，
 *   就等于让"每张图片的处理"依赖"上传模块的加载"——
 *   `oss-upload.ts` 现在之所以安全，只因为它对 `ali-oss` 用了 `import type`（编译期擦除）
 *   加函数内 `require`。哪天有人把那个 `require("ali-oss")` 顺手改成顶层
 *   `import OSS from "ali-oss"`（TS 洁癖下极常见的重构），**全站每一张图片都会在模块初始化时
 *   加载阿里云 SDK**，崩起来的表现是"图片功能莫名全挂、日志里什么都没有"。
 *   依赖方向定成 net → 无依赖纯常量，这个雷就永远不会被踩到。
 */

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
