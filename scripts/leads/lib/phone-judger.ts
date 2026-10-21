/**
 * 电话判定器 —— 可拨号判定 / 占位识别 / 补全置信度 / 归一化主电话。
 *
 * ## 铁律
 * `sellerPhone` **保留原文，禁止清洗**（`contentHash` 稳定，方案 §8.1）。
 * 占位电话只在 `notes` 前缀打 `[电话占位]`。
 *
 * ## 判定算法（方案 §8.4）
 * ```
 * 1. 按 [；;｜|] 切分为多个片段
 * 2. 逐片段：剔除括号内人名 → 剔除占位描述词 → 取连续数字串
 * 3. 数字位数 ≥ 7 且不含 '*' → 该片段可拨
 * 4. 任一片段可拨 → P = true
 * ```
 *
 * ### 与字面规则的唯一偏差（已在报告中说明）
 * 第 2 步「取连续数字串」若按最严格实现（只认连续数字），会把
 * `06-21.65.60.92`（荷兰 #19）、`07976 218 524`（英国 #74）、`+49 4288 927713`（德国 #18）
 * 这类**带分隔符的国际号码**误判为不可拨，与源 xlsx 的 `联络完备度` 列（🟠 仅电话）
 * 矛盾。故实现为：**先剔除分隔符（空格 / `-` / `.` / `/`），再取最长数字串**，
 * 阈值仍为 ≥7。这是复现 xlsx 实测口径的必要处理。
 */

/** 片段分隔符：`；;｜|` */
const SEGMENT_SPLIT_RE = /[；;｜|]/;

/**
 * 片段内子号分隔符：`/` `、`。
 * 例：`0991-3930795 / 18999969770`（#32）、`400-880-7767/021-55057767`（#61）
 * 若不拆，会把两个号拼成一条 20+ 位的假数字串，污染 K1 键。
 */
const SUB_PART_SPLIT_RE = /[/、]/;

/** 电话内部分隔符（会在提取数字前剔除） */
const INNER_SEPARATOR_RE = /[\s\-./]/g;

/** 括号分组（内容不含数字时整体剔除，用于去掉人名 / 补全标注） */
const PAREN_GROUP_RE = /\([^()]*\)/g;

/** 掩码标记：含 `*` 的片段一律不可拨 */
const MASK_CHAR = "*";

/** 可拨号最少位数 */
const MIN_CALLABLE_DIGITS = 7;

/** 补全置信度 */
export type PhoneConfidence = "高" | "中" | "低" | "原始";

/** 判定结果 */
export interface PhoneJudgement {
  /** P：存在可直拨号码 */
  callable: boolean;
  /** `true` 表示整行电话为占位（不可拨），需要打 `[电话占位]` */
  placeholder: boolean;
  /** 补全置信度：`(T2补全·高|中|低)` 派生，无标注为 `原始` */
  confidence: PhoneConfidence;
  /** 归一化主电话（K1 去重键用）：剔 `\D` 后取字典序最小的候选号 */
  normalizedPhone: string;
  /** 全部可拨候选号（按出现顺序去重） */
  candidates: string[];
  /** 逐片段判定明细（供报告/排错） */
  segments: Array<{ raw: string; digits: string; callable: boolean; reason: string }>;
}

/** 去掉括号内**不含数字**的分组（人名 / 补全标注 / 未公开等） */
function stripDigitFreeParens(fragment: string): string {
  return (fragment || "").replace(PAREN_GROUP_RE, (match) => (/\d/.test(match) ? match : ""));
}

/** 剔除占位描述词 */
function stripPlaceholderWords(fragment: string, placeholderWords: readonly string[]): string {
  let out = fragment || "";
  for (const word of placeholderWords) {
    if (!word) continue;
    out = out.split(word).join("");
  }
  return out;
}

/** 提取数字串（剔除电话内部分隔符后的最长连续数字） */
function extractDigits(fragment: string): string {
  const withoutSeparators = (fragment || "").replace(INNER_SEPARATOR_RE, "");
  const matches = withoutSeparators.match(/\d+/g);
  if (!matches || matches.length === 0) return "";
  let longest = "";
  for (const m of matches) {
    if (m.length > longest.length) longest = m;
  }
  return longest;
}

/**
 * 座机去区号（K1 键专用；方案 §8.6「座机去区号 ≥7 位」）。
 *
 * 中国座机区号 = 前导 `0` + 2~3 位（`010` / `02x` 为 3 位，其余 `0xxx` 为 4 位）。
 * 去掉后仍须 ≥7 位才采用，否则保留原号（境外号码如荷兰 `0621656092` 去 4 位只剩 6 位，
 * 会被这条规则挡下并保留原号，避免误伤）。
 *
 * 为什么必须做这一步：#45「0934-8888527；18193429361」若按原号取字典序最小会得到
 * `09348888527`（座机），而 #46 的最小号是 `18193429361`，两者**同号异名却检不出**。
 * 去区号后 #45 的候选变为 `8888527` 与 `18193429361`，最小号 `18193429361` 与 #46 一致。
 *
 * @param digits 纯数字串
 */
export function stripAreaCode(digits: string): string {
  const text = digits || "";
  if (!text.startsWith("0")) return text;
  const prefixLen = text.startsWith("010") || text.startsWith("02") ? 3 : 4;
  if (text.length <= prefixLen) return text;
  const rest = text.slice(prefixLen);
  return rest.length >= MIN_CALLABLE_DIGITS ? rest : text;
}

/** 由原文派生补全置信度 */
export function deriveConfidence(raw: string): PhoneConfidence {
  const text = raw || "";
  if (text.includes("T2补全·高")) return "高";
  if (text.includes("T2补全·中")) return "中";
  if (text.includes("T2补全·低")) return "低";
  return "原始";
}

/**
 * 判定一行的电话字段。
 *
 * @param raw              源 xlsx 的 `电话` 原值
 * @param placeholderWords 占位描述词白名单
 */
export function judgePhone(raw: string, placeholderWords: readonly string[]): PhoneJudgement {
  const text = (raw || "").trim();
  const segments: PhoneJudgement["segments"] = [];
  const candidates: string[] = [];

  if (!text) {
    return {
      callable: false,
      placeholder: true,
      confidence: "原始",
      normalizedPhone: "",
      candidates: [],
      segments,
    };
  }

  for (const rawSegment of text.split(SEGMENT_SPLIT_RE)) {
    const segment = rawSegment.trim();
    if (!segment) continue;

    const masked = segment.includes(MASK_CHAR);
    const afterParens = stripDigitFreeParens(segment);
    const afterPlaceholders = stripPlaceholderWords(afterParens, placeholderWords);

    // 片段内再按 `/` `、` 拆成独立子号，避免拼出超长假号码
    const subDigits: string[] = [];
    if (!masked) {
      for (const subPart of afterPlaceholders.split(SUB_PART_SPLIT_RE)) {
        const d = extractDigits(subPart);
        if (d) subDigits.push(d);
      }
    }
    let digits = "";
    for (const d of subDigits) {
      if (d.length > digits.length) digits = d;
    }
    const ok = !masked && digits.length >= MIN_CALLABLE_DIGITS;

    let reason = "";
    if (masked) {
      reason = `含掩码 '*'，不可拨`;
    } else if (digits.length === 0) {
      reason = "无数字（占位描述词）";
    } else if (digits.length < MIN_CALLABLE_DIGITS) {
      reason = `数字串 ${digits.length} 位 < ${MIN_CALLABLE_DIGITS}`;
    } else {
      reason = `数字串 ${digits.length} 位 ≥ ${MIN_CALLABLE_DIGITS}`;
    }

    segments.push({ raw: segment, digits, callable: ok, reason });
    for (const d of subDigits) {
      if (d.length >= MIN_CALLABLE_DIGITS && !candidates.includes(d)) candidates.push(d);
    }
  }

  const callable = candidates.length > 0;
  let normalizedPhone = "";
  if (candidates.length > 0) {
    // 座机去区号后，多号取字典序最小（确定性，保证 K1 键稳定）
    const normalized = candidates.map((d) => stripAreaCode(d));
    normalizedPhone = normalized.reduce((min, cur) => (cur < min ? cur : min), normalized[0]);
  }

  return {
    callable,
    placeholder: !callable,
    confidence: deriveConfidence(text),
    normalizedPhone,
    candidates,
    segments,
  };
}

/**
 * K1 去重键：归一化主电话。
 * 无可用号码时返回空串（空串不参与 K1 分组）。
 *
 * @param raw              源 xlsx 的 `电话` 原值
 * @param placeholderWords 占位描述词白名单
 */
export function primaryPhoneKey(raw: string, placeholderWords: readonly string[]): string {
  return judgePhone(raw, placeholderWords).normalizedPhone;
}
