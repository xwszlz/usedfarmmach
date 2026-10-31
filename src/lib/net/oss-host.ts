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

// ─────────────────────────────────────────────────────────────
// 「自有媒体」白名单 —— 只解决「能不能把这个 URL 交给**第三方**去抓」的问题
// ─────────────────────────────────────────────────────────────
//
// ⚠️ 为什么另起一套判定，而不是把上面的 `isOwnOssUrl` 放宽（两个函数**不许合并**）：
//   1. `isOwnOssUrl` 服务的是**出网守卫的自有 OSS 短路**（`ssrf-guard.assertSafeImageUrl`）：
//      命中即跳过 DNS 解析与内网段判断。它的语义必须严格等于"这就是我们那个桶"。
//      一旦把它放宽到"env 里声明过的域名"，一个**配错**的 CDN 域名就能绕过守卫的整套
//      内网判段 —— 那是把安全洞当便利开。所以它的判定一个字都不动。
//   2. 下面这套服务的是另一个问题：视频以 `{ type: "video_url" }` 送进火山方舟后，
//      **是方舟服务端**去抓这个地址（我们这侧不出网，因此不是我们的 SSRF）。
//      但没有白名单，请求体里塞任意 URL 就等于把我们变成"让第三方模型访问任意地址"的跳板。
//      这里必须允许"env 里声明的自有域名"：将来视频走独立 CDN 时域名会变，
//      硬编码单桶域名会让**全站视频静默失效**（老板的红线）。
//   3. 两者的失效方向不同：`isOwnOssUrl` 失真要命（安全），`isOwnMediaUrl` 失真要功能
//      （视频不被分析、因子中性）。风险等级不同，判定就必须分开写、分开演进。

/**
 * 把 env 里的「URL 或裸域名」归一化成 hostname；空值 / 非法值返回 `""`。
 *
 * 为什么要容忍裸域名：`.env` 里写 `NEXT_PUBLIC_OSS_CDN=cdn.example.com` 是很自然的写法，
 * 而 `new URL("cdn.example.com")` 会抛错。若不兜住，这一项会被静默跳过，
 * 表现为"CDN 配了但视频全被丢弃"——最难查的那类故障。所以按 https 补全再解析。
 */
function hostnameFromEnv(raw: string | undefined | null): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "";
  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    return normalizeHostname(parsed.hostname);
  } catch {
    return "";
  }
}

/** hostname 归一化：小写、去 IPv6 方括号、去尾部点（与 ssrf-guard 的口径一致） */
function normalizeHostname(hostname: string): string {
  let host = typeof hostname === "string" ? hostname.trim().toLowerCase() : "";
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  while (host.endsWith(".")) host = host.slice(0, -1);
  return host;
}

/**
 * 允许作为「自有媒体」的 hostname 集合。
 *
 * = `OSS_BUCKET_HOSTNAME`
 *   ∪ `hostname(NEXT_PUBLIC_OSS_BASE_URL)`（`image-url.ts` 的首选变量，生产即桶域名）
 *   ∪ `hostname(OSS_BASE_URL)`（服务端回退变量，`.env.cn` 里配的是它）
 *   ∪ `hostname(NEXT_PUBLIC_OSS_CDN)`（将来独立 CDN；当前生产为空/同域名）
 *
 * 后三项可能为空，`hostnameFromEnv` 会返回 `""` 并被丢弃 —— 缺配置不会误伤桶域名。
 *
 * 为什么每次调用现算而不做模块级缓存：三个 URL 解析的成本可以忽略（每条请求最多 3 个视频），
 * 而缓存会让「测试里 stubEnv」和「容器内热更配置」拿到脏值，制造出与配置不一致的判定。
 */
export function getOwnMediaHostnames(): string[] {
  const candidates = [
    OSS_BUCKET_HOSTNAME,
    hostnameFromEnv(process.env.NEXT_PUBLIC_OSS_BASE_URL),
    hostnameFromEnv(process.env.OSS_BASE_URL),
    hostnameFromEnv(process.env.NEXT_PUBLIC_OSS_CDN),
  ];
  const hosts: string[] = [];
  for (const host of candidates) {
    if (host && !hosts.includes(host)) hosts.push(host);
  }
  return hosts;
}

/**
 * 判断 URL 是否可以**交给第三方模型（火山方舟）去抓取**。
 *
 * 规则：`https:` + hostname ∈ {@link getOwnMediaHostnames}。
 * 为什么强制 https：方舟侧抓 http 会引入混合内容/被劫持改写素材的风险，而我们自有资产
 * 全部是 https（OSS 直连与 CDN 均如此）。
 *
 * 与 `isOwnOssUrl` 一样走「解析后比 hostname」而不是字符串前缀：
 * `https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com.evil.tld/x` 这种**后缀域名**
 * 用前缀比较会误判为自有（`isOwnOssUrl` 的注释里点名的攻击形态）。
 */
export function isOwnMediaUrl(url: string): boolean {
  const raw = typeof url === "string" ? url.trim() : "";
  if (!raw) return false;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return getOwnMediaHostnames().includes(normalizeHostname(parsed.hostname));
}

/**
 * 从候选列表里筛出「可以送第三方模型」的自有媒体地址 —— **全站唯一实现**。
 *
 * 为什么必须是唯一实现：`buildDoubaoContent` 曾经存过两份副本（共享版 + recognize 路由私有版），
 * 私有那份把视频降级成了一段文本，导致"识别看不到画面"这个 bug 活了很久。
 * 同理，如果 url 白名单在每条链路各写一个 `filter`，将来加 CDN 域名时必然漏掉某一处，
 * 而漏掉的表现是**静默**的（那条链路的视频再也不被分析，日志里什么都没有）。
 *
 * 语义：**过滤 + warn，绝不抛错**。单个不合规视频被丢弃，其余照跑 ——
 * 老板的要求是「图和视频都要扫」，不是「一个视频不合法就让整个估值/识别失败」。
 *
 * 日志只打 hostname，不打完整 URL：视频地址可能带签名参数，日志会被转存/外发
 * （与 `ssrf-guard` 的 `redirect-limit` 日志同一口径）。
 *
 * @param urls  候选地址（允许混入空串/undefined，会被静默跳过）
 * @param label 日志用的中文标签（如「视频」），便于按链路区分是哪一处丢的
 */
export function filterOwnMediaUrls(urls: string[], label = "媒体"): string[] {
  const list = Array.isArray(urls) ? urls : [];
  const kept: string[] = [];
  for (const candidate of list) {
    if (typeof candidate !== "string") continue;
    const url = candidate.trim();
    if (!url) continue;
    if (isOwnMediaUrl(url)) {
      kept.push(url);
      continue;
    }
    console.warn(`[oss-host] 丢弃非自有域名${label}（不交第三方模型抓取）: host=${safeHostOf(url)}`);
  }
  return kept;
}

/** 尽力取出 hostname 用于日志（永不抛错；解析不了返回 `-`） */
function safeHostOf(url: string): string {
  try {
    return normalizeHostname(new URL(url).hostname) || "-";
  } catch {
    return "-";
  }
}
