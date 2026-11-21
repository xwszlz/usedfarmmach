/**
 * 收信转发编排 —— 纯函数层（无 IO、无 prisma、无 Next 依赖，可单测）
 *
 * 背景（2026-11-20 实测核证，勿凭记忆改写）：
 *   1. Resend 收信 = 域名 MX 指向 Resend 后**全域 catch-all**，一封来信只触发一次
 *      `email.received` webhook，**所有收件地址共用同一个 webhook URL**
 *      ⇒ 必须按事件里的 `to` 数组自己分流，否则垃圾邮件也会被转发。
 *   2. webhook payload **只有元数据**（email_id / from / to / subject / 附件清单），
 *      **不含正文与附件字节** ⇒ 正文要再调 `GET /emails/receiving/{id}`，
 *      附件要再调 `GET /emails/receiving/{id}/attachments/{attId}` 拿签名 URL 下载。
 *   3. Resend 官方 SDK 的 `receiving.forward()` 并不是一个转发接口，
 *      它内部就是「取内容 + 重新 POST /emails」两步（见 resend@6 SDK 源码）。
 *      ⇒ 本项目不引入/不升级 resend SDK（4.8.0 → 6.x 会波及已修好的发信链路），
 *        直接 fetch 拼装，行为等价且可控。
 *   4. `POST /emails` 支持 `reply_to`。**必须把 reply_to 设成原发件人**，
 *      否则群组成员点「回复」会回到 inbox 地址 → 再次触发 webhook → 死循环。
 */

import { createHmac, timingSafeEqual } from "crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 路由层返回结构（route.ts 与 forwarder 共用；.cn 的 disabled 实现也返回它） */
export interface InboundResult {
  status: number;
  body: Record<string, unknown>;
}

/** 自有域名：命中即视为内部往来信，不再转发（第二道回路保险） */
export const OWN_DOMAINS = [
  "usedfarmmach.com",
  "usedfarmmach.cn",
  "shendiaotech.cn",
] as const;

/** `"Ada <a@b.com>"` / `"a@b.com"` → `a@b.com`；非法返回 null */
export function extractAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const angled = raw.match(/<([^>]+)>/);
  const candidate = (angled ? angled[1] : raw).trim().toLowerCase();
  return EMAIL_RE.test(candidate) ? candidate : null;
}

/** 发件人是否属于自有域名（大小写、子域均视为自有） */
export function isOwnAddress(address: string | null): boolean {
  if (!address) return false;
  const at = address.lastIndexOf("@");
  if (at < 0) return false;
  const domain = address.slice(at + 1).toLowerCase();
  return OWN_DOMAINS.some(
    (own) => domain === own || domain.endsWith(`.${own}`)
  );
}

/**
 * 自投递判定：发件人地址本身也出现在收件地址里（`support@x` 发给 `support@x`）。
 *
 * 为什么必须单独判这一条 —— 2026-11-21 实测：网站联系表单 `/api/contact`
 * 的通知信 From 取 `EMAIL_FROM`（`support@usedfarmmach.com`）、To 又是
 * `support@usedfarmmach.com`，天然命中 `isOwnAddress` ⇒ 整封信被判
 * `skipped: "own-domain"` **静默丢弃**：既不转发到腾讯企业邮群组，也不推企微。
 * 表现就是老板在 Resend Inbox 里明明看得见那封信，团队邮箱里永远收不到，
 * 只能自己去 Resend 后台翻。
 *
 * 而回路保险真正要拦的是「两端都在自有域、来回自动回复」的自激，
 * 那种场景的特征恰恰是 **From ≠ To**（A 回给 B，B 再回给 A）。
 * From == To 属于自投递/系统通知，放行不会自激：转发出去的 Reply-To
 * 指向外部访客，群组成员点回复直接落到访客，不会再进 Resend webhook。
 */
export function isSelfDelivery(
  sender: string | null,
  toList: string[] | undefined
): boolean {
  if (!sender) return false;
  if (!Array.isArray(toList)) return false;
  return toList.some((raw) => extractAddress(raw) === sender);
}

/**
 * 发件人是否就是我们自己的系统发信地址（`EMAIL_FROM`）。
 *
 * 覆盖的是「系统主动发出的内部通知」：`/api/expo/inquiry`（展会询价）、
 * `/api/parts/inquiry`（配件询价）、`/api/expo/brand-claim`（品牌认领）都把通知
 * 发给 `getSalesEmail()`（`sales@usedfarmmach.com`），而 `From` 统一是
 * `EMAIL_FROM`（`support@usedfarmmach.com`）。
 *
 * 这类信 `From ≠ To`，`isSelfDelivery` 盖不住，会被回路保险判 `own-domain` 丢掉，
 * 但它们恰恰是最该送到的业务线索（客户询价、品牌认领）。用「发件人 == 系统发信地址」
 * 把它们捞回来。
 *
 * 为什么不担心放宽 —— 真正的回路风险（群组成员回信、邮件系统自动回复）`From`
 * 是收件人那侧的地址（`@shendiaotech.cn` 或外部域），不等于 `EMAIL_FROM`，依旧被拦。
 */
export function isSystemSender(
  sender: string | null,
  systemFrom: string | null | undefined
): boolean {
  if (!sender) return false;
  const addr = extractAddress(systemFrom ?? null);
  return !!addr && addr === sender;
}

/**
 * 从收信内容的 `headers` 里取原信的 `Reply-To`。
 *
 * Resend `GET /emails/receiving/{id}` 把原始邮件头放在 `headers`，
 * 键名大小写不统一（实测有 `Reply-To` / `reply-to` 两种），所以逐个大小写不敏感比对。
 * 取不到返回 null，调用方回退到发件人。
 *
 * 为什么转发时必须优先用它 —— 网站联系表单的通知信 From 是 `support@…`（自家域名），
 * 真正的对话对象在 `Reply-To`（访客邮箱）。若转发时把 reply_to 设成 From，
 * 团队点「回复」会回到 support@ 自己 → 又进 webhook → 被判自有域拦掉，
 * **客户永远收不到回信**。2026-11-21 实测踩过。
 */
export function pickReplyTo(
  headers: Record<string, string> | null | undefined
): string | null {
  if (!headers || typeof headers !== "object") return null;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== "reply-to") continue;
    const addr = extractAddress(typeof value === "string" ? value : null);
    if (addr) return addr;
  }
  return null;
}

/**
 * Resend 收件地址 → 腾讯企业邮邮件群组地址，一一对应。
 *
 * 为什么必须走「群组」：Resend 一次转发只能填一个目标地址，
 * 而需求是 3 个人同时收到 ⇒ 腾讯企业邮建邮件群组，
 * Resend 只转到群组这一个地址，加人减人只改群组、不动代码/不动 Resend。
 *
 * 群组账号在腾讯企业邮**设定后不可修改**，所以这里全部允许 env 覆盖。
 */
export function buildRoutingMap(
  env: Record<string, string | undefined> = process.env
): Record<string, string> {
  const map: Record<string, string> = {
    "support@usedfarmmach.com":
      env.INBOUND_GROUP_SUPPORT || "support@shendiaotech.cn",
    "sales@usedfarmmach.com":
      env.INBOUND_GROUP_SALES || "sales@shendiaotech.cn",
    "marketing@usedfarmmach.com":
      env.INBOUND_GROUP_MARKETING || "marketing@shendiaotech.cn",
  };
  const cleaned: Record<string, string> = {};
  for (const [inbox, group] of Object.entries(map)) {
    const g = extractAddress(group);
    if (g) cleaned[inbox.toLowerCase()] = g;
  }
  return cleaned;
}

export interface RouteTarget {
  /** 邮件实际投递到的 Resend 收件地址（用作转发时的 from） */
  inboxAddress: string;
  /** 腾讯企业邮邮件群组地址（转发目标） */
  groupAddress: string;
}

/**
 * 从事件的 `to` 数组里挑出第一个命中路由表的地址。
 * 未命中返回 null ⇒ 调用方应跳过（不转发），避免把 catch-all 收到的垃圾邮件全转出去。
 */
export function resolveGroupTarget(
  to: string[] | undefined,
  map: Record<string, string>
): RouteTarget | null {
  if (!Array.isArray(to)) return null;
  for (const raw of to) {
    const addr = extractAddress(raw);
    if (!addr) continue;
    const group = map[addr];
    if (group) return { inboxAddress: addr, groupAddress: group };
  }
  return null;
}

export interface SvixHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

/**
 * Resend 走 Svix 签名方案：`svix-signature: v1,<base64> v1,<base64>`，
 * 待签内容 = `${svix-id}.${svix-timestamp}.${rawBody}`，
 * 密钥 = `whsec_` 前缀 + base64。
 *
 * 必须用**原始 body 字符串**参与验签（JSON.parse 再 stringify 会破签）。
 */
export function verifySvixSignature(params: {
  payload: string;
  headers: SvixHeaders;
  secret: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): { ok: boolean; reason?: string } {
  const { payload, headers, secret } = params;
  const tolerance = params.toleranceSeconds ?? 300;

  if (!headers.id || !headers.timestamp || !headers.signature) {
    return { ok: false, reason: "missing svix headers" };
  }
  if (!secret) return { ok: false, reason: "missing webhook secret" };

  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "invalid timestamp" };

  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > tolerance) {
    return { ok: false, reason: "timestamp outside tolerance" };
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  if (key.length === 0) return { ok: false, reason: "invalid secret encoding" };

  const expected = createHmac("sha256", key)
    .update(`${headers.id}.${headers.timestamp}.${payload}`)
    .digest("base64");
  const expectedBuf = Buffer.from(expected);

  // 头部可能携带多个版本/密钥的签名，任一匹配即通过
  for (const part of headers.signature.split(" ")) {
    const value = part.includes(",") ? part.split(",")[1] : "";
    if (!value) continue;
    const providedBuf = Buffer.from(value.trim());
    if (
      providedBuf.length === expectedBuf.length &&
      timingSafeEqual(providedBuf, expectedBuf)
    ) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "signature mismatch" };
}

/** 转发主题：加中文前缀，方便业务员在邮箱列表里一眼分辨客户来信 */
export function buildForwardSubject(
  subject: string | null | undefined,
  inboxAddress: string
): string {
  const base = (subject || "(无主题)").trim();
  const tag = inboxAddress.startsWith("support@")
    ? "客户来信"
    : inboxAddress.startsWith("sales@")
      ? "销售来信"
      : "营销来信";
  return `[${tag}] ${base}`;
}

/**
 * 转发正文顶部横幅：原发件人 / 原收件人 / 时间 / 附件说明。
 * 因为转发后 `From` 会变成我们的 inbox 地址（客户真实地址只能写在正文里）。
 */
export function buildForwardBanner(params: {
  originalFrom: string | null;
  originalTo: string[];
  receivedAt: string;
  attachmentNote?: string;
}): string {
  const rows: Array<[string, string]> = [
    ["原发件人", params.originalFrom || "（未知）"],
    ["原收件人", (params.originalTo || []).join(", ") || "（未知）"],
    ["收到时间", params.receivedAt],
  ];
  if (params.attachmentNote) rows.push(["附件", params.attachmentNote]);

  const cells = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap;vertical-align:top;">${escapeHtml(
          k
        )}</td><td style="padding:4px 0;color:#111827;">${escapeHtml(v)}</td></tr>`
    )
    .join("");

  return [
    '<div style="border-left:3px solid #2563eb;padding:8px 0 8px 12px;margin:0 0 16px;background:#f8fafc;font:13px/1.6 -apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;">',
    '<div style="color:#2563eb;font-weight:600;margin-bottom:6px;">神雕农机 · 客户来信转发</div>',
    `<table style="border-collapse:collapse;">${cells}</table>`,
    '<div style="margin-top:8px;color:#6b7280;">直接回复本邮件即可回到客户邮箱。</div>',
    "</div>",
  ].join("");
}

/** 纯文本兜底正文（客户只发了 text 或 html 为空时） */
export function buildPlainFallback(params: {
  originalFrom: string | null;
  originalTo: string[];
  text: string | null;
}): string {
  return [
    "神雕农机 · 客户来信转发",
    `原发件人：${params.originalFrom || "（未知）"}`,
    `原收件人：${(params.originalTo || []).join(", ") || "（未知）"}`,
    "直接回复本邮件即可回到客户邮箱。",
    "",
    "────────────",
    params.text || "（原邮件无纯文本正文，请查看 HTML 版本）",
  ].join("\n");
}

/** 极简 HTML 转义，避免客户来信内容注入横幅 markup */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 企业微信群通知内容（复用 src/lib/wecom/group-webhook.ts 的 pushToGroup，
 * 不另起一套 webhook，避免又造一个环境变量）。
 */
export function buildWecomNotice(params: {
  inboxAddress: string;
  groupAddress: string;
  originalFrom: string | null;
  subject: string | null;
  attachmentCount: number;
}): { title: string; lines: string[] } {
  const lines = [
    `> 收件箱：${params.inboxAddress}`,
    `> 发件人：${params.originalFrom || "未知"}`,
    `> 主题：${(params.subject || "(无主题)").slice(0, 80)}`,
    `> 已转发至：${params.groupAddress}`,
  ];
  if (params.attachmentCount > 0) {
    lines.push(`> 附件：${params.attachmentCount} 个（已保留）`);
  }
  return { title: "📬 新客户来信", lines };
}
