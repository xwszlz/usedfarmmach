/**
 * 销售策略 · 渠道联系方式显示口径（纯函数，前端 i18n + 空值兜底的唯一入口）
 * ─────────────────────────────────────────────────────────────
 * 为什么需要这个文件（背景是线上事故，改代码前先读）：
 *   `ai-sales-strategy-card.tsx` 的「渠道线索」区块原本把「解锁态取值 + 空值占位」
 *   写成了**一层无括号的多层三目**：
 *
 *     {full ? full.phone || zh ? "无" : "—" : c.phoneMasked || zh ? "无电话" : "—"}
 *
 *   `||` 的优先级高于 `?:`，上面这句实际解析成：
 *
 *     full ? ((full.phone || zh) ? "无" : "—") : ((c.phoneMasked || zh) ? "无电话" : "—")
 *
 *   于是两个方向同时坏掉：
 *     ① 已解锁且有真实号码 → `full.phone` 为真 ⇒ 整体为真 ⇒ 渲染「无」
 *        （用户花积分解锁后看到「无」，直接砸信任与收入）；
 *     ② 未解锁且有掩码号码 → `c.phoneMasked` 为真 ⇒ 渲染「无电话」
 *        （有线索却说没有，等于把可联系的线索藏起来）。
 *   邮箱、电话两列全中，故本次把这段口径**抽成纯函数**并加回归锁，
 *   避免以后再被人「顺手改成看起来等价的写法」又踩回去。
 *
 * 取值契约（与 `api/agents/seller-helper/sales-strategy/route.ts:700-702` 一致）：
 *   - `phoneMasked` / `emailMasked` / `wechatMasked` 三者在**源数据缺失时是空串**
 *     （不是 `null`、不是 `"无"`），有值时一定是非空字符串。
 *   - 解锁接口额外返回明文 `{ phone, wechat, email }`，三项同样可能为空串
 *     （解锁成功 ≠ 该线索一定有号码 / 有邮箱 / 有微信）。
 *
 * 硬约束：
 *   ① 纯字符串运算，**禁止** import 任何服务端模块（prisma / fs / crypto），
 *      否则会被拖进客户端 bundle。
 *   ② 语言只由 `zh` 布尔决定（与卡片里 `const zh = locale === "zh"` 同源），
 *      本文件不解析 locale，避免出现第二套语种判定口径。
 *   ③ 未解锁态**绝不**返回明文：本文件的输入压根拿不到明文，天然安全。
 */

/** 空值占位（与 PDF / Excel 的破折号口径一致） */
export const CONTACT_DASH = "—";

/** 已解锁后的明文联系方式（对应卡片 `unlocked[candidateId]`） */
export interface UnlockedContact {
  phone: string;
  wechat: string;
  email: string;
}

/**
 * 未解锁时的脱敏联系方式（对应生成接口返回的 `channels[]` 单项）。
 *
 * 三者都可能是空串：源头 `contact?.phone ? maskPhone(...) : ""`。
 */
export interface MaskedContact {
  phoneMasked: string;
  wechatMasked: string;
  emailMasked: string;
}

/** 一条渠道最终要渲染的三段文本（`null` 表示「整个 span 都不渲染」） */
export interface ChannelContactDisplay {
  /** 电话：明文 / 掩码 / 占位符 */
  phone: string;
  /** 邮箱：明文 / 掩码 / 占位符 */
  email: string;
  /** 微信：明文 / 服务端占位「微信:********」/ `null`（无微信线索，不渲染） */
  wechat: string | null;
}

/**
 * 把「有值显示值，无值按语言显示占位符」这条口径收敛成一处。
 *
 * @param value 优先展示的值（解锁后的明文，可能为空串）
 * @param placeholder 值为空时的占位文案
 * @returns 非空则返回 `value` 本身，否则返回 `placeholder`
 */
function orPlaceholder(value: string | null | undefined, placeholder: string): string {
  return typeof value === "string" && value.length > 0 ? value : placeholder;
}

/**
 * 电话显示文本。
 *
 * @param unlocked 已解锁的明文联系方式；`undefined` 表示未解锁
 * @param masked 未解锁时使用的脱敏数据
 * @param zh 是否中文站
 * @returns 已解锁 →明文或「无」/「—」；未解锁 →掩码或「无电话」/「—」
 */
export function formatPhoneDisplay(
  unlocked: UnlockedContact | null | undefined,
  masked: MaskedContact,
  zh: boolean
): string {
  return unlocked
    ? orPlaceholder(unlocked.phone, zh ? "无" : CONTACT_DASH)
    : orPlaceholder(masked.phoneMasked, zh ? "无电话" : CONTACT_DASH);
}

/**
 * 邮箱显示文本。
 *
 * @param unlocked 已解锁的明文联系方式；`undefined` 表示未解锁
 * @param masked 未解锁时使用的脱敏数据
 * @param zh 是否中文站
 * @returns 已解锁 →明文或「无」/「—」；未解锁 →掩码或「无邮箱」/「—」
 */
export function formatEmailDisplay(
  unlocked: UnlockedContact | null | undefined,
  masked: MaskedContact,
  zh: boolean
): string {
  return unlocked
    ? orPlaceholder(unlocked.email, zh ? "无" : CONTACT_DASH)
    : orPlaceholder(masked.emailMasked, zh ? "无邮箱" : CONTACT_DASH);
}

/**
 * 微信显示文本。
 *
 * ⚠️ 行为与改造前**逐字等价**（本次热修不改微信，只把口径搬进纯函数便于加锁）：
 *   - 是否渲染只看 `masked.wechatMasked`（服务端「微信:********」占位）；
 *     为空串 ⇒ 这条线索没有微信，整个 span 不渲染（返回 `null`）。
 *   - 有明文就用明文，否则回落脱敏占位。
 *
 * @param unlocked 已解锁的明文联系方式；`undefined` 表示未解锁
 * @param masked 未解锁时使用的脱敏数据
 * @returns 要渲染的文本；`null` 表示不渲染
 */
export function formatWechatDisplay(
  unlocked: UnlockedContact | null | undefined,
  masked: MaskedContact
): string | null {
  if (!masked.wechatMasked) return null;
  return orPlaceholder(unlocked?.wechat, masked.wechatMasked);
}

/**
 * 一次性算出电话 / 邮箱 / 微信三段显示文本（卡片里每个渠道调一次）。
 *
 * 存在的意义：卡片内三处 span 共用同一个 `unlocked` / `masked`，
 * 一次调用可以避免三处各写一遍三目，也就不会再出现「只改对两处、漏了第三处」。
 *
 * @param unlocked 已解锁的明文联系方式；`undefined` 表示未解锁
 * @param masked 未解锁时使用的脱敏数据
 * @param zh 是否中文站
 */
export function resolveChannelContactDisplay(
  unlocked: UnlockedContact | null | undefined,
  masked: MaskedContact,
  zh: boolean
): ChannelContactDisplay {
  return {
    phone: formatPhoneDisplay(unlocked, masked, zh),
    email: formatEmailDisplay(unlocked, masked, zh),
    wechat: formatWechatDisplay(unlocked, masked),
  };
}
