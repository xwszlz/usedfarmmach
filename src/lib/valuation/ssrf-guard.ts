/**
 * 图片抓取的出网守卫（SSRF 缓解）
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

/** 单张图片允许的最大字节数（12MB）。超过直接判失败，不进入视觉模型（也避免把内存打满） */
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

/** 图片下载超时（20s）。与视觉模型自身的超时相互独立 */
export const IMAGE_FETCH_TIMEOUT_MS = 20_000;

/** 允许的 URL scheme（其余一律拒绝：file/ftp/gopher/blob/data 等） */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** 明确指向本机的固定主机名 */
const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "ip6-localhost", "ip6-loopback"]);

/** 内部用途的主机名后缀（metadata.google.internal / *.local mDNS / *.localhost 等） */
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain", ".home.arpa"];

/** 最大重定向跳数（每一跳都会重新做完整校验） */
const MAX_REDIRECTS = 3;

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
  if (!raw) throw new Error("图片地址为空");

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`图片地址不是合法 URL: ${raw.slice(0, 120)}`);
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`图片地址协议不允许（只支持 http/https）: ${parsed.protocol}`);
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname) throw new Error("图片地址缺少主机名");

  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new Error(`图片地址指向内部主机名: ${hostname}`);
  }

  // 裸 IP 字面量：跳过 DNS，直接按网段判（否则会被 lookup 当成域名解析）
  const literalFamily = isIP(hostname);
  if (literalFamily === 4 || literalFamily === 6) {
    if (isBlockedAddress(hostname, literalFamily)) {
      throw new Error(`图片地址指向内网 IP: ${hostname}`);
    }
    return parsed;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    // all:true —— 一个域名可能有多个 A/AAAA，任何一个落在内网都算拒绝（避免挑到"干净"记录就放行）
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new Error(`图片地址域名解析失败: ${hostname}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new Error(`图片地址域名无解析结果: ${hostname}`);
  }

  for (const entry of addresses) {
    if (isBlockedAddress(entry.address, entry.family)) {
      throw new Error(`图片地址解析到内网地址: ${hostname} -> ${entry.address}`);
    }
  }

  return parsed;
}

/**
 * 带守卫生效的抓取。
 *
 * 为什么手动跟随重定向（`redirect: "manual"`）：如果让 fetch 自动跟随，攻击者只要提供一个
 * 公网地址再 302 到 `http://100.100.100.200/...`（云元数据），就能绕过主机名校验。这里每一跳都重新走
 * `assertSafeImageUrl`，超过 3 跳直接拒绝。
 */
export async function fetchGuardedImage(imageUrl: string): Promise<Response> {
  let current = typeof imageUrl === "string" ? imageUrl.trim() : "";

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertSafeImageUrl(current);

    const resp = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    });

    const status = typeof resp.status === "number" ? resp.status : 0;
    const isRedirect = status >= 300 && status < 400;
    if (!isRedirect) return resp;

    const location = resp.headers?.get?.("location") || "";
    if (!location) throw new Error(`图片重定向缺少 Location（状态码 ${status}）`);
    if (hop === MAX_REDIRECTS) break;
    current = new URL(location, current).toString();
  }

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
        throw new Error(`图片体积超过上限（${maxBytes} 字节）`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock?.();
  }

  return Buffer.concat(chunks, total);
}
