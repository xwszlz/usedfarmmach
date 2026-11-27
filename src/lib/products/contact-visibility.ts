/**
 * 卖家联系邮箱：可见性与询价收件人的**唯一判定源**
 *
 * 为什么单独抽一个纯函数模块：
 * 1. `GET /api/products/[id]/contact` 决定「展示不展示」
 * 2. `POST /api/auctions/[id]/bid` 决定「询价通知发给谁」
 * 3. 卖家编辑页决定「保存时要不要清掉验证状态」
 * 三处判定必须同一套口径，否则会出现「页面看得到邮箱、询价却发到别处」这类
 * 只有真实用户才撞得到的 bug（改动前就存在：页面展示 contactEmail，
 * 通知却发 seller.email）。
 *
 * 安全口径（老板 2026-11-22 拍板）：
 * - 展示 = `contactEmailPublic === true` **且** 邮箱已验证
 * - 投递 = 已验证明文优先，否则回落账号邮箱；未验证的 contactEmail 永不投递
 *   （自由发布场景下任何人能填别人邮箱，直接投递会让平台成为发信跳板）
 */

import { isUndeliverableEmail } from "@/lib/email/undeliverable";

/** 只取判定需要的字段，方便单测与不同调用方复用 */
export interface ContactEmailFields {
  contactEmail?: string | null;
  contactEmailPublic?: boolean | null;
  contactEmailVerifiedAt?: Date | string | null;
}

/** 宽松但足够用的邮箱格式校验：有本地部分、@、域名带点、无空白 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 归一化卖家自填邮箱：去空白 → 校验格式 → 不合格返回 null。
 * 不做大小写改写（原样保存，比对时才忽略大小写），避免把用户习惯的写法改掉。
 *
 * 🔴 除格式外还拦「域名收不到信」的地址（`isUndeliverableEmail`）。
 *    卖家邮箱是「验证通过后展示给买家、并接收询盘」的通道，
 *    若填了 usedfarmmach.cn 这种无 MX 的域，验证邮件根本发不出去，
 *    卖家会一直卡在「未验证」且不知道为什么 —— 不如在保存时就判为不合格。
 */
export function normalizeContactEmail(raw?: string | null): string | null {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value) return null;
  if (!EMAIL_RE.test(value)) return null;
  if (isUndeliverableEmail(value)) return null;
  return value;
}

/** 邮箱是否已完成验证（必须有验证时间戳，且邮箱本身格式合法） */
export function isContactEmailVerified(fields: ContactEmailFields): boolean {
  return Boolean(fields.contactEmailVerifiedAt) && normalizeContactEmail(fields.contactEmail) !== null;
}

/**
 * 是否允许在商品详情页公开展示邮箱。
 * 公开开关 + 已验证 + 格式合法，三者缺一不可。
 */
export function shouldExposeContactEmail(fields: ContactEmailFields): boolean {
  return fields.contactEmailPublic === true && isContactEmailVerified(fields);
}

/**
 * 询价通知的收件人。
 * 优先级：已验证的 contactEmail > 账号邮箱（注册时已验证，保底可达）
 *
 * 注意：这里**不看** contactEmailPublic —— 卖家选择不公开邮箱，仍然希望
 * 询价通知打到他日常看的箱子里，两件事互不冲突。
 */
export function resolveInquiryRecipient(args: {
  product: ContactEmailFields;
  sellerEmail?: string | null;
}): { email: string | null; source: "contact" | "account" | "none" } {
  const contact = normalizeContactEmail(args.product.contactEmail);
  if (contact && isContactEmailVerified(args.product)) {
    return { email: contact, source: "contact" };
  }
  const account = normalizeContactEmail(args.sellerEmail);
  if (account) return { email: account, source: "account" };
  return { email: null, source: "none" };
}

/**
 * 卖家把联系邮箱改成另一个地址时，旧的验证状态必须作废
 * —— 否则「验证 A 邮箱 → 改成 B 邮箱」就能绕过验证直接展示 B。
 * 仅比较大小写无关的明文；任一侧为空（首次填写）也视为变更。
 */
export function contactEmailChanged(prev?: string | null, next?: string | null): boolean {
  const a = (prev || "").trim().toLowerCase();
  const b = (next || "").trim().toLowerCase();
  return a !== b;
}
