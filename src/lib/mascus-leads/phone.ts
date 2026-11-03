/**
 * mascus 卖家电话归一（纯函数模块，**不 import 数据库**，单测可独立运行）
 *
 * 为什么必须在**读取侧**归一，而不是改采集侧：
 *   采集侧 `parse.ts` 的 `toText()` 只做 trim、「空串 → null」，**刻意保留原样**
 *   （已有单测把 `"+1 419-529-6160"` 钉死，见 `mascus-leads.test.ts`）。
 *   而 mascus 同一卖家在不同品类页会给出 `"+1 419-529-6160"` / `"+14195296160"`
 *   / `"+1 (419) 529-6160"` 三种写法 —— 直接按原始字符串 groupBy 会把它算成 3 个卖家，
 *   「线索池按卖家聚合」这个最核心的视图会直接失真。
 *
 * 归一口径（刻意保守，只做机械变换，不做任何国家码推断）：
 *   1. 只保留数字字符；无数字 → `null`
 *   2. 剥掉 `00` 国际码前缀（`0049…` → `49…`），与 `+49…` 对齐
 *   3. 长度 > 10 时取**后 10 位**（兜住 `+1` / `+49` / `0049` 的国家码差异；
 *      美国号码 11 位含前导 1，取后 10 位正好是本地号）
 *   4. 长度 ≤ 10 原样返回
 *
 * ⚠️ 已知局限：这不是 E.164 规范化。对「同一国家、同一号码、不同排版」有效；
 * 对「本地号缺国家码」的情况（如 `0419…` vs `+1419…`）无法归并 —— 但 mascus
 * 的 `sellerPhone` 95% 带国际码，实测收益远大于误差，故不做更激进的推断。
 */

/**
 * 把任意写法的电话号码归一成聚合键。
 *
 * @param raw 原始电话字符串（可含 `+`、空格、括号、短横线）
 * @returns 归一后的聚合键；`null` / `undefined` / 无任何数字字符时返回 `null`
 *
 * @example
 * normalizePhoneKey("+1 419-529-6160")  // "4195296160"
 * normalizePhoneKey("+14195296160")    // "4195296160"
 * normalizePhoneKey("1 (419) 529-6160")// "4195296160"  ⇒ 三种写法同一个 key
 * normalizePhoneKey("0049 4441 123")   // "494441123"
 * normalizePhoneKey(null)              // null
 */
export function normalizePhoneKey(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return null;

  // 剥国际码前缀：`0049…` 与 `+49…` 应归一成同一个 key
  const trimmed = digits.startsWith("00") && digits.length > 2 ? digits.slice(2) : digits;

  // 超过 10 位取后 10 位：兜住国家码长度差异（US 11 位含前导 1 → 后 10 位即本地号）
  return trimmed.length > 10 ? trimmed.slice(-10) : trimmed;
}

/**
 * 给定一组原始电话写法，返回「去重后的原始写法 + 各出现次数」。
 *
 * 供 UI 提示「同一卖家有 N 种写法」，也是 `aggregateBySeller` 的 `phoneVariants` 来源。
 * 输出顺序固定为「次数降序，次数相同按原始写法升序」，保证结果可断言、可缓存。
 *
 * @param phones 原始电话字符串（可含 `null`，会被忽略）
 * @returns 形如 `[{ raw: "+1 419-529-6160", count: 2 }, ...]`
 */
export function describePhoneVariants(
  phones: Array<string | null | undefined>
): { raw: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const phone of phones) {
    if (typeof phone !== "string") continue;
    const raw = phone.trim();
    if (raw.length === 0) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([raw, count]) => ({ raw, count }))
    .sort((a, b) => (b.count - a.count) || a.raw.localeCompare(b.raw));
}
