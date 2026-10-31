/**
 * 全站出网守卫（SSRF 缓解）—— 不是 valuation 专用
 *
 * 放在 `src/lib/net/` 而不是某个业务目录，是因为「拿用户可控 URL 直接 fetch」的 sink
 * 遍布全仓（估值图片、商品图入库、微信内容安全检测、卖家助手识图/深度分析…），
 * 只要有一处绕过守卫，其他地方的加固都会被这一个洞抵消。
 *
 * 为什么需要它：估值接口的 `imageUrls` 完全来自请求体，攻击者可以直接传内网地址，
 * 让服务器代其出网并把响应 base64 后回吐。`.cn` 跑在阿里云 ECS 上，
 * `http://100.100.100.200/latest/meta-data/` 就是实例元数据端点 —— 属于典型 SSRF 提权面。
 * （注意是 `100.100.100.200`，属 RFC 6598 CGNAT 100.64.0.0/10；曾误写成 `100.0.0.200`，
 *   那是公网段、本守卫**会放行**，照它写"应该被拒"的用例只会得到一条绿，别被它带偏。）
 *
 * 本模块给出的缓解是「实用级」，分三步：
 *   1. scheme 白名单（只放行 http/https）
 *   2. 主机名校验：特殊内部主机名直接拒；裸 IP 直接判段；域名先解析（node:dns lookup）再逐个判段
 *   3. 抓取与读取：手动跟随重定向（**每一跳都重新校验**，否则公网地址 302 到内网即可绕过）、
 *      20s 超时、12MB 流式上限（超限立即 cancel，不把整个 body 读进内存）
 *
 * 已知残余风险（本轮不处理，写在这里防止被误读成"已彻底解决"）：
 *   - 未做连接层 IP 绑定：`lookup` 判段与 `fetch` 实际建连是两次独立解析，DNS rebinding 理论上
 *     仍可让第二次解析落到内网（TTL=0 的攻击者域名）。彻底堵死需要自定义 dispatcher/Agent 把
 *     校验过的 IP 钉进连接，代价是引入运行时耦合与额外依赖 —— 不符合本轮"轻量修复"的取舍。
 *   - NAT64 / 6to4 / Teredo 等 IPv6 转换前缀的内嵌 IPv4 未逐一展开判段（IPv4 映射与兼容形式已覆盖）。
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// ⚠️ 只 import `net/oss-host`（零依赖纯函数 + 字面量），**不要**改回 `@/lib/oss-upload`：
//    后者是业务模块（上传），一旦它顶层 import 了 `ali-oss`，守卫作为全站图片链路的公共底座
//    就会把"加载阿里云 SDK"变成每张图片的隐式前置条件。
import { isOwnOssUrl } from "@/lib/net/oss-host";

/** 单张图片允许的最大字节数（12MB）。超过直接判失败，不进入视觉模型（也避免把内存打满） */
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

/**
 * 「落盘 / 送第三方审核」场景的上限（30MB）。
 *
 * 为什么不能一个常量打天下：12MB 是**送模型**的口径（大图只是白烧 token），
 * 但 `internal/products` 的图片是"下载后转存 OSS 当商品图"、`wechat-sec-check` 是"原样转给微信"，
 * 二者对体积的容忍度与模型链路不同。旧实现完全没有上限，一刀切 12MB 会让
 * 「旧模式外部 URL 的大图」变成建品失败（且全部失败会回滚整个建品，用户感知为"发布失败"）。
 * 所以这里显式区分两个场景，并让每个调用点自己指定（见 downloadGuardedImage 的 maxBytes）。
 */
export const MAX_UPLOAD_IMAGE_BYTES = 30 * 1024 * 1024;

/** 图片下载超时（20s）。与视觉模型自身的超时相互独立 */
export const IMAGE_FETCH_TIMEOUT_MS = 20_000;

/**
 * 调用方可传入的**最小**单张图片下载超时（1s）。
 *
 * 为什么要有下界：调用方会按「剩余总预算」动态收窄超时（见
 * `buildDoubaoContent` 的 `downloadDeadlineMs`），预算见底时算出来的差值
 * 可能是 0 或负数；`AbortSignal.timeout(0)` 会在**发出请求的同一 tick** 就 abort，
 * 那只会得到一堆"下载失败"的噪声日志，反而看不出是预算问题。
 * 收窄到 1s 既保证一定有一个真实请求窗口，又不会让预算再被击穿。
 */
const MIN_IMAGE_FETCH_TIMEOUT_MS = 1_000;

/** 允许的 URL scheme（其余一律拒绝：file/ftp/gopher/blob/data 等） */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** 明确指向本机的固定主机名 */
const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "ip6-localhost", "ip6-loopback"]);

/** 内部用途的主机名后缀（metadata.google.internal / *.local mDNS / *.localhost 等） */
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain", ".home.arpa"];

/**
 * 最大重定向跳数：3。
 *
 * ⚠️ 这个数字是**拍的，不是量的** —— 实测自有 OSS / 微信 CDN / 常见图床都是 0~1 跳，
 *    3 有充足余量，但没有一条"为什么不是 2 或 4"的实测依据。
 *
 * 为什么不再放宽到 5（axios 默认值）：
 *   安全性上 3 与 5 是**等价**的 —— 每一跳都重跑 `assertSafeImageUrl`，
 *   第 4、5 跳不会比第 1 跳更危险，多的只是两次"已校验"的出站请求。
 *   但"等价"只对安全成立，对**暴露面**不成立：跳数越多，落在守卫之外的
 *   （DNS 解析时序、连接建立、重定向体读取）的机会窗口越多，收益为零、代价非零，就不做。
 *
 * 代价与对冲：3 跳对 >3 跳的图会造成"静默功能差"——图取不到时不报错，只是**视觉输入变薄**
 *   （"这台机器的分析为什么比别家薄"），没人查得出来。所以到顶必须留一条可 grep 的日志
 *   （`[ssrf-guard] redirect-limit`，带跳数与最终 host、不带完整 URL 以免泄露签名参数）：
 *   将来真有用户图床链 4 跳，线上会露出来，届时**拿证据放宽**，而不是拿感觉放宽。
 */
const MAX_REDIRECTS = 3;

/**
 * 拒绝路径的统一出口：**先打一条可 grep 的日志，再抛错**。
 *
 * 为什么必须留痕：守卫的拒绝本身不是问题，"拒绝了却没有任何痕迹"才是问题 ——
 * 线上很难区分"这张图本来就不存在"和"守卫把它误杀了"。日志前缀固定为
 * `[ssrf-guard] reject:`，配 `host=` 便于按域名聚合排查（例如某天自有 CDN 换域名后批量被拒）。
 */
function rejectImageUrl(reason: string, host: string, message: string): never {
  console.warn(`[ssrf-guard] reject: ${reason} host=${host || "-"}`);
  throw new Error(message);
}

/** 尽力取出 URL 的 hostname 用于日志（永不抛错） */
function safeHostOf(url: string): string {
  try {
    return normalizeHostname(new URL(url).hostname);
  } catch {
    return "";
  }
}

/** 把 URL 主机名归一化：小写、去首尾方括号（IPv6 字面量）、去尾部点 */
function normalizeHostname(hostname: string): string {
  let host = typeof hostname === "string" ? hostname.trim().toLowerCase() : "";
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  while (host.endsWith(".")) host = host.slice(0, -1);
  return host;
}

/** 解析点分十进制 IPv4，非法返回 null */
function parseIpv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }
  return octets;
}

/** IPv4 是否属于不可出网（回环/私网/链路本地/保留）网段 */
function isBlockedIpv4Octets(octets: number[]): boolean {
  const [a, b] = octets;
  if (a === 0) return true; // 0.0.0.0/8 —— "本网络"
  if (a === 10) return true; // 10.0.0.0/8 私网
  if (a === 127) return true; // 127.0.0.0/8 回环
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 链路本地（云元数据常见端点）
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 私网
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 私网
  // 100.64.0.0/10（RFC 6598 CGNAT）：阿里云/腾讯云实例元数据就在这段（100.100.100.200）。
  // ⚠️ 只封第二段 64~127，**不要**图省事写成 `a === 100`：100.0.0.0/8 的其余部分是
  //    ARIN 2012 年拿到的真实公网分配段，整段封掉会随机挡住合法图片源，
  //    而且是"报错了但看不出为什么"的那种故障。测试里有一条 100.1.2.3 放行的反向用例守着这件事。
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true; // 224.0.0.0/4 组播 + 240.0.0.0/4 保留 + 广播
  return false;
}

/** IPv4 字面量是否属于不可出网网段（非法字面量按"拒绝"处理，失败即关闭） */
function isBlockedIpv4(ip: string): boolean {
  const octets = parseIpv4(ip);
  if (!octets) return true;
  return isBlockedIpv4Octets(octets);
}

/** 把 IPv6 字面量展开成 8 个 16 位分组；解析失败返回 null */
function parseIpv6(ip: string): number[] | null {
  const raw = ip.split("%")[0]; // 去掉 zone id（fe80::1%eth0）
  if (!raw.includes(":")) return null;

  const halves = raw.split("::");
  if (halves.length > 2) return null;

  const toGroups = (segment: string): number[] | null => {
    if (!segment) return [];
    const out: number[] = [];
    const pieces = segment.split(":");
    for (let i = 0; i < pieces.length; i += 1) {
      const piece = pieces[i];
      if (piece === "") return null;
      // 末尾内嵌 IPv4（::ffff:127.0.0.1）
      if (piece.includes(".")) {
        if (i !== pieces.length - 1) return null;
        const v4 = parseIpv4(piece);
        if (!v4) return null;
        out.push((v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(piece)) return null;
      out.push(parseInt(piece, 16));
    }
    return out;
  };

  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  if (!head || !tail) return null;

  if (halves.length === 1) return head.length === 8 ? head : null;
  const missing = 8 - head.length - tail.length;
  if (missing < 1) return null;
  return [...head, ...new Array<number>(missing).fill(0), ...tail];
}

/** IPv6 是否属于不可出网地址（回环/未指定/ULA/链路本地/组播/内嵌 IPv4 再判） */
function isBlockedIpv6(ip: string): boolean {
  const groups = parseIpv6(ip);
  if (!groups) return true; // 解析不了就拒绝（失败即关闭）

  const allZero = groups.every((g) => g === 0);
  if (allZero) return true; // ::  未指定地址

  const isLoopback = groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1;
  if (isLoopback) return true; // ::1

  if ((groups[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 唯一本地地址
  if ((groups[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 链路本地
  if ((groups[0] & 0xff00) === 0xff00) return true; // ff00::/8 组播（不可能是图片源）

  // ::ffff:a.b.c.d（IPv4 映射）与 ::a.b.c.d（IPv4 兼容）：按内嵌 IPv4 再判一次
  const firstFiveZero = groups.slice(0, 5).every((g) => g === 0);
  const isMapped = firstFiveZero && groups[5] === 0xffff;
  const isCompat = groups.slice(0, 6).every((g) => g === 0);
  if (isMapped || isCompat) {
    const v4 = [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff];
    return isBlockedIpv4Octets(v4);
  }

  return false;
}

/** 判断"这个主机名/地址是否指向内网"（域名解析结果也能判） */
function isBlockedAddress(address: string, family: number): boolean {
  const normalized = normalizeHostname(address);
  if (family === 6 || isIP(normalized) === 6) return isBlockedIpv6(normalized);
  return isBlockedIpv4(normalized);
}

/**
 * 校验图片 URL 是否可以出网抓取。
 *
 * 校验通过返回解析后的 URL；任何被拒绝的情况都**抛错**（不返回空值、不静默跳过）——
 * 上层 `analyzeProductImage` 的 catch 会走既有降级路径，日志里也能看到明确原因。
 * 静默放行会让"没报错但也没分析"这种最难排查的状态出现。
 */
export async function assertSafeImageUrl(imageUrl: string): Promise<URL> {
  const raw = typeof imageUrl === "string" ? imageUrl.trim() : "";
  if (!raw) rejectImageUrl("empty-url", "", "图片地址为空");

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    rejectImageUrl("invalid-url", "", `图片地址不是合法 URL: ${raw.slice(0, 120)}`);
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    rejectImageUrl(
      `scheme-not-allowed(${parsed.protocol})`,
      parsed.hostname,
      `图片地址协议不允许（只支持 http/https）: ${parsed.protocol}`
    );
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname) rejectImageUrl("missing-host", "", "图片地址缺少主机名");

  // 自有 OSS：已知可信源，直接放行，**跳过 DNS 解析与网段判断**。
  // 为什么必须短路：容器内 DNS 是这条链上最不必要、也最脆的一环 —— 它一抖，
  // "全站自有商品图的下载"就全部失败；而部分调用方（如 wechat-sec-check）把异常
  // 当非阻塞吞掉，于是失败还是**静默**的（功能看着正常，合规却漏检）。
  // 自有 OSS 的地址不需要解析就能确定它不是内网，因此这里按 hostname 精确判定后直接返回。
  // 判定复用 isOwnOssUrl（protocol=https + hostname 精确相等），避免这里再写一遍规则
  // 造成两处漂移；带 query 的 OSS 处理参数（x-oss-process=...）同样会被放行。
  if (isOwnOssUrl(parsed.href)) {
    return parsed;
  }

  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    rejectImageUrl("blocked-hostname", hostname, `图片地址指向内部主机名: ${hostname}`);
  }

  // 裸 IP 字面量：跳过 DNS，直接按网段判（否则会被 lookup 当成域名解析）
  const literalFamily = isIP(hostname);
  if (literalFamily === 4 || literalFamily === 6) {
    if (isBlockedAddress(hostname, literalFamily)) {
      rejectImageUrl("blocked-ip-literal", hostname, `图片地址指向内网 IP: ${hostname}`);
    }
    return parsed;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    // all:true —— 一个域名可能有多个 A/AAAA，任何一个落在内网都算拒绝（避免挑到"干净"记录就放行）
    addresses = await lookup(hostname, { all: true });
  } catch {
    rejectImageUrl("dns-failed", hostname, `图片地址域名解析失败: ${hostname}`);
  }

  if (!addresses || addresses.length === 0) {
    rejectImageUrl("dns-empty", hostname, `图片地址域名无解析结果: ${hostname}`);
  }

  for (const entry of addresses) {
    if (isBlockedAddress(entry.address, entry.family)) {
      rejectImageUrl(
        "resolved-to-blocked-ip",
        hostname,
        `图片地址解析到内网地址: ${hostname} -> ${entry.address}`
      );
    }
  }

  return parsed;
}

/**
 * 批量校验「即将落库的图片 URL」（写侧校验）。
 *
 * 为什么写侧也要校验：读侧守卫只能保证"这一次不发内网请求"，但 `product.images` 里
 * 一旦能存进任意 URL，二阶 SSRF 就一直成立 —— 今天堵了 GET 估值，明天换个会渲染图片的
 * 出口（PDF 导出 / OG 图 / 小程序接口）就又能用，而且那串 URL 会长期留在库里。
 * 所以落库前要把非 http(s) / 内网地址直接拒掉，从根上断链。
 *
 * 抛错语义：与 {@link assertSafeImageUrl} 一致（抛，不返回 boolean）——
 * 调用方必须把失败变成**明确的用户可见报错**（如 400），不能静默过滤掉这张图：
 * 静默过滤会让卖家以为图已经传上去了。
 */
export async function assertSafeImageUrls(urls: string[]): Promise<void> {
  for (const url of urls) {
    await assertSafeImageUrl(url);
  }
}

/**
 * 带守卫生效的抓取。
 *
 * 为什么手动跟随重定向（`redirect: "manual"`）：如果让 fetch 自动跟随，攻击者只要提供一个
 * 公网地址再 302 到 `http://100.100.100.200/...`（云元数据），就能绕过主机名校验。这里每一跳都重新走
 * `assertSafeImageUrl`，超过 3 跳直接拒绝。
 *
 * @param imageUrl 待抓取地址（只接受 http(s)）
 * @param options.timeoutMs 单跳超时；**不传时保持原有的 20s 行为**
 *   （深度分析按总预算动态收窄它，见 `downloadGuardedImage` / `buildDoubaoContent`）
 */
export async function fetchGuardedImage(
  imageUrl: string,
  options: { timeoutMs?: number } = {}
): Promise<Response> {
  let current = typeof imageUrl === "string" ? imageUrl.trim() : "";
  const requested = options?.timeoutMs;
  const timeoutMs =
    typeof requested === "number" && Number.isFinite(requested)
      ? Math.max(MIN_IMAGE_FETCH_TIMEOUT_MS, Math.floor(requested))
      : IMAGE_FETCH_TIMEOUT_MS;
  /** 整条跳转链共用的截止时刻（含全部重定向跳），避免多跳叠加 */
  const hopDeadline = Date.now() + timeoutMs;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertSafeImageUrl(current);

    // 每一跳都从同一个总窗口里扣：否则 3 次重定向会变成 4 × timeoutMs
    // （深度分析把这个值当"剩余总预算"用，多跳叠加就会击穿预算）。
    const hopTimeoutMs =
      typeof requested === "number" && Number.isFinite(requested)
        ? Math.max(MIN_IMAGE_FETCH_TIMEOUT_MS, hopDeadline - Date.now())
        : IMAGE_FETCH_TIMEOUT_MS;

    const resp = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(hopTimeoutMs),
    });

    const status = typeof resp.status === "number" ? resp.status : 0;
    const isRedirect = status >= 300 && status < 400;
    if (!isRedirect) return resp;

    const location = resp.headers?.get?.("location") || "";
    if (!location) {
      rejectImageUrl("redirect-without-location", safeHostOf(current), `图片重定向缺少 Location（状态码 ${status}）`);
    }

    // 先算出下一跳地址，再判跳数上限：日志里要记的是**链路终点**的 host
    // （"哪家图床需要更多跳"才是将来放宽上限的依据），不是我们停在半路的那一跳。
    const nextHref = new URL(location, current).toString();

    if (hop === MAX_REDIRECTS) {
      // 到顶必须留痕：否则"需要更多跳才能取到的图"会变成静默变薄的分析结果。
      // 只打 host，不打完整 URL —— 图床地址常带签名参数，日志会被转存/外发。
      console.warn(`[ssrf-guard] redirect-limit: hops=${MAX_REDIRECTS} host=${safeHostOf(nextHref)}`);
      throw new Error("图片重定向次数过多");
    }
    current = nextHref;
  }

  // 兜底（正常流程走不到：上面循环的最后一次迭代必然 return 或 throw）
  console.warn(`[ssrf-guard] redirect-limit: hops=${MAX_REDIRECTS} host=${safeHostOf(current)}`);
  throw new Error("图片重定向次数过多");
}

/**
 * 按上限流式读取响应体。
 *
 * 为什么不用 `resp.arrayBuffer()`：它会先把整个响应吃进内存再让你判大小 ——
 * 一个 2GB 的响应就能把实例打爆。这里逐块累加，超限立即 `cancel()` 停止拉取。
 */
export async function readBodyWithLimit(resp: Response, maxBytes: number = MAX_IMAGE_BYTES): Promise<Buffer> {
  const body = resp.body as ReadableStream<Uint8Array> | null | undefined;

  if (!body) {
    // 响应没有 body 流（空响应体，或个别测试桩/运行环境不提供流）：
    // 此时没有可流式拉取的字节，退化读取不会带来内存放大，仅补一次大小校验兜底。
    const fallback = Buffer.from(await resp.arrayBuffer());
    if (fallback.byteLength > maxBytes) {
      console.warn(`[ssrf-guard] reject: size-limit(${maxBytes}) host=-`);
      throw new Error(`图片体积超过上限（${maxBytes} 字节）`);
    }
    return fallback;
  }

  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        // 先中止再抛错：不 cancel 的话底层连接会继续把剩余字节推进缓冲区
        await reader.cancel().catch(() => undefined);
        console.warn(`[ssrf-guard] reject: size-limit(${maxBytes}) host=-`);
        throw new Error(`图片体积超过上限（${maxBytes} 字节）`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock?.();
  }

  return Buffer.concat(chunks, total);
}
