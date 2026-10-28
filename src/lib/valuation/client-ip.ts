/**
 * 估值接口的「客户端 IP 归一 + 匿名化」唯一入口
 *
 * 背景（为什么要有这个模块）：
 *   游客估值不扣积分，只靠 `GUEST_DAILY_LIMIT` 做每日额度。额度键必须是**不可伪造**的客户端标识，
 *   否则「每请求换一个 X-Forwarded-For 首段」就等于无限免费调用视觉 + 文本双模型。
 *
 * 取值链（顺序即安全边界，动它就等于打开白嫖通道）：
 *   1) `x-real-ip` 优先 —— 两个站点上它都由**可信代理覆盖写入**，客户端自带的同名头会被丢弃：
 *        - `.cn`：`deploy/nginx/conf.d/cn.conf` 里 `proxy_set_header X-Real-IP $remote_addr;`
 *          （$remote_addr 是 TCP 对端地址，nginx 直接覆盖，客户端无法影响）
 *        - `.com`：Vercel 边缘节点写入真实客户端 IP
 *      ⚠️ nginx 侧一旦删掉这行 `proxy_set_header X-Real-IP $remote_addr`，本条取值链立刻退化：
 *        下面的 x-real-ip 分支永远取不到值，只能落到 x-forwarded-for 分支 —— 而 .cn 的 XFF
 *        首段是客户端可写的，等于回到漏洞状态。部署配置改动时必须守住这行。
 *   2) `x-real-ip` 缺失时按站点回退 `x-forwarded-for`，两站语义**相反**：
 *        - `.cn`：nginx 用的是 `$proxy_add_x_forwarded_for`，其语义是「**客户端自带的 XFF 原样保留在前，
 *          再把 TCP 对端真实 IP 追加到末尾**」⇒ 首段完全由攻击者控制，只有**最后一段**可信。
 *        - `.com`：Vercel 边缘负责生成该头，最左一段就是它观测到的客户端 IP，取**第一段**。
 *   3) 两个头都没有 ⇒ 沿用历史兜底常量 `unknown`（宁可让少数异常请求共用一个桶，也不要抛错把估值打挂）。
 *
 * 隐私约束（不要改）：返回的是 `sha256("valuation-gate:" + ip)` 十六进制串，**不落明文 IP**。
 *   该值只用于匿名限流桶的键，既不需要可逆，也不应该可逆 —— 改成明文即等于把访客 IP 写进内存/日志。
 */

import { createHash } from "crypto";

import { isCnSite } from "@/config/site";

/** 两个 IP 头都缺失时的兜底标识（沿用历史实现，保持限流键仍可计算） */
export const UNKNOWN_CLIENT_IP = "unknown";

/** 限流键的哈希前缀（改它会一次性清空所有既有配额桶，不要动） */
const HASH_SALT = "valuation-gate:";

/** 去空白、去引号、去端口：`x-real-ip` 在个别反代后面可能带 `1.2.3.4:5678` 或引号 */
function normalizeIpCandidate(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  let ip = value.trim().replace(/^"(.*)"$/, "$1").trim();
  if (!ip) return "";
  // IPv6 字面量形如 [::1]:443 / ::1 —— 方括号形式才拆端口，避免破坏裸 IPv6
  if (ip.startsWith("[")) {
    const closing = ip.indexOf("]");
    if (closing > 0) ip = ip.slice(1, closing);
  } else if (ip.includes(":") && ip.split(":").length === 2) {
    // 只处理 ipv4:port 这一种（真正的 IPv6 至少两段冒号）
    const [host, port] = ip.split(":");
    if (/^\d+$/.test(port)) ip = host;
  }
  return ip.trim().toLowerCase();
}

/**
 * 按站点语义取出「可信的」客户端 IP 字符串（未哈希）。
 *
 * 导出仅供测试与调用方调试使用；业务代码应当直接用 {@link getClientIpHash}。
 */
export function resolveClientIp(headers: Headers): string {
  const realIp = normalizeIpCandidate(headers.get("x-real-ip"));
  if (realIp) return realIp;

  const forwarded = headers.get("x-forwarded-for");
  if (typeof forwarded === "string") {
    const parts = forwarded
      .split(",")
      .map((part) => normalizeIpCandidate(part))
      .filter((part) => part.length > 0);
    if (parts.length > 0) {
      // .cn：真实 IP 由 nginx 追加在末尾；.com：真实 IP 由 Vercel 写在最前
      return isCnSite() ? parts[parts.length - 1] : parts[0];
    }
  }

  return UNKNOWN_CLIENT_IP;
}

/**
 * 游客限流键：sha256 后的客户端标识。
 *
 * 输出格式（64 位小写十六进制）与历史实现完全一致 —— 该值被用作内存 Map 的键，
 * 格式变化会让所有既有配额桶失配（发布瞬间等于给每个人重置一次额度）。
 */
export function getClientIpHash(headers: Headers): string {
  const ip = resolveClientIp(headers);
  return createHash("sha256").update(`${HASH_SALT}${ip}`).digest("hex");
}
